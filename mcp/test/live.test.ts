import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const TEMPLATES = path.join(REPO, "skills", "variants", "templates", "next-app");
const WATCHER = path.join(REPO, "skills", "variants", "scripts", "live-watch.mjs");

type Core = {
  handleGet: (req: Request, opts: { root: string; production: boolean; now?: () => Date }) => Response;
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
    expect(await res.json()).toEqual({ active: false, palette: null });
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
    expect(await core.handleGet(get(), { root, production: false }).json()).toEqual({ active: false, palette: null });
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
      { name: "--brand", role: "accent.primary", values: { light: "#7800C0", dark: "#9D2BD6" } },
      { name: "--surface", role: "surface.base", values: { light: "#f8f3fc", dark: "#161b22", evil: "#000" } },
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
    expect(body.palette.tokens[1].values).toEqual({ light: "#f8f3fc", dark: "#161b22" });
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

  it("exits at once when there is no active session", async () => {
    const root = project(null);
    const w = watch(root);
    expect(await w.exited).toBe(0);
    expect(w.lines).toEqual([{ kind: "stopped" }]);
  });
});
