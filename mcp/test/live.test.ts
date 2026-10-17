import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const TEMPLATES = path.join(REPO, "skills", "variants", "templates", "next-app");
const WATCHER = path.join(REPO, "skills", "variants", "scripts", "live-watch.mjs");

type Core = {
  handleGet: (req: Request, opts: { root: string; production: boolean; baseUrl?: string; now?: () => Date }) => Response;
  handlePost: (req: Request, opts: { root: string; production: boolean; now?: () => Date }) => Promise<Response>;
};
let core: Core;
beforeAll(async () => {
  core = (await import(pathToFileURL(path.join(TEMPLATES, "facha-live", "live-core.ts")).href)) as Core;
});

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length) fs.rmSync(dirs.pop()!, { recursive: true, force: true });
});

/** A project with a live session for "orders". */
function project(session: Record<string, unknown> | null = { slug: "orders", active: true }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "facha-live-"));
  dirs.push(root);
  fs.writeFileSync(path.join(root, "facha-ui.config.json"), JSON.stringify({ version: 1, preview: { baseUrl: "http://localhost:3000" } }));
  fs.mkdirSync(path.join(root, ".facha-ui", "live"), { recursive: true });
  if (session) fs.writeFileSync(path.join(root, ".facha-ui", "live", "session.json"), JSON.stringify(session));
  return root;
}

const URL_ = "http://localhost:3000/lab/facha-live";
const get = (headers: Record<string, string> = {}, url = URL_) => new Request(url, { headers });
const post = (body: unknown, headers: Record<string, string> = {}, url = URL_) =>
  new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3000", "sec-fetch-site": "same-origin", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

async function tokenOf(root: string) {
  const res = core.handleGet(get({ "sec-fetch-site": "same-origin" }), { root, production: false });
  return ((await res.json()) as { token: string }).token;
}

describe("live endpoint · GET", () => {
  it("says the live mode is off when there is no active session", async () => {
    const root = project(null);
    const res = core.handleGet(get(), { root, production: false });
    expect(await res.json()).toEqual({ active: false, palette: null, center: null });
  });

  it("issues a session token once and lists the requests of that screen with their status", async () => {
    const root = project();
    const token = await tokenOf(root);
    expect(token).toMatch(/^[0-9a-f-]{36}$/);
    expect(await tokenOf(root)).toBe(token);
    await core.handlePost(post({ token, kind: "change", slug: "orders", variant: "b", text: "add a counter" }), { root, production: false });
    const id = JSON.parse(fs.readFileSync(path.join(root, ".facha-ui", "live", "requests.jsonl"), "utf8").trim()).id;
    fs.writeFileSync(path.join(root, ".facha-ui", "live", "status.json"), JSON.stringify({ requests: { [id]: { state: "done", revision: 1 } } }));
    const body = (await core.handleGet(get(), { root, production: false }).json()) as any;
    expect(body.requests).toEqual([expect.objectContaining({ id, variant: "b", text: "add a counter", status: { state: "done", revision: 1 } })]);
  });

  it("refuses other origins, other hosts (DNS rebinding) and production", async () => {
    const root = project();
    expect(core.handleGet(get({ origin: "https://evil.example" }), { root, production: false }).status).toBe(403);
    expect(core.handleGet(get({ "sec-fetch-site": "cross-site" }), { root, production: false }).status).toBe(403);
    expect(core.handleGet(get({}, "http://evil.example:3000/lab/facha-live"), { root, production: false }).status).toBe(403);
    expect(core.handleGet(get(), { root, production: true }).status).toBe(404);
  });

  it("treats an expired session as off", async () => {
    const root = project({ slug: "orders", active: true, expiresAt: "2020-01-01T00:00:00Z" });
    expect(await core.handleGet(get(), { root, production: false }).json()).toEqual({ active: false, palette: null, center: null });
  });
});

