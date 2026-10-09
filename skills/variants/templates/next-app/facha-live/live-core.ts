// facha-ui lab scaffold · live mode endpoint logic · removed by /facha-ui:apply when no runs remain
import { randomUUID, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Receives change requests typed in the lab's live panel and hands them to Claude Code through
 * `.facha-ui/live/requests.jsonl`. Development only. A request is accepted only when:
 * - the app does not run in production;
 * - the Host is the one in preview.baseUrl, and Origin / Sec-Fetch-Site (when the browser sends
 *   them) say the same origin, so other sites and DNS-rebinding pages are refused;
 * - the body is JSON, which forces a CORS preflight no other origin can pass;
 * - a live session is active and the request carries its token.
 * Nothing here applies a variant: "choose" only tells the developer to confirm in Claude Code, and
 * "palette" only proposes new token values, which the developer reviews and approves there.
 */

export interface LiveOptions {
  /** Project root (the Next dev server's cwd). */
  root: string;
  production: boolean;
  now?: () => Date;
}

interface Session {
  slug: string;
  runId?: string;
  active: boolean;
  startedAt?: string;
  expiresAt?: string;
  token?: string;
}

/**
 * An element the developer pointed at in the panel, so the change says what it is about. Only
 * these fields are kept, with their limits: they describe the page and are data, never
 * instructions.
 */
interface Target {
  tag: string;
  selector?: string;
  text?: string;
  label?: string;
  role?: string;
  classes?: string;
  /** The component whose code renders the element (React dev builds). */
  owner?: string;
  /** Components around it, nearest first. */
  components?: string[];
  /** Source file of the owner, when the dev build tells it. */
  source?: string;
  rect?: { x: number; y: number; width: number; height: number };
}

/**
 * The color tokens the panel may preview with another palette, written by /facha-ui:variants in
 * `.facha-ui/live/palette.json` from get_design_system. Previews happen only in the browser.
 */
interface PaletteBase {
  anchor: string;
  themes: { name: string; selector: string }[];
  tokens: { name: string; role?: string; values: Record<string, string> }[];
  /** Hand-written colors of the project (design-system gaps), to warn about conflicts. */
  references: { where: string; values: string[] }[];
}

/** A palette the developer proposes from the panel: new values of existing tokens only. */
interface PaletteProposal {
  name: string;
  base?: string;
  tokens: Record<string, Record<string, string>>;
}

interface LiveRequest {
  id: string;
  at: string;
  kind: "change" | "choose" | "palette";
  slug: string;
  variant: string;
  text: string;
  targets?: Target[];
  palette?: PaletteProposal;
}

const MAX_TEXT = 2000;
const MAX_TARGETS = 3;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VARIANT = /^[a-z][0-9]?$/;
const TAG = /^[a-z][a-z0-9-]{0,40}$/;
const COMPONENT = /^[A-Za-z_$][\w$.]{0,59}$/;
const TOKEN = /^--[\w-]{1,60}$/;
const THEME = /^[\w-]{1,30}$/;
/** Theme selectors such as :root, html.dark or [data-theme="dark"]: no braces or semicolons. */
const SELECTOR = /^[\w\s.#:[\]="'(),*>+~-]{1,120}$/;
/** Color, gradient or shadow values: no braces, semicolons, quotes or url(). */
const VALUE = /^(?!.*url\()[#\w\s(),.%/-]{1,300}$/;
const HEX = /^#[0-9a-fA-F]{6}$/;
const TEXT_FIELDS: [keyof Target, number][] = [
  ["selector", 300],
  ["text", 160],
  ["label", 120],
  ["role", 40],
  ["classes", 200],
  ["source", 200],
];

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}

function liveDir(root: string): string {
  return path.join(root, ".facha-ui", "live");
}

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function baseUrlOf(root: string): URL {
  const config = readJson<{ preview?: { baseUrl?: string } }>(path.join(root, "facha-ui.config.json"));
  try {
    return new URL(config?.preview?.baseUrl ?? "http://localhost:3000");
  } catch {
    return new URL("http://localhost:3000");
  }
}

function sameOrigin(req: Request, base: URL): boolean {
  if (new URL(req.url).host !== base.host) return false;
  const origin = req.headers.get("origin");
  if (origin !== null && origin !== base.origin) return false;
  const site = req.headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin") return false;
  return true;
}

function activeSession(root: string, now: Date): Session | null {
  const session = readJson<Session>(path.join(liveDir(root), "session.json"));
  if (!session || session.active !== true || typeof session.slug !== "string") return null;
  if (session.expiresAt && Date.parse(session.expiresAt) < now.getTime()) return null;
  return session;
}

function sameToken(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** One line of plain text, without control characters, cut to `max`. */
function oneLine(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.replace(/[\u0000-\u001f\u007f\s]+/g, " ").trim().slice(0, max);
  return text || undefined;
}

/** The pointed elements with only their known fields; null when the list is not valid. */
function cleanTargets(value: unknown): Target[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_TARGETS) return null;
  const out: Target[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const raw = item as Record<string, unknown>;
    if (typeof raw.tag !== "string" || !TAG.test(raw.tag)) return null;
    const target: Target = { tag: raw.tag };
    for (const [key, max] of TEXT_FIELDS) {
      const text = oneLine(raw[key], max);
      if (text) (target as unknown as Record<string, unknown>)[key] = text;
    }
    if (typeof raw.owner === "string" && COMPONENT.test(raw.owner)) target.owner = raw.owner;
    if (Array.isArray(raw.components)) {
      const names = raw.components.filter((n): n is string => typeof n === "string" && COMPONENT.test(n)).slice(0, 8);
      if (names.length) target.components = names;
    }
    const rect = raw.rect as Record<string, unknown> | undefined;
    if (rect && typeof rect === "object") {
      const [x, y, width, height] = [rect.x, rect.y, rect.width, rect.height].map(Number);
      if ([x, y, width, height].every(Number.isFinite)) {
        target.rect = { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
      }
    }
    out.push(target);
  }
  return out;
}

/** The palette base, with only well-formed themes and tokens; null when there is none. */
function readPalette(root: string): PaletteBase | null {
  const raw = readJson<Record<string, unknown>>(path.join(liveDir(root), "palette.json"));
  if (!raw || typeof raw.anchor !== "string" || !TOKEN.test(raw.anchor)) return null;
  const themes = (Array.isArray(raw.themes) ? raw.themes : [])
    .filter((t): t is { name: string; selector: string } =>
      !!t && typeof t.name === "string" && THEME.test(t.name) && typeof t.selector === "string" && SELECTOR.test(t.selector),
    )
    .map((t) => ({ name: t.name, selector: t.selector }));
  const themeNames = new Set(themes.map((t) => t.name));
  const tokens: PaletteBase["tokens"] = [];
  for (const t of Array.isArray(raw.tokens) ? raw.tokens.slice(0, 80) : []) {
    if (!t || typeof t.name !== "string" || !TOKEN.test(t.name) || !t.values || typeof t.values !== "object") continue;
    const values: Record<string, string> = {};
    for (const [theme, value] of Object.entries(t.values as Record<string, unknown>)) {
      if (themeNames.has(theme) && typeof value === "string" && VALUE.test(value)) values[theme] = value;
    }
    if (Object.keys(values).length) tokens.push({ name: t.name, role: oneLine(t.role, 40), values });
  }
  if (!themes.length || !tokens.some((t) => t.name === raw.anchor)) return null;
  const references: PaletteBase["references"] = [];
  for (const r of Array.isArray(raw.references) ? raw.references.slice(0, 40) : []) {
    const where = oneLine(r?.where, 120);
    const values = Array.isArray(r?.values)
      ? r.values.filter((v: unknown): v is string => typeof v === "string" && VALUE.test(v)).slice(0, 4)
      : [];
    if (where && values.length) references.push({ where, values });
  }
  return { anchor: raw.anchor, themes, tokens, references };
}

/** A proposed palette: existing tokens and themes only, with valid values; null when invalid. */
function cleanPalette(value: unknown, base: PaletteBase | null): PaletteProposal | null {
  if (!base || !value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const name = oneLine(raw.name, 60);
  if (!name || !raw.tokens || typeof raw.tokens !== "object") return null;
  if (raw.base !== undefined && (typeof raw.base !== "string" || !HEX.test(raw.base))) return null;
  const known = new Map(base.tokens.map((t) => [t.name, t]));
  const themes = new Set(base.themes.map((t) => t.name));
  const tokens: PaletteProposal["tokens"] = {};
  for (const [token, perTheme] of Object.entries(raw.tokens as Record<string, unknown>)) {
    if (!known.has(token) || !perTheme || typeof perTheme !== "object") return null;
    for (const [theme, v] of Object.entries(perTheme as Record<string, unknown>)) {
      if (!themes.has(theme) || typeof v !== "string" || !VALUE.test(v)) return null;
      (tokens[token] ??= {})[theme] = v;
    }
  }
  if (!Object.keys(tokens).length) return null;
  return { name, ...(raw.base ? { base: raw.base as string } : {}), tokens };
}

function readRequests(root: string): LiveRequest[] {
  let text = "";
  try {
    text = fs.readFileSync(path.join(liveDir(root), "requests.jsonl"), "utf8");
  } catch {
    return [];
  }
  const out: LiveRequest[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line) as LiveRequest);
    } catch {
      /* a half-written line is skipped */
    }
  }
  return out;
}

export function handleGet(req: Request, opts: LiveOptions): Response {
  if (opts.production) return new Response("Not found", { status: 404 });
  if (!sameOrigin(req, baseUrlOf(opts.root))) return json(403, { error: "forbidden" });
  const now = opts.now?.() ?? new Date();
  const session = activeSession(opts.root, now);
  const palette = readPalette(opts.root);
  if (!session) return json(200, { active: false, palette });
  if (!session.token) {
    session.token = randomUUID();
    fs.writeFileSync(path.join(liveDir(opts.root), "session.json"), JSON.stringify(session, null, 2) + "\n");
  }
  const status = readJson<{ requests?: Record<string, unknown> }>(path.join(liveDir(opts.root), "status.json"))?.requests ?? {};
  const requests = readRequests(opts.root)
    .filter((r) => r.slug === session.slug)
    .slice(-20)
    .map((r) => ({ ...r, status: status[r.id] ?? { state: "queued" } }));
  return json(200, { active: true, token: session.token, slug: session.slug, expiresAt: session.expiresAt ?? null, requests, palette });
}

export async function handlePost(req: Request, opts: LiveOptions): Promise<Response> {
  if (opts.production) return new Response("Not found", { status: 404 });
  if (!sameOrigin(req, baseUrlOf(opts.root))) return json(403, { error: "forbidden" });
  if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return json(415, { error: "JSON only" });
  }
  const now = opts.now?.() ?? new Date();
  const session = activeSession(opts.root, now);
  if (!session || !session.token) return json(409, { error: "Live mode is off" });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json(400, { error: "Invalid JSON" });
  }
  if (typeof body.token !== "string" || !sameToken(body.token, session.token)) return json(403, { error: "forbidden" });
  const kind = body.kind;
  const slug = body.slug;
  const variant = body.variant;
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (kind !== "change" && kind !== "choose" && kind !== "palette") return json(400, { error: "kind must be change, choose or palette" });
  if (typeof slug !== "string" || !SLUG.test(slug) || slug !== session.slug) return json(400, { error: "Unknown screen" });
  if (typeof variant !== "string" || !VARIANT.test(variant)) return json(400, { error: "Unknown variant" });
  if (text.length > MAX_TEXT || (kind === "change" && text.length === 0)) {
    return json(400, { error: `Write the change (1 to ${MAX_TEXT} characters)` });
  }
  const palette = kind === "palette" ? cleanPalette(body.palette, readPalette(opts.root)) : null;
  if (kind === "palette" && !palette) return json(400, { error: "Invalid palette" });
  const targets = kind === "change" ? cleanTargets(body.targets) : [];
  if (targets === null) return json(400, { error: `Point at up to ${MAX_TARGETS} elements` });

  const entry: LiveRequest = {
    id: `req-${now.getTime()}-${randomUUID().slice(0, 8)}`,
    at: now.toISOString(),
    kind,
    slug,
    variant,
    text: kind === "choose" ? "" : text,
  };
  if (targets.length) entry.targets = targets;
  if (palette) entry.palette = palette;
  fs.mkdirSync(liveDir(opts.root), { recursive: true });
  fs.appendFileSync(path.join(liveDir(opts.root), "requests.jsonl"), JSON.stringify(entry) + "\n");
  return json(202, { id: entry.id });
}
