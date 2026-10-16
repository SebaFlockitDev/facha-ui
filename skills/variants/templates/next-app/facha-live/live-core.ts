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
 *
 * The facha-ui center (B-042) opens a session for the whole project (`scope: "project"`): requests
 * for any screen, "run" (propose variants of a screen) and "upload" (a reference image, saved in
 * `.facha-ui/references/`). It never starts /facha-ui:init or /facha-ui:apply: only the developer does.
 */

export interface LiveOptions {
  /** Project root (the Next dev server's cwd). */
  root: string;
  production: boolean;
  /**
   * The dev server's own URL, used when facha-ui.config.json does not set preview.baseUrl. The Vite
   * plugin passes the URL it is really listening on; Next keeps the config (or port 3000).
   */
  baseUrl?: string;
  now?: () => Date;
}

interface Session {
  /** The screen of a per-screen session; absent in a project session. */
  slug?: string;
  /** "project": the center's session, for every screen (B-042). */
  scope?: "project";
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
  tokens: { name: string; role?: string; format?: "hsl-channels"; values: Record<string, string> }[];
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
  kind: "change" | "choose" | "palette" | "vote" | "run";
  /** A "run" from the center: one variant instead of three. */
  quick?: boolean;
  /** A "run" from the center: a reference for the structure (an uploaded image or a URL). */
  reference?: string;
  /** Who voted, for a "vote" (the reason goes in `text`). */
  voter?: string;
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
/** Tokens kept from the palette base: colors, radii and control heights (B-031). */
const MAX_BASE_TOKENS = 120;
/** Reference images from the center: PNG, JPEG or WebP, by their first bytes, up to 5 MB. */
const MAX_UPLOAD = 5 * 1024 * 1024;
const REFERENCE_FILE = /^\.facha-ui\/references\/[\w.-]{1,80}\.(png|jpe?g|webp)$/;
const REFERENCE_URL = /^https?:\/\/[^\s"'<>]{1,300}$/;
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

function baseUrlOf(root: string, fallback?: string): URL {
  const config = readJson<{ preview?: { baseUrl?: string } }>(path.join(root, "facha-ui.config.json"));
  try {
    return new URL(config?.preview?.baseUrl ?? fallback ?? "http://localhost:3000");
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
  if (!session || session.active !== true || (session.scope !== "project" && typeof session.slug !== "string")) return null;
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
  for (const t of Array.isArray(raw.tokens) ? raw.tokens.slice(0, MAX_BASE_TOKENS) : []) {
    if (!t || typeof t.name !== "string" || !TOKEN.test(t.name) || !t.values || typeof t.values !== "object") continue;
    const values: Record<string, string> = {};
    for (const [theme, value] of Object.entries(t.values as Record<string, unknown>)) {
      if (themeNames.has(theme) && typeof value === "string" && VALUE.test(value)) values[theme] = value;
    }
    // shadcn/ui's bare HSL channels keep their mark, so the panel reads and writes them as such (B-038).
    if (Object.keys(values).length) tokens.push({ name: t.name, role: oneLine(t.role, 40), ...(t.format === "hsl-channels" ? { format: "hsl-channels" } : {}), values });
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

const RUN_STATUS = new Set(["valid", "failed"]);

/** What the compare page needs from a run: the goal and each variant's hypothesis and status. */
function runInfo(root: string, slug: string) {
  const run = readJson<Record<string, unknown>>(path.join(root, ".facha-ui", "runs", `${slug}.json`));
  if (!run || !Array.isArray(run.variants)) return null;
  const variants = (run.variants as Record<string, unknown>[])
    .filter((v) => typeof v?.id === "string" && VARIANT.test(v.id))
    .slice(0, 12)
    .map((v) => ({
      id: v.id as string,
      hypothesis: oneLine(v.hypothesis, 300) ?? "",
      status: typeof v.status === "string" && RUN_STATUS.has(v.status) ? v.status : "valid",
      revision: typeof v.revision === "number" ? v.revision : 0,
    }));
  return { slug, objective: oneLine(run.objective, 300) ?? "", status: oneLine(run.status, 20) ?? "", variants };
}

/** What the center shows, written by the center skill in .facha-ui/live/center.json; each field checked. */
function readCenter(root: string) {
  const file = path.join(liveDir(root), "center.json");
  try {
    if (fs.statSync(file).size > 256 * 1024) return null;
  } catch {
    return null;
  }
  const raw = readJson<Record<string, any>>(file);
  if (!raw || typeof raw !== "object") return null;
  const num = (v: unknown, max = 100) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max ? v : null);
  const ratio = (v: unknown) => (v === null ? null : num(v, 1));
  const screens = (Array.isArray(raw.screens) ? raw.screens : [])
    .filter((s: any) => s && typeof s.slug === "string" && SLUG.test(s.slug))
    .slice(0, 60)
    .map((s: any) => ({
      slug: s.slug as string,
      file: oneLine(s.file, 200) ?? "",
      route: oneLine(s.route, 120) ?? null,
      score: num(s.score),
      worst: s.worst ? { rule: oneLine(s.worst.rule, 60) ?? "", message: oneLine(s.worst.message, 240) ?? "", at: oneLine(s.worst.at, 200) ?? "" } : null,
      variants: Array.isArray(s.variants) ? s.variants.filter((v: unknown) => typeof v === "string" && VARIANT.test(v)).slice(0, 12) : [],
    }));
  const p = raw.project && typeof raw.project === "object" ? raw.project : {};
  return {
    at: oneLine(raw.at, 40) ?? null,
    lab: oneLine(raw.lab, 120) ?? null,
    project: {
      score: num(p.score),
      designSystem: oneLine(p.designSystem, 20) ?? null,
      missing: Array.isArray(p.missing) ? p.missing.map((m: unknown) => oneLine(m, 40)).filter(Boolean).slice(0, 20) : [],
      contrast: p.contrast ? { pairs: num(p.contrast.pairs, 10000), failing: num(p.contrast.failing, 10000) } : null,
      coverage: p.coverage ? { components: ratio(p.coverage.components ?? null), tokens: ratio(p.coverage.tokens ?? null) } : null,
    },
    screens,
  };
}

/** The image kind of an upload, by its first bytes (never by its name), or null. */
function imageKind(bytes: Buffer): "png" | "jpg" | "webp" | null {
  if (bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes.length > 12 && bytes.subarray(0, 4).toString("latin1") === "RIFF" && bytes.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
  return null;
}

/** The votes recorded for a screen, newest last. */
function votesOf(root: string, slug: string) {
  return readRequests(root)
    .filter((r) => r.kind === "vote" && r.slug === slug)
    .map((r) => ({ id: r.id, at: r.at, voter: r.voter ?? "", variant: r.variant, reason: r.text }));
}

export function handleGet(req: Request, opts: LiveOptions): Response {
  if (opts.production) return new Response("Not found", { status: 404 });
  if (!sameOrigin(req, baseUrlOf(opts.root, opts.baseUrl))) return json(403, { error: "forbidden" });
  const now = opts.now?.() ?? new Date();
  const session = activeSession(opts.root, now);
  const palette = readPalette(opts.root);
  // The compare page asks for one run: its variants and the team's votes.
  const runSlug = new URL(req.url).searchParams.get("run");
  const compare = runSlug && SLUG.test(runSlug) ? { run: runInfo(opts.root, runSlug), votes: votesOf(opts.root, runSlug) } : {};
  const center = readCenter(opts.root);
  if (!session) return json(200, { active: false, palette, center, ...compare });
  if (!session.token) {
    session.token = randomUUID();
    fs.writeFileSync(path.join(liveDir(opts.root), "session.json"), JSON.stringify(session, null, 2) + "\n");
  }
  const status = readJson<{ requests?: Record<string, unknown> }>(path.join(liveDir(opts.root), "status.json"))?.requests ?? {};
  const project = session.scope === "project";
  const requests = readRequests(opts.root)
    .filter((r) => project || r.slug === session.slug)
    .slice(project ? -60 : -20)
    .map((r) => ({ ...r, status: status[r.id] ?? { state: "queued" } }));
  return json(200, {
    active: true,
    token: session.token,
    scope: project ? "project" : "screen",
    slug: session.slug ?? null,
    expiresAt: session.expiresAt ?? null,
    requests,
    palette,
    center,
    ...compare,
  });
}

export async function handlePost(req: Request, opts: LiveOptions): Promise<Response> {
  if (opts.production) return new Response("Not found", { status: 404 });
  if (!sameOrigin(req, baseUrlOf(opts.root, opts.baseUrl))) return json(403, { error: "forbidden" });
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
  const project = session.scope === "project";

  // An image for a reference: saved, not a request for Claude Code.
  if (kind === "upload") {
    if (!project) return json(400, { error: "Uploads need the facha-ui center" });
    const data = typeof body.data === "string" ? body.data.replace(/^data:image\/[\w+.-]+;base64,/, "") : "";
    if (!data || data.length > Math.ceil((MAX_UPLOAD * 4) / 3) + 4 || !/^[A-Za-z0-9+/]+=*$/.test(data)) return json(413, { error: "An image of up to 5 MB" });
    const bytes = Buffer.from(data, "base64");
    const ext = imageKind(bytes);
    if (!ext || bytes.length > MAX_UPLOAD) return json(415, { error: "Only PNG, JPEG or WebP images, up to 5 MB" });
    const dir = path.join(opts.root, ".facha-ui", "references");
    fs.mkdirSync(dir, { recursive: true });
    const name = `upload-${now.toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 6)}.${ext}`;
    fs.writeFileSync(path.join(dir, name), bytes);
    return json(201, { path: `.facha-ui/references/${name}` });
  }

  // Propose variants of a screen, from the center.
  if (kind === "run") {
    if (!project) return json(400, { error: "Runs need the facha-ui center" });
    const screens = readCenter(opts.root)?.screens ?? [];
    if (typeof slug !== "string" || !screens.some((s) => s.slug === slug)) return json(400, { error: "Unknown screen" });
    if (text.length > MAX_TEXT) return json(400, { error: `The goal goes up to ${MAX_TEXT} characters` });
    const ref = typeof body.reference === "string" ? body.reference.trim() : "";
    const refOk = !ref || (REFERENCE_FILE.test(ref) && fs.existsSync(path.join(opts.root, ref))) || REFERENCE_URL.test(ref);
    if (!refOk) return json(400, { error: "The reference is an uploaded image or an http(s) URL" });
    const entry: LiveRequest = { id: `req-${now.getTime()}-${randomUUID().slice(0, 8)}`, at: now.toISOString(), kind, slug, variant: "", text, quick: body.quick === true };
    if (ref) entry.reference = ref;
    fs.mkdirSync(liveDir(opts.root), { recursive: true });
    fs.appendFileSync(path.join(liveDir(opts.root), "requests.jsonl"), JSON.stringify(entry) + "\n");
    return json(202, { id: entry.id });
  }

  if (kind !== "change" && kind !== "choose" && kind !== "palette" && kind !== "vote") {
    return json(400, { error: "kind must be change, choose, palette, vote, run or upload" });
  }
  const voter = kind === "vote" ? oneLine(body.voter, 40) : undefined;
  if (kind === "vote" && (!voter || text.length === 0 || text.length > 500)) {
    return json(400, { error: "A vote needs your name and a reason (up to 500 characters)" });
  }
  if (typeof slug !== "string" || !SLUG.test(slug) || (!project && slug !== session.slug)) return json(400, { error: "Unknown screen" });
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
  if (voter) entry.voter = voter;
  fs.mkdirSync(liveDir(opts.root), { recursive: true });
  fs.appendFileSync(path.join(liveDir(opts.root), "requests.jsonl"), JSON.stringify(entry) + "\n");
  return json(202, { id: entry.id });
}