describe("live endpoint · POST", () => {
  it("appends a valid change request and returns its id", async () => {
    const root = project();
    const token = await tokenOf(root);
    const res = await core.handlePost(post({ token, kind: "change", slug: "orders", variant: "b", text: "  move the filters up  " }), { root, production: false });
    expect(res.status).toBe(202);
    const line = JSON.parse(fs.readFileSync(path.join(root, ".facha-ui", "live", "requests.jsonl"), "utf8").trim());
    expect(line).toMatchObject({ id: ((await res.json()) as any).id, kind: "change", slug: "orders", variant: "b", text: "move the filters up" });
  });

  it("accepts choose without text (it never applies anything)", async () => {
    const root = project();
    const token = await tokenOf(root);
    const res = await core.handlePost(post({ token, kind: "choose", slug: "orders", variant: "b2" }), { root, production: false });
    expect(res.status).toBe(202);
  });

  it("refuses a wrong token, other origins, other hosts, non-JSON bodies and production", async () => {
    const root = project();
    const token = await tokenOf(root);
    const ok = { token, kind: "change", slug: "orders", variant: "b", text: "x" };
    const opts = { root, production: false };
    expect((await core.handlePost(post({ ...ok, token: "nope" }), opts)).status).toBe(403);
    expect((await core.handlePost(post(ok, { origin: "https://evil.example" }), opts)).status).toBe(403);
    expect((await core.handlePost(post(ok, { "sec-fetch-site": "cross-site" }), opts)).status).toBe(403);
    expect((await core.handlePost(post(ok, {}, "http://evil.example:3000/lab/facha-live"), opts)).status).toBe(403);
    expect((await core.handlePost(post(ok, { "content-type": "text/plain" }), opts)).status).toBe(415);
    expect((await core.handlePost(post(ok), { root, production: true })).status).toBe(404);
    expect(fs.existsSync(path.join(root, ".facha-ui", "live", "requests.jsonl"))).toBe(false);
  });

  it("validates the request", async () => {
    const root = project();
    const token = await tokenOf(root);
    const opts = { root, production: false };
    const base = { token, kind: "change", slug: "orders", variant: "b", text: "x" };
    expect((await core.handlePost(post({ ...base, kind: "apply" }), opts)).status).toBe(400);
    expect((await core.handlePost(post({ ...base, slug: "other" }), opts)).status).toBe(400);
    expect((await core.handlePost(post({ ...base, variant: "../a" }), opts)).status).toBe(400);
    expect((await core.handlePost(post({ ...base, text: "   " }), opts)).status).toBe(400);
    expect((await core.handlePost(post({ ...base, text: "x".repeat(2001) }), opts)).status).toBe(400);
    expect((await core.handlePost(post("{not json"), opts)).status).toBe(400);
  });

  it("keeps only the known fields of the pointed elements, cleaned and capped", async () => {
    const root = project();
    const token = await tokenOf(root);
    const target = {
      tag: "button",
      selector: "section > div.card > nav > button:nth-of-type(2)",
      text: "Siguiente\n\u0000 página",
      owner: "Pagination",
      components: ["Pagination", "AppShell", "not a name!", 42],
      source: "app/lab/orders/b/page.tsx:84",
      rect: { x: 10.4, y: "20", width: 80, height: 32 },
      onclick: "alert(1)",
      label: "x".repeat(500),
    };
    const res = await core.handlePost(post({ token, kind: "change", slug: "orders", variant: "b", text: "move [1] up", targets: [target] }), { root, production: false });
    expect(res.status).toBe(202);
    const line = JSON.parse(fs.readFileSync(path.join(root, ".facha-ui", "live", "requests.jsonl"), "utf8").trim());
    expect(line.targets).toEqual([
      {
        tag: "button",
        selector: "section > div.card > nav > button:nth-of-type(2)",
        text: "Siguiente página",
        label: "x".repeat(120),
        owner: "Pagination",
        components: ["Pagination", "AppShell"],
        source: "app/lab/orders/b/page.tsx:84",
        rect: { x: 10, y: 20, width: 80, height: 32 },
      },
    ]);
  });

  it("refuses more than 3 pointed elements or one without a valid tag", async () => {
    const root = project();
    const token = await tokenOf(root);
    const opts = { root, production: false };
    const base = { token, kind: "change", slug: "orders", variant: "b", text: "x" };
    expect((await core.handlePost(post({ ...base, targets: Array(4).fill({ tag: "div" }) }), opts)).status).toBe(400);
    expect((await core.handlePost(post({ ...base, targets: [{ tag: "<script>" }] }), opts)).status).toBe(400);
    expect((await core.handlePost(post({ ...base, targets: "div" }), opts)).status).toBe(400);
  });

  it("refuses requests when the live mode is off", async () => {
    const root = project();
    const token = await tokenOf(root);
    fs.writeFileSync(path.join(root, ".facha-ui", "live", "session.json"), JSON.stringify({ slug: "orders", active: false, token }));
    const res = await core.handlePost(post({ token, kind: "change", slug: "orders", variant: "b", text: "x" }), { root, production: false });
    expect(res.status).toBe(409);
  });
});

