import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connect } from "./helpers.js";

const UX = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "next-ux");
const A11Y = [
  "a11y-img-alt",
  "a11y-control-label",
  "a11y-button-name",
  "a11y-click-target",
  "a11y-tabindex",
  "a11y-focus-visible",
  "a11y-target-size",
  "a11y-heading-order",
];
const brief = (v: any) => `${v.line} ${v.rule} ${v.severity} ${v.found}`;

let h: Awaited<ReturnType<typeof connect>>;
beforeAll(async () => {
  h = await connect(UX);
});
afterAll(async () => {
  await h.close();
});

describe("accessibility rules", () => {
  it("flag each problem once, with what it means and how to fix it", async () => {
    const r = await h.call("check_ui", { path: "app/orders/page.tsx", rules: A11Y });
    expect(r.structuredContent.violations.map(brief)).toEqual([
      "6 a11y-heading-order warning <h1> → <h3>",
      "7 a11y-img-alt error <img>",
      "8 a11y-control-label error <input>",
      "9 a11y-button-name error <button>",
      "9 a11y-target-size warning <button> 16px",
      "10 a11y-click-target warning <div «Open»>",
      "11 a11y-tabindex warning tabIndex=2",
      "12 a11y-focus-visible warning outline-none",
    ]);
    const label = r.structuredContent.violations.find((v: any) => v.rule === "a11y-control-label");
    expect(label.message).toContain("a placeholder is not a label");
    expect(label.context).toBe("jsx-element");
    expect(label.suggestion.detail).toMatch(/label/);
  });

  it("accept the correct patterns: alt, labels, aria-label, padding, focus-visible, role with keyboard, dialogs", async () => {
    const r = await h.call("check_ui", { path: "app/clean/page.tsx" });
    expect(r.structuredContent.violations.map(brief)).toEqual([]);
  });

  it("flag a :focus rule that removes the outline with nothing instead", async () => {
    const r = await h.call("check_ui", { path: "app/globals.css", rules: ["a11y-focus-visible"] });
    expect(r.structuredContent.violations.map(brief)).toEqual(["29 a11y-focus-visible warning .field input:focus { outline: none }"]);
  });

  it("can be turned off in the config like any rule", async () => {
    const r = await h.call("get_design_system", { sections: ["rules"] });
    const ids = r.structuredContent.rules.map((x: any) => x.id);
    for (const id of A11Y) expect(ids).toContain(id);
  });
});

describe("responsive rules", () => {
  const RESPONSIVE = ["responsive-fixed-width", "responsive-grid-columns", "responsive-table-scroll", "responsive-viewport-height"];

  it("flag what breaks on a phone and accept what adapts (caps, breakpoints, scroll containers)", async () => {
    const r = await h.call("check_ui", { path: "app/wide/page.tsx", rules: RESPONSIVE });
    expect(r.structuredContent.violations.map(brief)).toEqual([
      "4 responsive-viewport-height info h-screen",
      "5 responsive-fixed-width warning w-[800px]",
      "8 responsive-grid-columns warning grid-cols-4",
      "10 responsive-table-scroll info <table>",
    ]);
    const grid = r.structuredContent.violations.find((v: any) => v.rule === "responsive-grid-columns");
    expect(grid.suggestion.detail).toContain("md:grid-cols-4");
  });

  it("read CSS the same way: fixed widths and grids outside media queries, auto-fit is fine", async () => {
    const r = await h.call("check_ui", { path: "app/globals.css", rules: RESPONSIVE });
    expect(r.structuredContent.violations.map(brief)).toEqual([
      "31 responsive-fixed-width warning width: 900px",
      "32 responsive-grid-columns warning grid-template-columns: repeat(4, 1fr)",
      "34 responsive-viewport-height info min-height: 100vh",
    ]);
  });
});

describe("microcopy rules", () => {
  const COPY = ["copy-vague-label", "copy-error-text", "copy-all-caps", "copy-term", "copy-voice"];

  it("flag copy that says nothing, and the team's words and voice; accept copy that helps", async () => {
    const r = await h.call("check_ui", { path: "app/copy/page.tsx", rules: COPY });
    expect(r.structuredContent.violations.map(brief)).toEqual([
      "6 copy-vague-label warning <a> «Click aquí»",
      "7 copy-vague-label info <button> «OK»",
      "8 copy-error-text info Ocurrió un error",
      "9 copy-error-text info Error 500: Internal Server Error",
      "10 copy-all-caps info IMPORTE TOTAL DEL MES",
      "11 copy-term warning orden",
      "12 copy-voice warning puedes",
      "14 copy-voice warning ingresa",
    ]);
    const term = r.structuredContent.violations.find((v: any) => v.rule === "copy-term");
    expect(term.suggestion.detail).toContain('"pedido"');
    const voice = r.structuredContent.violations.find((v: any) => v.found === "puedes");
    expect(voice.suggestion.detail).toContain('"podés"');
  });

  it("expose the product's voice in get_design_system", async () => {
    const r = await h.call("get_design_system", { sections: ["guidelines"] });
    expect(r.structuredContent.copy).toEqual({ voice: "vos", terms: [{ use: "pedido", avoid: ["orden", "compra"] }] });
  });
});

