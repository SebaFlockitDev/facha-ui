import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connect, FIXTURE } from "./helpers.js";

let h: Awaited<ReturnType<typeof connect>>;
beforeAll(async () => {
  h = await connect(FIXTURE);
});
afterAll(async () => {
  await h.close();
});

const brief = (v: any) => `${v.file}:${v.line}:${v.column} ${v.rule} ${v.severity} ${v.found} → ${v.suggestion.match} ${v.suggestion.value ?? "-"}`;

describe("MCP-1 · server surface", () => {
  it("lists exactly the 4 read-only tools and the 2 MVP resources", async () => {
    const { tools } = await h.client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["audit_project", "check_ui", "get_design_system", "review_ui", "scan_styles"]);
    for (const t of tools) {
      expect(t.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false, openWorldHint: false });
      expect(t.description).toContain("**When to use:**");
    }
    const { resources } = await h.client.listResources();
    expect(resources.map((r) => r.uri).sort()).toEqual([
      "facha-ui://design-system/rules",
      "facha-ui://design-system/tokens",
    ]);
    expect(h.client.getInstructions()).toContain("never invent a value");
  });
});

describe("get_design_system (fixture)", () => {
  it("parses tokens, configured themes, roles, coverage and decisions", async () => {
    const r = await h.call("get_design_system");
    expect(r.isError).toBeFalsy();
    const ds = r.structuredContent;
    expect(ds.configSource).toBe("facha-ui.config.json");
    expect(ds.project.themes.map((t: any) => t.name)).toEqual(["light", "dark"]);
    const byName = Object.fromEntries(ds.tokens.map((t: any) => [t.name, t]));
    expect(byName["--color-canvas"]).toMatchObject({ role: "surface.base", comment: "page background", values: { light: "#fafafa", dark: "#0b0b0c" } });
    expect(byName["--color-ink"].role).toBe("text.primary");
    expect(byName["--color-on-primary"].role).toBe("on-accent");
    expect(byName["--color-danger"].role).toBe("status.danger");
    expect(byName["--radius-md"]).toMatchObject({ type: "length", role: "radius" });
    expect(ds.coverage.requiredMissing).toEqual([]);
    expect(ds.coverage.missing).toEqual(expect.arrayContaining(["status.success", "status.warning", "status.info"]));
    expect(ds.decisions).toEqual([
      { id: "dec-2026-01-15-home", title: "Home: promo first", date: "2026-01-15", source: "design-system/decisions.md:3" },
    ]);
    expect(ds.guidelines).toEqual([{ id: "g1", text: "Cards always sit on --color-card." }]);
    expect(ds.health).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "token-contrast", token: "--color-line", status: "fails-everywhere" })]),
    );
    expect(ds).toMatchSnapshot();
  });
});

describe("check_ui (fixture)", () => {
  it("reports every rule with location and role-aware suggestions", async () => {
    const r = await h.call("check_ui", { path: "app/page.tsx" });
    expect(r.isError).toBeFalsy();
    const lines = r.structuredContent.violations.map(brief);
    expect(lines).toEqual([
      "app/page.tsx:9:42 tailwind-arbitrary-value error p-[16px] → exact p-4",
      "app/page.tsx:10:28 tailwind-arbitrary-value error text-[22px] → none -",
      "app/page.tsx:11:21 tailwind-arbitrary-value error text-[length:12px] → exact caption",
      "app/page.tsx:11:40 color-literal error bg-[#ff00aa] → none -",
      "app/page.tsx:12:47 inline-style info style={{ color: \"#333\", borderColor: \"var(--color-line)\" }} → none -",
      "app/page.tsx:12:64 color-literal error #333 → none -",
      "app/page.tsx:12:64 theme-contrast warning #333 → nearest var(--color-ink)",
      "app/page.tsx:13:27 tailwind-arbitrary-value error rounded-[8px] → exact var(--radius-md)",
      "app/page.tsx:13:54 tailwind-arbitrary-value error shadow-[0_1px_2px_rgba(0,0,0,.2)] → none -",
      "app/page.tsx:14:18 color-literal error #000 → none -",
      "app/page.tsx:14:18 non-text-contrast warning #000 → none -",
      "app/page.tsx:15:21 tailwind-arbitrary-value info text-[var(--color-primary)] → none -",
      "app/page.tsx:16:21 unknown-token error text-[var(--color-brand)] → none -",
    ]);
    expect(r.structuredContent.unresolved).toEqual([
      expect.objectContaining({ file: "app/page.tsx", line: 12, column: 30, found: "pill-${…}" }),
    ]);
    const literal = r.structuredContent.violations.find((v: any) => v.found === "#333");
    expect(literal.breaksThemes).toEqual(["dark"]);
  });

  it("suggests exact tokens and nearby token names in CSS", async () => {
    const r = await h.call("check_ui", { path: "app/globals.css" });
    const lines = r.structuredContent.violations.map(brief);
    expect(lines).toEqual([
      "app/globals.css:30:22 color-literal error #fee2e2 → none -",
      "app/globals.css:30:31 theme-contrast error var(--color-danger) → none -",
      "app/globals.css:31:9 theme-contrast warning #2563eb → nearest var(--color-primary)",
      "app/globals.css:31:16 color-literal error #2563eb → exact var(--color-primary)",
      "app/globals.css:32:28 unknown-token error var(--color-lines) → nearest var(--color-line)",
    ]);
  });

  it("validates the lab only when asked explicitly", async () => {
    const lab = await h.call("check_ui", { path: "app/lab/home/a" });
    expect(lab.structuredContent.summary.error).toBe(1);
    expect(lab.structuredContent.notes[0]).toContain("lab directory");
    const audit = await h.call("audit_project");
    expect(audit.structuredContent.byFile.map((f: any) => f.file)).not.toContain("app/lab/home/a/page.tsx");
  });

  it("is confined to the project root", async () => {
    const out = await h.call("check_ui", { path: "../../../package.json" });
    expect(out.isError).toBe(true);
    expect(out.structuredContent.code).toBe("PATH_OUTSIDE_PROJECT");
    const missing = await h.call("check_ui", { path: "app/nope.tsx" });
    expect(missing.structuredContent.code).toBe("PATH_NOT_FOUND");
  });
});