describe("live endpoint · palette", () => {
  const base = {
    version: 1,
    anchor: "--brand",
    themes: [
      { name: "light", selector: ":root" },
      { name: "dark", selector: "html.dark" },
      { name: "evil", selector: ":root } body { display: none" },
    ],
    tokens: [
      { name: "--brand", role: "accent.primary", values: { light: "#4f46e5", dark: "#818cf8" } },
      { name: "--surface", role: "surface.base", values: { light: "#f8fafc", dark: "#161b22", evil: "#000" } },
      { name: "--bad", role: "accent", values: { light: "red; } body { display: none" } },
    ],
    references: [{ where: "app/globals.css:272 (.chip-PAID)", values: ["#dcf7e6", "url(x)"] }],
  };
  const withPalette = () => {
    const root = project();
    fs.writeFileSync(path.join(root, ".facha-ui", "live", "palette.json"), JSON.stringify(base));
    return root;
  };

  it("serves the palette base with only safe themes, tokens and values", async () => {
    const root = withPalette();
    const body = (await core.handleGet(get(), { root, production: false }).json()) as any;
    expect(body.palette.themes.map((t: any) => t.name)).toEqual(["light", "dark"]);
    expect(body.palette.tokens.map((t: any) => t.name)).toEqual(["--brand", "--surface"]);
    expect(body.palette.tokens[1].values).toEqual({ light: "#f8fafc", dark: "#161b22" });
    expect(body.palette.references).toEqual([{ where: "app/globals.css:272 (.chip-PAID)", values: ["#dcf7e6"] }]);
  });

  it("accepts a proposal with new values of existing tokens", async () => {
    const root = withPalette();
    const token = await tokenOf(root);
    const palette = { name: "Azul confianza", tokens: { "--brand": { light: "#0048cc", dark: "#3a58fc" }, "--surface": { light: "#f1f5fe" } } };
    const res = await core.handlePost(post({ token, kind: "palette", slug: "orders", variant: "a", palette }), { root, production: false });
    expect(res.status).toBe(202);
    const line = JSON.parse(fs.readFileSync(path.join(root, ".facha-ui", "live", "requests.jsonl"), "utf8").trim());
    expect(line).toMatchObject({ kind: "palette", text: "", palette });
  });

  it("serves radius and control-height tokens and accepts a proposal that changes them (B-031)", async () => {
    const root = project();
    const shapes = {
      ...base,
      tokens: [
        ...base.tokens,
        { name: "--radius", role: "radius", values: { light: "8px", dark: "8px" } },
        { name: "--size-control", role: "generic", values: { light: "2.5rem" } },
        ...Array.from({ length: 90 }, (_, i) => ({ name: `--gray-${i}`, role: "surface.raised", values: { light: "#f8fafc" } })),
      ],
    };
    fs.writeFileSync(path.join(root, ".facha-ui", "live", "palette.json"), JSON.stringify(shapes));
    const body = (await core.handleGet(get(), { root, production: false }).json()) as any;
    expect(body.palette.tokens.map((t: any) => t.name).slice(0, 4)).toEqual(["--brand", "--surface", "--radius", "--size-control"]);
    expect(body.palette.tokens).toHaveLength(2 + 2 + 90);
    const token = await tokenOf(root);
    const palette = {
      name: "Índigo · radio 12px · controles 48px",
      tokens: { "--brand": { light: "#3e63dd" }, "--radius": { light: "12px", dark: "12px" }, "--size-control": { light: "48px" } },
    };
    const res = await core.handlePost(post({ token, kind: "palette", slug: "orders", variant: "a", palette }), { root, production: false });
    expect(res.status).toBe(202);
    const line = JSON.parse(fs.readFileSync(path.join(root, ".facha-ui", "live", "requests.jsonl"), "utf8").trim());
    expect(line.palette).toEqual(palette);
  });

  it("keeps the hsl-channels mark of a token and accepts channel and oklch values (B-038)", async () => {
    const root = project();
    const shadcn = {
      ...base,
      tokens: [
        { name: "--brand", role: "accent.primary", format: "hsl-channels", values: { light: "221.2 83.2% 53.3%" } },
        { name: "--surface", role: "surface.base", format: "something-else", values: { light: "oklch(1 0 0)" } },
      ],
    };
    fs.writeFileSync(path.join(root, ".facha-ui", "live", "palette.json"), JSON.stringify(shadcn));
    const body = (await core.handleGet(get(), { root, production: false }).json()) as any;
    expect(body.palette.tokens[0]).toMatchObject({ format: "hsl-channels" });
    expect(body.palette.tokens[1].format).toBeUndefined();
    const token = await tokenOf(root);
    const palette = { name: "Teal", tokens: { "--brand": { light: "174.3 80.4% 40%" }, "--surface": { light: "oklch(0.985 0.003 182)" } } };
    const res = await core.handlePost(post({ token, kind: "palette", slug: "orders", variant: "a", palette }), { root, production: false });
    expect(res.status).toBe(202);
  });

  it("refuses unknown tokens or themes, CSS injection and proposals without a base", async () => {
    const root = withPalette();
    const token = await tokenOf(root);
    const opts = { root, production: false };
    const send = (palette: unknown) => core.handlePost(post({ token, kind: "palette", slug: "orders", variant: "a", palette }), opts);
    expect((await send({ name: "x", tokens: { "--nope": { light: "#000000" } } })).status).toBe(400);
    expect((await send({ name: "x", tokens: { "--brand": { sepia: "#000000" } } })).status).toBe(400);
    expect((await send({ name: "x", tokens: { "--brand": { light: "red; } body { display: none" } } })).status).toBe(400);
    expect((await send({ name: "x", tokens: { "--brand": { light: "url(https://evil.example/x)" } } })).status).toBe(400);
    expect((await send({ name: "x", base: "red", tokens: { "--brand": { light: "#000000" } } })).status).toBe(400);
    expect((await send({ name: "x", tokens: {} })).status).toBe(400);
    fs.rmSync(path.join(root, ".facha-ui", "live", "palette.json"));
    expect((await send({ name: "x", tokens: { "--brand": { light: "#000000" } } })).status).toBe(400);
  });
});

