import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contrast, parseColor, shownRatio } from "../src/color.js";
import { connect } from "./helpers.js";

// B-032: the contrast matrix of the design system, and WCAG contrast decided on the unrounded
// ratio ("4.499:1 would not meet the 4.5:1 threshold", Understanding 1.4.3).

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

describe("contrast · no rounding", () => {
  it("a pair at 4.4989:1 does not reach 4.5:1, and reads 4.49", () => {
    const r = contrast(parseColor("#168484")!, parseColor("#ffffff")!);
    expect(r).toBeGreaterThan(4.49);
    expect(r).toBeLessThan(4.5);
    expect(shownRatio(r)).toBe(4.49);
  });

  it("shows exact values unchanged and never rounds up", () => {
    expect(shownRatio(21)).toBe(21);
    expect(shownRatio(4.5)).toBe(4.5);
    expect(shownRatio(3.0099)).toBe(3);
    expect(shownRatio(1.1899)).toBe(1.18);
  });
});

let h: Awaited<ReturnType<typeof connect>>;
let matrix: any;
const pair = (fg: string, bg: string) => matrix.pairs.find((p: any) => p.fg === fg && p.bg === bg);
beforeAll(async () => {
  h = await connect(path.join(FIXTURES, "contrast-matrix"));
  matrix = (await h.call("get_design_system", {})).structuredContent.contrast;
});
afterAll(async () => {
  await h.close();
});

describe("contrast matrix · get_design_system", () => {
  it("comes with the default sections, with WCAG 2.2's minimums", () => {
    expect(matrix.standard).toBe("WCAG 2.2");
    expect(matrix.minimums).toEqual({ text: 4.5, largeText: 3, enhanced: 7, nonText: 3 });
    expect(matrix.themes).toEqual(["light", "dark"]);
  });

  it("measures every text on every surface, in every theme, with its level", () => {
    for (const s of ["--bg", "--panel", "--card"]) expect(pair("--text", s)?.passes, s).toBe(true);
    expect(pair("--text", "--bg").level).toEqual({ light: "AAA", dark: "AAA" });
    expect(pair("--text-faint", "--panel")).toMatchObject({ kind: "text", passes: false, largeOnly: false });
  });

  it("decides on the unrounded ratio: 4.4989:1 is only for large text", () => {
    expect(pair("--text-teal", "--bg")).toMatchObject({ passes: false, largeOnly: true });
    expect(pair("--text-teal", "--bg").ratio.light).toBe(4.49);
    expect(pair("--text-teal", "--bg").level.light).toBe("large-only");
  });

  it("pairs a foreground with the background it is named for", () => {
    expect(pair("--card-foreground", "--card")?.kind).toBe("paired");
    expect(pair("--on-primary", "--primary")?.kind).toBe("paired");
    expect(pair("--on-danger", "--danger")?.kind).toBe("paired");
    expect(pair("--danger-text", "--danger-bg")?.kind).toBe("paired");
    // --text is plain text, not "the text of --bg".
    expect(pair("--text", "--bg").kind).toBe("text");
  });

  it("measures each state's text on the surfaces: its text variant, or the plain token when it has none", () => {
    expect(pair("--danger-text", "--bg")?.kind).toBe("status");
    expect(pair("--danger", "--bg")).toBeUndefined();
    expect(pair("--success", "--panel")?.kind).toBe("status");
  });

  it("marks the pairs the project declares together, with where", () => {
    expect(pair("--danger-text", "--panel").used).toEqual({ count: 1, where: ["app/globals.css:40"] });
  });

  it("measures control borders and the focus ring at 3:1, and not decorative borders", () => {
    expect(pair("--border-input", "--bg")).toMatchObject({ kind: "non-text", passes: false });
    expect(pair("--ring", "--bg")).toMatchObject({ kind: "non-text", passes: true, level: { light: "pass", dark: "pass" } });
    expect(matrix.pairs.some((p: any) => p.fg === "--border")).toBe(false);
  });

  it("answers which text goes on each background", () => {
    expect(matrix.bySurface["--bg"]).toEqual({
      pass: ["--card-foreground", "--danger-text", "--success", "--text"],
      largeOnly: ["--text-teal"],
      fail: ["--text-faint"],
    });
    expect(matrix.bySurface["--primary"].pass).toEqual(["--on-primary"]);
  });

  it("lists failing pairs first and sums them up", () => {
    expect(matrix.pairs[0].passes).toBe(false);
    expect(matrix.summary.pairs).toBe(matrix.pairs.length);
    expect(matrix.summary.passing + matrix.summary.largeOnly + matrix.summary.failing).toBe(matrix.summary.pairs);
  });

  it("measures a Tailwind 4 alias once, as its target", async () => {
    const shadcn = await connect(path.join(FIXTURES, "shadcn-tw4"));
    try {
      const m = (await shadcn.call("get_design_system", { sections: ["contrast"] })).structuredContent.contrast;
      expect(m.pairs.some((p: any) => p.fg.startsWith("--color-") || p.bg.startsWith("--color-"))).toBe(false);
      expect(m.pairs.find((p: any) => p.fg === "--muted-foreground" && p.bg === "--muted")).toMatchObject({ kind: "paired", largeOnly: true });
    } finally {
      await shadcn.close();
    }
  });
});