describe("ux_score", () => {
  it("scores each screen by category, counting the components it imports", async () => {
    const r = await h.call("ux_score", {});
    const byScreen = Object.fromEntries(r.structuredContent.screens.map((s: any) => [s.screen, s]));
    expect(Object.keys(byScreen)).toEqual(["app/clean/page.tsx", "app/copy/page.tsx", "app/list/page.tsx", "app/orders/page.tsx", "app/wide/page.tsx"]);
    expect(byScreen["app/clean/page.tsx"].score).toBe(100);
    expect(byScreen["app/orders/page.tsx"].score).toBeLessThan(byScreen["app/clean/page.tsx"].score);
    expect(byScreen["app/orders/page.tsx"].categories.accessibility).toMatchObject({ error: 3 });
    expect(byScreen["app/copy/page.tsx"].categories.copy.score).toBeLessThan(100);
    expect(byScreen["app/wide/page.tsx"].categories.responsive.score).toBeLessThan(100);
    expect(byScreen["app/list/page.tsx"].files).toEqual(["app/list/page.tsx"]);
    for (const s of r.structuredContent.screens) expect(s.score).toBeGreaterThanOrEqual(0);
  });
});

describe("review_ui", () => {
  it("measures competing primary actions, accents and font sizes", async () => {
    const r = await h.call("review_ui", { path: "app/orders/page.tsx" });
    const file = r.structuredContent.files[0];
    expect(file.primaryActions.map((p: any) => p.line)).toEqual([9, 12, 13]);
    expect(file.accents).toEqual(["--accent", "--brand", "--brand-soft"]);
    expect(file.fontSizesPx).toEqual([12, 13, 14, 15, 20]);
    expect(file.headings).toEqual([
      { level: 1, text: "Orders", line: 5 },
      { level: 3, text: "Pending", line: 6 },
    ]);
    expect(r.structuredContent.findings.map((f: any) => `${f.heuristic} ${f.severity}`)).toEqual([
      "accents warning",
      "type-scale info",
      "primary-action warning",
    ]);
    for (const f of r.structuredContent.findings) {
      expect(f.why.length).toBeGreaterThan(20);
      expect(f.fix.length).toBeGreaterThan(20);
    }
  });

  it("finds the loading, empty and error states a screen handles, and the ones it misses", async () => {
    const clean = await h.call("review_ui", { path: "app/clean/page.tsx" });
    expect(Object.values(clean.structuredContent.files[0].states).every((line) => typeof line === "number")).toBe(true);
    expect(clean.structuredContent.findings).toEqual([]);

    const list = await h.call("review_ui", { path: "app/list/page.tsx" });
    expect(list.structuredContent.findings.map((f: any) => f.evidence).sort()).toEqual([
      "no empty state found",
      "no error state found",
      "no loading state found",
    ]);
  });

  it("is deterministic and never blocks: findings are warnings or info", async () => {
    const a = await h.call("review_ui", { path: "app" });
    const b = await h.call("review_ui", { path: "app" });
    expect(JSON.stringify(a.structuredContent)).toBe(JSON.stringify(b.structuredContent));
    expect(a.structuredContent.findings.every((f: any) => f.severity !== "error")).toBe(true);
  });
});

describe("score CLI · CI gate", () => {
  const run = (args: string[]) => spawnSync(process.execPath, [path.join(UX, "..", "..", "..", "dist", "facha-ui-mcp.js"), "score", "--root", UX, ...args], { encoding: "utf8" });

  it("prints the score as JSON and exits 0 when nothing got worse", () => {
    const r = run([]);
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout).screens.length).toBe(5);
  });

  it("exits 1 when a screen scores below its baseline or below --min", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "facha-score-"));
    const baseline = path.join(dir, "baseline.json");
    fs.writeFileSync(baseline, JSON.stringify({ screens: [{ screen: "app/orders/page.tsx", score: 100 }] }));
    const down = run(["--baseline", baseline]);
    expect(down.status).toBe(1);
    expect(down.stderr).toContain("UX score went down: app/orders/page.tsx 100 →");
    expect(run(["--min", "101"]).status).toBe(1);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