describe("live endpoint · the facha-ui center (B-042)", () => {
  const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 1)]);
  const center = (root: string, extra: Record<string, unknown> = {}) =>
    fs.writeFileSync(
      path.join(root, ".facha-ui", "live", "center.json"),
      JSON.stringify({
        version: 1,
        at: "2026-10-16T20:00:00-03:00",
        project: { score: 72, designSystem: "partial", missing: ["status.info"], contrast: { pairs: 20, failing: 2 }, coverage: { components: 0.5, tokens: 0.9 } },
        screens: [
          { slug: "orders", file: "src/pages/Orders.tsx", route: "/orders", score: 61, worst: { rule: "theme-contrast", message: "Texto tenue", at: "src/index.css:12" }, variants: ["a"] },
          { slug: "evil slug", file: "x" },
        ],
        ...extra,
      }),
    );
  const projectRoot = () => {
    const root = project({ scope: "project", active: true });
    center(root);
    return root;
  };
  const opts = (root: string) => ({ root, production: false });

  it("serves the center's state, keeping only valid screens", async () => {
    const root = projectRoot();
    const body = (await core.handleGet(get(), opts(root)).json()) as any;
    expect(body).toMatchObject({ active: true, scope: "project", slug: null });
    expect(body.center.project).toMatchObject({ score: 72, designSystem: "partial", contrast: { pairs: 20, failing: 2 } });
    expect(body.center.screens.map((x: any) => x.slug)).toEqual(["orders"]);
  });

  it("a project session takes the panel's requests of any screen", async () => {
    const root = projectRoot();
    const token = await tokenOf(root);
    const res = await core.handlePost(post({ token, kind: "change", slug: "invoices", variant: "a", text: "mové los filtros arriba" }), opts(root));
    expect(res.status).toBe(202);
  });

  it("takes a run for a screen of the center, with a goal, quick mode and a reference", async () => {
    const root = projectRoot();
    const token = await tokenOf(root);
    const res = await core.handlePost(post({ token, kind: "run", slug: "orders", text: "que se vean primero los pendientes", quick: true, reference: "https://example.com/dashboard" }), opts(root));
    expect(res.status).toBe(202);
    const line = JSON.parse(fs.readFileSync(path.join(root, ".facha-ui", "live", "requests.jsonl"), "utf8").trim());
    expect(line).toMatchObject({ kind: "run", slug: "orders", text: "que se vean primero los pendientes", quick: true, reference: "https://example.com/dashboard" });
    expect((await core.handlePost(post({ token, kind: "run", slug: "unknown" }), opts(root))).status).toBe(400);
    expect((await core.handlePost(post({ token, kind: "run", slug: "orders", reference: "../../etc/passwd" }), opts(root))).status).toBe(400);
    expect((await core.handlePost(post({ token, kind: "run", slug: "orders", reference: "javascript:alert(1)" }), opts(root))).status).toBe(400);
  });

  it("saves an uploaded PNG in .facha-ui/references and lets a run use it", async () => {
    const root = projectRoot();
    const token = await tokenOf(root);
    const res = await core.handlePost(post({ token, kind: "upload", data: "data:image/png;base64," + PNG.toString("base64") }), opts(root));
    expect(res.status).toBe(201);
    const { path: saved } = (await res.json()) as { path: string };
    expect(saved).toMatch(/^\.facha-ui\/references\/upload-.+\.png$/);
    expect(fs.readFileSync(path.join(root, saved)).equals(PNG)).toBe(true);
    expect((await core.handlePost(post({ token, kind: "run", slug: "orders", reference: saved }), opts(root))).status).toBe(202);
  });

  it("refuses an upload that is not an image (whatever its name), too big, without the token or outside a project session", async () => {
    const root = projectRoot();
    const token = await tokenOf(root);
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString("base64");
    expect((await core.handlePost(post({ token, kind: "upload", data: "data:image/png;base64," + svg }), opts(root))).status).toBe(415);
    const big = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]).toString("base64");
    expect((await core.handlePost(post({ token, kind: "upload", data: big }), opts(root))).status).toBe(413);
    expect((await core.handlePost(post({ token: "x", kind: "upload", data: PNG.toString("base64") }), opts(root))).status).toBe(403);
    expect((await core.handlePost(post({ token, kind: "upload", data: PNG.toString("base64") }), { root, production: true })).status).toBe(404);
    const screenRoot = project();
    const screenToken = await tokenOf(screenRoot);
    expect((await core.handlePost(post({ token: screenToken, kind: "upload", data: PNG.toString("base64") }), opts(screenRoot))).status).toBe(400);
    expect((await core.handlePost(post({ token: screenToken, kind: "run", slug: "orders" }), opts(screenRoot))).status).toBe(400);
    expect(fs.existsSync(path.join(root, ".facha-ui", "references")) ? fs.readdirSync(path.join(root, ".facha-ui", "references")) : []).toEqual([]);
  });
});

