import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connect } from "./helpers.js";

const VISUAL = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "next-visual");
const CONTRAST_RULES = ["theme-contrast", "class-contrast", "non-text-contrast"];

const brief = (v: any) => `${v.file}:${v.line} ${v.rule} ${v.severity} ${v.found} → ${v.suggestion.value ?? "-"} [${v.breaksThemes.join(",")}]`;

/** A copy of the visual fixture with a different config. */
function withConfig(config: Record<string, unknown>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "facha-visual-"));
  fs.cpSync(VISUAL, dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "facha-ui.config.json"), JSON.stringify(config));
  return dir;
}

let h: Awaited<ReturnType<typeof connect>>;
beforeAll(async () => {
  h = await connect(VISUAL);
});
afterAll(async () => {
  await h.close();
});

describe("theme-contrast · text against its real background, per usage", () => {
  it("flags text that fails in some theme and suggests a readable token", async () => {
    const r = await h.call("check_ui", { path: "app/globals.css", rules: CONTRAST_RULES });
    expect(r.structuredContent.violations.map(brief)).toEqual([
      "app/globals.css:27 theme-contrast error var(--title) → var(--text) [dark]",
      "app/globals.css:29 theme-contrast error var(--text-faint) → var(--text-muted) [light,dark]",
      "app/globals.css:35 non-text-contrast warning 1px solid var(--border) → - [light,dark]",
    ]);
    const title = r.structuredContent.violations[0];
    expect(title.message).toContain("1:1 on --panel in dark");
    expect(title.suggestion.detail).toContain("--text reaches it in every theme");
  });

  it("does not flag readable pairs, theme overrides, translucent backdrops or text on unknown backgrounds", async () => {
    const r = await h.call("check_ui", { path: "app/globals.css", rules: CONTRAST_RULES });
    const lines = r.structuredContent.violations.map((v: any) => v.line);
    // .muted (28), .button-primary (30), .overlay-label (31), .sidebar-link (32), .notice (33/34), focus ring (36)
    for (const ok of [28, 30, 31, 32, 33, 34, 36]) expect(lines, `line ${ok}`).not.toContain(ok);
  });

  it("checks inline styles too", async () => {
    const r = await h.call("check_ui", { path: "app/page.tsx", rules: CONTRAST_RULES });
    expect(r.structuredContent.violations.map(brief)).toEqual(
      expect.arrayContaining(["app/page.tsx:8 theme-contrast error var(--title) → var(--text) [dark]"]),
    );
  });

  it("is a warning when the surfaces were autodetected instead of declared", async () => {
    const dir = withConfig({ version: 1, tokens: { sources: ["app/globals.css"], themes: { light: ":root", dark: "html.dark" } } });
    const c = await connect(dir);
    const r = await c.call("check_ui", { path: "app/globals.css", rules: ["theme-contrast"] });
    expect(r.structuredContent.violations.map((v: any) => `${v.line} ${v.severity}`)).toEqual(["27 warning", "29 warning"]);
    await c.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("can be turned off in the config", async () => {
    const dir = withConfig({
      version: 1,
      tokens: { sources: ["app/globals.css"], themes: { light: ":root", dark: "html.dark" } },
      contrast: { surfaces: ["--panel"] },
      rules: { "theme-contrast": "off", "class-contrast": "off" },
    });
    const c = await connect(dir);
    const r = await c.call("check_ui", { path: ".", rules: ["theme-contrast", "class-contrast"] });
    expect(r.structuredContent.violations).toEqual([]);
    await c.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe("class-contrast · a class whose CSS color fails", () => {
  it("is reported where the component uses the class, pointing at the CSS rule", async () => {
    const r = await h.call("check_ui", { path: "app/page.tsx", rules: ["class-contrast"] });
    const v = r.structuredContent.violations;
    expect(v.map(brief)).toEqual(["app/page.tsx:4 class-contrast error title → var(--text) [dark]"]);
    expect(v[0].message).toContain(".title sets color: var(--title) (app/globals.css:27)");
    expect(v[0].suggestion.source).toBe("app/globals.css:27");
  });
});

describe("non-text-contrast · WCAG 1.4.11", () => {
  it("flags low-contrast interactive borders and icons, not readable focus rings or icons", async () => {
    const r = await h.call("check_ui", { path: "app/page.tsx", rules: ["non-text-contrast"] });
    expect(r.structuredContent.violations.map(brief)).toEqual([
      "app/page.tsx:10 non-text-contrast warning var(--border) → - [light,dark]",
    ]);
  });
});

describe("status-confusable · health", () => {
  it("reports status colors that are hard to tell apart with color-vision deficiencies", async () => {
    const r = await h.call("get_design_system", { sections: ["health"] });
    const found = r.structuredContent.health.filter((x: any) => x.kind === "status-confusable");
    expect(found).toEqual([
      expect.objectContaining({
        states: ["success", "warning"],
        themes: ["light", "dark"],
        hardFor: expect.arrayContaining(["protanopia"]),
        minDeltaE: 10,
      }),
    ]);
    expect(found[0].hardFor).not.toContain("normal");
    expect(found[0].deltaE.normal).toBeGreaterThan(10);
  });
});