describe("audit_project (fixture)", () => {
  it("returns consistent totals (MCP-10) and is deterministic (MCP-4)", async () => {
    const a = await h.call("audit_project");
    const b = await h.call("audit_project");
    expect(JSON.stringify(a.structuredContent)).toBe(JSON.stringify(b.structuredContent));
    const s = a.structuredContent;
    const sumSev = s.totals.error + s.totals.warning + s.totals.info;
    const sumFiles = s.byFile.reduce((n: number, f: any) => n + f.error + f.warning + f.info, 0);
    const sumRules = Object.values(s.byRule).reduce(
      (n: number, r: any) => n + Object.values(r).reduce((m: number, x: any) => m + x, 0),
      0,
    );
    expect(s.totals.all).toBe(sumSev);
    expect(s.totals.all).toBe(sumFiles);
    expect(s.totals.all).toBe(sumRules);
    expect(s).toMatchSnapshot();
  });
});

describe("config validation", () => {
  it("rejects a non-loopback preview.baseUrl with a JSON pointer", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "facha-cfg-"));
    fs.writeFileSync(
      path.join(dir, "facha-ui.config.json"),
      JSON.stringify({ version: 1, preview: { baseUrl: "https://example.com" } }),
    );
    const c = await connect(dir);
    const r = await c.call("get_design_system");
    expect(r.isError).toBe(true);
    expect(r.structuredContent.code).toBe("CONFIG_INVALID");
    expect(r.structuredContent.issues[0].pointer).toBe("/preview/baseUrl");
    await c.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("evaluates custom rules and still reports vision-only keys as not evaluated", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "facha-custom-"));
    fs.writeFileSync(
      path.join(dir, "facha-ui.config.json"),
      JSON.stringify({
        version: 1,
        custom: [{ id: "no-x", kind: "forbid-class", pattern: "^x-", severity: "error", message: "no" }],
        suggest: { maxDeltaE: 3 },
      }),
    );
    const c = await connect(dir);
    const r = await c.call("get_design_system", { sections: ["project", "rules"] });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent.assumptions).toEqual(
      expect.arrayContaining([expect.stringContaining("not evaluated in this version (roadmap): suggest")]),
    );
    expect(r.structuredContent.assumptions.join(" ")).not.toContain("custom");
    expect(r.structuredContent.rules).toEqual(expect.arrayContaining([expect.objectContaining({ id: "custom/no-x", severity: "error" })]));
    await c.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("reports status missing for a project without tokens", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "facha-empty-"));
    fs.mkdirSync(path.join(dir, "app"));
    fs.writeFileSync(path.join(dir, "app", "page.tsx"), `export default () => <p className="text-[13px]">hi</p>;\n`);
    const c = await connect(dir);
    const ds = (await c.call("get_design_system")).structuredContent;
    expect(ds.status).toBe("missing");
    expect(ds.configSource).toBe("autodetected");
    const audit = (await c.call("audit_project")).structuredContent;
    expect(audit.totals.error).toBe(1);
    await c.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