describe("live endpoint · the center, live (B-044)", () => {
  const NOW = new Date("2026-10-16T21:00:00.000Z");
  const opts = (root: string) => ({ root, production: false, now: () => NOW });
  const beat = (root: string, beat: Record<string, unknown>) =>
    fs.writeFileSync(path.join(root, ".facha-ui", "live", "listener.json"), JSON.stringify(beat));
  const seconds = (n: number) => new Date(NOW.getTime() - n * 1000).toISOString();
  const listeningOf = async (root: string) => ((await core.handleGet(get(), opts(root)).json()) as any).listening;

  it("says Claude Code is listening only while the watcher's heartbeat is fresh", async () => {
    const root = project({ scope: "project", active: true });
    expect(await listeningOf(root)).toBe(false); // no heartbeat yet
    beat(root, { at: seconds(5) });
    expect(await listeningOf(root)).toBe(true);
    beat(root, { at: seconds(60) });
    expect(await listeningOf(root)).toBe(false); // the conversation was closed
    beat(root, { at: seconds(1), stopped: true });
    expect(await listeningOf(root)).toBe(false);
    beat(root, { at: "not a date" });
    expect(await listeningOf(root)).toBe(false);
  });

  it("without a session there is nothing to listen to", async () => {
    const root = project(null);
    beat(root, { at: seconds(1) });
    const body = (await core.handleGet(get(), opts(root)).json()) as any;
    expect(body.active).toBe(false);
    expect(body.listening).toBeUndefined();
  });

  it("takes a measure request only in a project session", async () => {
    const root = project({ scope: "project", active: true });
    const token = await tokenOf(root);
    const res = await core.handlePost(post({ token, kind: "measure" }), opts(root));
    expect(res.status).toBe(202);
    const line = JSON.parse(fs.readFileSync(path.join(root, ".facha-ui", "live", "requests.jsonl"), "utf8").trim());
    expect(line).toMatchObject({ kind: "measure", slug: "", variant: "", text: "" });
    const screen = project();
    const screenToken = await tokenOf(screen);
    expect((await core.handlePost(post({ token: screenToken, kind: "measure" }), opts(screen))).status).toBe(400);
  });

  it("serves the project's earlier measures and each screen's previous score, cleaned", async () => {
    const root = project({ scope: "project", active: true });
    fs.writeFileSync(
      path.join(root, ".facha-ui", "live", "center.json"),
      JSON.stringify({
        version: 1,
        at: NOW.toISOString(),
        project: { score: 74 },
        history: [
          ...Array.from({ length: 30 }, (_, i) => ({ at: seconds(3600 * (30 - i)), score: 40 + i })),
          { at: "nope", score: 50 },
          { at: seconds(10), score: 300 },
        ],
        screens: [{ slug: "orders", file: "src/pages/Orders.tsx", score: 70, previous: 61, variants: [] }, { slug: "list", file: "x", score: 50, previous: "61" }],
      }),
    );
    const body = (await core.handleGet(get(), opts(root)).json()) as any;
    expect(body.center.history).toHaveLength(24);
    expect(body.center.history.at(-1)).toEqual({ at: seconds(3600), score: 69 });
    expect(body.center.screens.map((x: any) => x.previous)).toEqual([61, null]);
  });
});

