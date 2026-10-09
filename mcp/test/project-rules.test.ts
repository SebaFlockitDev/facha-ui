import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connect } from "./helpers.js";

const TAILWIND = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "next-tailwind");
const brief = (v: any) => `${v.file}:${v.line} ${v.rule} ${v.severity} ${v.found} → ${v.suggestion.match} ${v.suggestion.value ?? "-"}`;

/** A copy of the Tailwind fixture with some files replaced. */
function variant(files: Record<string, string>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "facha-tw-"));
  fs.cpSync(TAILWIND, dir, { recursive: true });
  for (const [f, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, f), text);
  return dir;
}
const baseConfig = JSON.parse(fs.readFileSync(path.join(TAILWIND, "facha-ui.config.json"), "utf8"));

let h: Awaited<ReturnType<typeof connect>>;
beforeAll(async () => {
  h = await connect(TAILWIND);
});
afterAll(async () => {
  await h.close();
});

describe("tailwind-palette-color", () => {
  it("flags default-palette utilities, with variants and opacity, and suggests the closest token", async () => {
    const r = await h.call("check_ui", { path: "app/page.tsx", rules: ["tailwind-palette-color"] });
    expect(r.structuredContent.violations.map(brief)).toEqual([
      "app/page.tsx:4 tailwind-palette-color error text-slate-900 → nearest var(--text)",
      "app/page.tsx:5 tailwind-palette-color error bg-blue-600 → none -",
      "app/page.tsx:5 tailwind-palette-color error hover:bg-blue-700 → none -",
      "app/page.tsx:5 tailwind-palette-color error border-red-500/50 → none -",
      "app/page.tsx:8 tailwind-palette-color error text-zinc-400 → none -",
    ]);
    const blue = r.structuredContent.violations.find((v: any) => v.found === "bg-blue-600");
    expect(blue.message).toContain("Tailwind's default blue-600");
    expect(blue.suggestion.detail).toContain("nearest: --primary");
    expect(r.structuredContent.violations.find((v: any) => v.found === "border-red-500/50").message).toContain("at 50 opacity");
  });

  it("allows colors mapped in @theme, project classes with palette names and non-palette utilities", async () => {
    const r = await h.call("check_ui", { path: "app/page.tsx", rules: ["tailwind-palette-color"] });
    const found = r.structuredContent.violations.map((v: any) => v.found);
    for (const ok of ["text-gray-500", "text-white", "bg-transparent", "bg-panel"]) expect(found).not.toContain(ok);
  });

  it("is off when the team adopts Tailwind's default theme on purpose", async () => {
    const dir = variant({ "facha-ui.config.json": JSON.stringify({ ...baseConfig, tailwind: { useDefaultTheme: true } }) });
    const c = await connect(dir);
    const r = await c.call("check_ui", { path: "app/page.tsx", rules: ["tailwind-palette-color"] });
    expect(r.structuredContent.violations).toEqual([]);
    const ds = await c.call("get_design_system", { sections: ["project"] });
    expect((ds.structuredContent.assumptions ?? []).join(" ")).not.toContain("tailwind");
    await c.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("does not apply to projects without Tailwind", async () => {
    const dir = variant({ "package.json": JSON.stringify({ dependencies: { next: "16.0.0", react: "19.0.0" } }) });
    const c = await connect(dir);
    const r = await c.call("check_ui", { path: "app/page.tsx", rules: ["tailwind-palette-color"] });
    expect(r.structuredContent.violations).toEqual([]);
    await c.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe("custom rules", () => {
  it("forbid-token: reports forbidden tokens only in matching selectors and properties", async () => {
    const r = await h.call("check_ui", { path: "app/globals.css" });
    const custom = r.structuredContent.violations.filter((v: any) => v.rule.startsWith("custom/"));
    expect(custom.map(brief)).toEqual(["app/globals.css:24 custom/cards-on-panel error background: var(--canvas) → none -"]);
    expect(custom[0].message).toBe("Cards sit on --panel, never on the page background.");
  });

  it("forbid-class: reports matching classes with the team's severity and message", async () => {
    const r = await h.call("check_ui", { path: "app/page.tsx" });
    const custom = r.structuredContent.violations.filter((v: any) => v.rule.startsWith("custom/"));
    expect(custom.map(brief)).toEqual(["app/page.tsx:8 custom/no-zinc warning text-zinc-400 → none -"]);
    expect(custom[0].message).toBe("Use text and surface tokens instead of zinc.");
  });

  it("are listed with the rules and counted by audit_project", async () => {
    const ds = await h.call("get_design_system", { sections: ["rules"] });
    expect(ds.structuredContent.rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "custom/cards-on-panel", severity: "error" }),
        expect.objectContaining({ id: "custom/no-zinc", severity: "warning" }),
      ]),
    );
    const audit = await h.call("audit_project");
    expect(audit.structuredContent.byRule["custom/cards-on-panel"]).toEqual({ error: 1 });
    expect(audit.structuredContent.byRule["custom/no-zinc"]).toEqual({ warning: 1 });
  });

  it("can be switched off with severity off", async () => {
    const config = { ...baseConfig, custom: baseConfig.custom.map((c: any) => ({ ...c, severity: "off" })) };
    const dir = variant({ "facha-ui.config.json": JSON.stringify(config) });
    const c = await connect(dir);
    const r = await c.call("check_ui", { path: "." });
    expect(r.structuredContent.violations.filter((v: any) => v.rule.startsWith("custom/"))).toEqual([]);
    await c.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("rejects an invalid regular expression with CONFIG_INVALID and its JSON pointer", async () => {
    const config = { ...baseConfig, custom: [{ ...baseConfig.custom[0], selector: "\\.card(" }] };
    const dir = variant({ "facha-ui.config.json": JSON.stringify(config) });
    const c = await connect(dir);
    const r = await c.call("check_ui", { path: "app/page.tsx" });
    expect(r.isError).toBe(true);
    expect(r.structuredContent.code).toBe("CONFIG_INVALID");
    expect(JSON.stringify(r.structuredContent.issues)).toContain("/custom/0/selector");
    await c.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe("tailwind-default-scale", () => {
  it("flags unmapped radius, shadow, font size, tracking and leading steps with the closest project value", async () => {
    const r = await h.call("check_ui", { path: "app/page.tsx", rules: ["tailwind-default-scale"] });
    expect(r.structuredContent.violations.map(brief)).toEqual([
      "app/page.tsx:9 tailwind-default-scale warning rounded-md → none -",
      "app/page.tsx:9 tailwind-default-scale warning shadow-md → none -",
      "app/page.tsx:9 tailwind-default-scale warning text-sm → nearest meta",
      "app/page.tsx:9 tailwind-default-scale warning tracking-wide → none -",
      "app/page.tsx:9 tailwind-default-scale warning leading-tight → none -",
      "app/page.tsx:11 tailwind-default-scale warning text-xs/5 → nearest caption",
      "app/page.tsx:11 tailwind-default-scale warning md:rounded-xl → exact var(--radius)",
    ]);
    const v = r.structuredContent.violations;
    expect(v.find((x: any) => x.found === "rounded-md").suggestion.detail).toContain("Project radius tokens: --radius-small (11px)");
    expect(v.find((x: any) => x.found === "shadow-md").suggestion.detail).toContain("--shadow-card");
    expect(v.find((x: any) => x.found === "rounded-md").message).toContain("Map it in @theme (--radius-md)");
  });

  it("accepts steps mapped in @theme and the scales allowed by default (spacing, sizing, weight, none/full)", async () => {
    const r = await h.call("check_ui", { path: "app/page.tsx", rules: ["tailwind-default-scale"] });
    const found = r.structuredContent.violations.map((v: any) => v.found);
    for (const ok of ["rounded-lg", "rounded-full", "shadow-none", "font-bold", "p-4", "w-full", "leading-6", "tracking-normal"]) {
      expect(found).not.toContain(ok);
    }
  });

  it("respects tailwind.allowDefaultScale", async () => {
    const dir = variant({ "facha-ui.config.json": JSON.stringify({ ...baseConfig, tailwind: { allowDefaultScale: { radius: true, fontSize: true } } }) });
    const c = await connect(dir);
    const r = await c.call("check_ui", { path: "app/page.tsx", rules: ["tailwind-default-scale"] });
    expect(r.structuredContent.violations.map((v: any) => v.found)).toEqual(["shadow-md", "tracking-wide", "leading-tight"]);
    await c.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe("palette sprawl (health)", () => {
  it("reports near-duplicate tokens, hand-written colors and scale steps", async () => {
    const r = await h.call("get_design_system", { sections: ["health"] });
    const health = r.structuredContent.health;
    expect(health.filter((x: any) => x.kind === "near-duplicate-tokens").map((x: any) => x.token)).toEqual(["--divider ~ --line"]);
    expect(health.filter((x: any) => x.kind === "near-duplicate-literals").map((x: any) => x.token)).toEqual(["#fef2f2 ~ #fef2f3"]);
    expect(health.filter((x: any) => x.kind === "near-duplicate-steps").map((x: any) => x.token)).toEqual([
      "border-radius 8px ~ 9px",
      "font-size 13px ~ 13.5px",
    ]);
  });

  it("does not report tokens that differ in some theme", async () => {
    const r = await h.call("get_design_system", { sections: ["health"] });
    const tokens = r.structuredContent.health.filter((x: any) => x.kind === "near-duplicate-tokens").flatMap((x: any) => x.tokens);
    expect(tokens).not.toContain("--canvas");
  });
});