describe("palette base script", () => {
  it("prints the themes, the color tokens and the anchor from get_design_system", async () => {
    const script = path.join(REPO, "skills", "variants", "scripts", "palette-base.mjs");
    const fixture = path.join(REPO, "mcp", "test", "fixtures", "next-visual");
    const out = await new Promise<string>((resolve, reject) => {
      const child = spawn(process.execPath, [script, fixture, "--anchor", "--primary"], { stdio: ["ignore", "pipe", "ignore"] });
      let text = "";
      child.stdout.on("data", (d) => (text += d));
      child.on("exit", (code) => (code === 0 ? resolve(text) : reject(new Error(`exit ${code}`))));
    });
    const base = JSON.parse(out);
    expect(base.anchor).toBe("--primary");
    expect(base.themes.length).toBeGreaterThan(0);
    expect(base.tokens.some((t: any) => t.name === "--primary")).toBe(true);
    expect(base.tokens.every((t: any) => !String(t.role ?? "").startsWith("status"))).toBe(true);
    expect(Array.isArray(base.references)).toBe(true);
  }, 20000);

  it("reads oklch() and shadcn's bare HSL channels, marking the channels (B-038)", async () => {
    const script = path.join(REPO, "skills", "variants", "scripts", "palette-base.mjs");
    const run = (fixture: string) =>
      new Promise<any>((resolve, reject) => {
        const child = spawn(process.execPath, [script, path.join(REPO, "mcp", "test", "fixtures", fixture)], { stdio: ["ignore", "pipe", "ignore"] });
        let text = "";
        child.stdout.on("data", (d) => (text += d));
        child.on("exit", (code) => (code === 0 ? resolve(JSON.parse(text)) : reject(new Error(`exit ${code}`))));
      });
    const tw4 = await run("shadcn-tw4");
    expect(tw4.anchor).toBe("--primary");
    expect(tw4.tokens.find((t: any) => t.name === "--primary").values.light).toMatch(/^oklch\(/);
    const tw3 = await run("shadcn-tw3");
    expect(tw3.tokens.find((t: any) => t.name === "--primary")).toMatchObject({ format: "hsl-channels" });
  }, 20000);

  it("adds the radius tokens written in px or rem, and leaves var() and calc() radii to follow in the browser", async () => {
    const script = path.join(REPO, "skills", "variants", "scripts", "palette-base.mjs");
    const fixture = path.join(REPO, "mcp", "test", "fixtures", "next-tailwind");
    const out = await new Promise<string>((resolve, reject) => {
      const child = spawn(process.execPath, [script, fixture, "--anchor", "--primary"], { stdio: ["ignore", "pipe", "ignore"] });
      let text = "";
      child.stdout.on("data", (d) => (text += d));
      child.on("exit", (code) => (code === 0 ? resolve(text) : reject(new Error(`exit ${code}`))));
    });
    const radii = JSON.parse(out).tokens.filter((t: any) => t.role === "radius");
    expect(radii.map((t: any) => t.name)).toEqual(["--radius", "--radius-small"]);
    expect(radii[0].values.light).toBe("12px");
  }, 20000);
});

describe("live watcher", () => {
  function watch(root: string) {
    const child = spawn(process.execPath, [WATCHER, path.join(root, ".facha-ui", "live")], { stdio: ["ignore", "pipe", "pipe"] });
    const lines: any[] = [];
    let buf = "";
    child.stdout.on("data", (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        lines.push(JSON.parse(buf.slice(0, i)));
        buf = buf.slice(i + 1);
      }
    });
    const exited = new Promise<number | null>((res) => child.on("exit", res));
    return { child, lines, exited };
  }
  const until = async (cond: () => boolean, ms = 5000) => {
    const end = Date.now() + ms;
    while (!cond() && Date.now() < end) await new Promise((r) => setTimeout(r, 50));
  };

  it("prints pending and new requests, then stops when the session ends", async () => {
    const root = project();
    const live = path.join(root, ".facha-ui", "live");
    fs.writeFileSync(
      path.join(live, "requests.jsonl"),
      [
        JSON.stringify({ id: "req-1", kind: "change", slug: "orders", variant: "b", text: "already done" }),
        JSON.stringify({ id: "req-2", kind: "change", slug: "orders", variant: "b", text: "move [1] up", targets: [{ tag: "button", text: "Siguiente" }] }),
      ].join("\n") + "\n",
    );
    fs.writeFileSync(path.join(live, "status.json"), JSON.stringify({ requests: { "req-1": { state: "done" } } }));
    const w = watch(root);
    await until(() => w.lines.length >= 1);
    expect(w.lines).toEqual([expect.objectContaining({ id: "req-2", text: "move [1] up", targets: [{ tag: "button", text: "Siguiente" }] })]);
    fs.appendFileSync(path.join(live, "requests.jsonl"), JSON.stringify({ id: "req-3", kind: "choose", slug: "orders", variant: "c", text: "" }) + "\n");
    await until(() => w.lines.length >= 2);
    expect(w.lines[1]).toMatchObject({ id: "req-3", kind: "choose", variant: "c" });
    fs.writeFileSync(path.join(live, "session.json"), JSON.stringify({ slug: "orders", active: false }));
    expect(await w.exited).toBe(0);
    expect(w.lines.at(-1)).toEqual({ kind: "stopped" });
  });

  it("leaves a heartbeat while it listens, and marks it stopped when it ends (B-044)", async () => {
    const root = project({ scope: "project", active: true });
    const live = path.join(root, ".facha-ui", "live");
    const w = watch(root);
    const read = () => {
      try {
        return JSON.parse(fs.readFileSync(path.join(live, "listener.json"), "utf8"));
      } catch {
        return null;
      }
    };
    await until(() => read() !== null);
    expect(Date.now() - Date.parse(read().at)).toBeLessThan(5000);
    expect(read().stopped).toBeUndefined();
    fs.appendFileSync(path.join(live, "requests.jsonl"), JSON.stringify({ id: "req-9", kind: "measure", slug: "", variant: "", text: "" }) + "\n");
    await until(() => w.lines.length >= 1);
    expect(w.lines[0]).toMatchObject({ id: "req-9", kind: "measure" });
    fs.writeFileSync(path.join(live, "session.json"), JSON.stringify({ scope: "project", active: false }));
    expect(await w.exited).toBe(0);
    expect(read().stopped).toBe(true);
  });

  it("exits at once when there is no active session", async () => {
    const root = project(null);
    const w = watch(root);
    expect(await w.exited).toBe(0);
    expect(w.lines).toEqual([{ kind: "stopped" }]);
  });
});

describe("compare and team votes", () => {
  const withRun = () => {
    const root = project();
    fs.mkdirSync(path.join(root, ".facha-ui", "runs"), { recursive: true });
    fs.writeFileSync(
      path.join(root, ".facha-ui", "runs", "orders.json"),
      JSON.stringify({
        runId: "orders-20261010-1000",
        objective: "que se vea primero lo pendiente",
        status: "generated",
        variants: [
          { id: "a", hypothesis: "Conservadora <b>", status: "valid", revision: 0, finalCheck: { error: 0, warning: 1, info: 0 }, screenshots: [".facha-ui/screenshots/orders/a-desktop-light.png"] },
          { id: "b", hypothesis: "Jerarquía", status: "failed", revision: 2 },
          { id: "../x", hypothesis: "bad id" },
        ],
      }),
    );
    return root;
  };

  it("serves the run's variants for the compare page, without live mode", async () => {
    const root = withRun();
    fs.writeFileSync(path.join(root, ".facha-ui", "live", "session.json"), JSON.stringify({ slug: "orders", active: false }));
    const body = (await core.handleGet(get({}, "http://localhost:3000/lab/facha-live?run=orders"), { root, production: false }).json()) as any;
    expect(body.active).toBe(false);
    expect(body.run.variants).toEqual([
      { id: "a", hypothesis: "Conservadora <b>", status: "valid", revision: 0 },
      { id: "b", hypothesis: "Jerarquía", status: "failed", revision: 2 },
    ]);
    expect(body.votes).toEqual([]);
  });

  it("records a vote with a name and a reason, and lists it for the run", async () => {
    const root = withRun();
    const token = await tokenOf(root);
    const opts = { root, production: false };
    const res = await core.handlePost(post({ token, kind: "vote", slug: "orders", variant: "a", voter: "Ana", text: "Lo pendiente se ve primero" }), opts);
    expect(res.status).toBe(202);
    const body = (await core.handleGet(get({}, "http://localhost:3000/lab/facha-live?run=orders"), opts).json()) as any;
    expect(body.votes).toEqual([expect.objectContaining({ voter: "Ana", variant: "a", reason: "Lo pendiente se ve primero" })]);
    expect((await core.handlePost(post({ token, kind: "vote", slug: "orders", variant: "a", voter: "", text: "x" }), opts)).status).toBe(400);
    expect((await core.handlePost(post({ token, kind: "vote", slug: "orders", variant: "a", voter: "Ana", text: "" }), opts)).status).toBe(400);
  });

  it("builds a shareable report that escapes the project's text", () => {
    const root = withRun();
    const out = spawnSync(process.execPath, [path.join(REPO, "skills", "variants", "scripts", "report.mjs"), root, "orders"], { encoding: "utf8" });
    expect(out.status).toBe(0);
    expect(out.stdout).toContain("Conservadora &lt;b&gt;");
    expect(out.stdout).not.toContain("Conservadora <b>");
    expect(out.stdout).toContain('src="../screenshots/orders/a-desktop-light.png"');
    expect(out.stdout).not.toMatch(/<script/i);
  });
});

describe("the Vite plugin's dev server URL", () => {
  it("is used only when the config does not set preview.baseUrl", () => {
    const root = project();
    const vite = "http://localhost:5180/facha-lab/facha-live";
    // The config says 3000: a request to Vite's 5180 is refused even if the plugin passes 5180.
    expect(core.handleGet(get({}, vite), { root, production: false, baseUrl: "http://localhost:5180" }).status).toBe(403);
    // Without preview.baseUrl, the URL the dev server really listens on is the allowed one.
    fs.writeFileSync(path.join(root, "facha-ui.config.json"), JSON.stringify({ version: 1 }));
    expect(core.handleGet(get({}, vite), { root, production: false, baseUrl: "http://localhost:5180" }).status).toBe(200);
    expect(core.handleGet(get({ origin: "http://evil.example" }, vite), { root, production: false, baseUrl: "http://localhost:5180" }).status).toBe(403);
    // And without either, the old default (3000) still rules: 5180 is refused.
    expect(core.handleGet(get({}, vite), { root, production: false }).status).toBe(403);
  });
});
