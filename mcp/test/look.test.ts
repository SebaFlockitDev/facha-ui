import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { proposeSystem } from "../src/generate.js";
import { connect } from "./helpers.js";

// The parts of the generic AI look that break a published rule (B-029, SPEC §2.a.4).

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, "fixtures");
const FIXTURE = path.join(FIXTURES, "generic-look");
const NEW = ["ux-gray-on-color", "a11y-gradient-text", "a11y-motion"];
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

type V = { rule: string; line: number; severity: string; message: string };
async function check(root: string, file: string): Promise<V[]> {
  const { call, close } = await connect(root);
  const r = await call("check_ui", { path: file });
  await close();
  return (r.structuredContent.violations ?? []) as V[];
}
const lines = (vs: V[], rule: string) => vs.filter((v) => v.rule === rule).map((v) => v.line);

describe("generic-look rules on the fixture", () => {
  it("CSS: each rule finds its positive case and none of the negatives, as a warning", async () => {
    const vs = await check(FIXTURE, "src/index.css");
    expect(lines(vs, "ux-gray-on-color")).toEqual([10]);
    expect(lines(vs, "a11y-gradient-text")).toEqual([19]);
    expect(lines(vs, "a11y-motion")).toEqual([25]);
    expect(vs.filter((v) => NEW.includes(v.rule)).every((v) => v.severity === "warning")).toBe(true);
    expect(vs.find((v) => v.rule === "a11y-gradient-text")!.message).toContain("against the stop #f5f3ff");
  });

  it("theme-contrast no longer measures a gradient as if it were its first color", async () => {
    const vs = await check(FIXTURE, "src/index.css");
    expect(lines(vs, "theme-contrast")).not.toContain(19);
    expect(lines(vs, "theme-contrast")).not.toContain(21);
  });

  it("JSX with Tailwind: gray on a palette color, a failing gradient and a bare animate-*; variants and motion-safe are fine", async () => {
    const vs = await check(FIXTURE, "src/Page.tsx");
    expect(lines(vs, "ux-gray-on-color")).toEqual([4]);
    expect(lines(vs, "a11y-gradient-text")).toEqual([7]);
    expect(lines(vs, "a11y-motion")).toEqual([9]);
  });

  it("a prefers-reduced-motion query anywhere in the project's CSS is the alternative", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "facha-look-"));
    dirs.push(dir);
    fs.cpSync(FIXTURE, dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "src", "motion.css"), "@media (prefers-reduced-motion: reduce) { .fade-up { animation: none; } }\n");
    expect(lines(await check(dir, "src/index.css"), "a11y-motion")).toEqual([]);
  });
});

describe("no false positives", () => {
  it("the existing fixtures get none of the new rules", async () => {
    const roots = fs
      .readdirSync(FIXTURES, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== "generic-look")
      .map((d) => path.join(FIXTURES, d.name))
      .filter((d) => fs.existsSync(path.join(d, "package.json")));
    expect(roots.length).toBeGreaterThan(3);
    for (const root of roots) {
      const { call, close } = await connect(root);
      const r = await call("audit_project");
      await close();
      const byRule = (r.structuredContent?.byRule ?? {}) as Record<string, number>;
      for (const rule of NEW) expect(byRule[rule] ?? 0, `${path.basename(root)}: ${rule}`).toBe(0);
    }
  });

  it("the lab's specimen on a generated system gets none of them", async () => {
    const SYSTEM = path.join(HERE, "..", "..", "skills", "variants", "templates", "next-app", "system");
    for (const d of proposeSystem({ density: "balanced", level: "AA", format: "css", brandColor: "#4f46e5" }).directions) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "facha-look-sp-"));
      dirs.push(dir);
      fs.mkdirSync(path.join(dir, "src", "preview"), { recursive: true });
      fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ dependencies: { react: "18.3.1", "react-dom": "18.3.1" }, devDependencies: { vite: "5.4.10" } }));
      fs.writeFileSync(path.join(dir, "src", "index.css"), `${d.css.light.text}\n${d.css.dark.text}\n`);
      for (const f of ["lab-specimen.tsx", "lab-specimen.module.css"]) fs.copyFileSync(path.join(SYSTEM, f), path.join(dir, "src", "preview", f));
      const vs = await check(dir, "src/preview");
      expect(vs.filter((v) => NEW.includes(v.rule)), d.id).toEqual([]);
    }
  });
});

describe("the rules are verified by a principle", () => {
  it("each new rule is in the Verify line of a ux-principles.md principle, listed as verified by the guardian", () => {
    const text = fs.readFileSync(path.join(HERE, "..", "..", "skills", "_shared", "ux-principles.md"), "utf8").replace(/\r\n/g, "\n");
    for (const [rule, id] of [["ux-gray-on-color", "ux:text-on-color"], ["a11y-gradient-text", "ux:wcag-1.4.3"], ["a11y-motion", "ux:wcag-2.3.3"]]) {
      const block = text.split(`### ${id} · `)[1]!.split("\n### ")[0]!;
      expect(block.match(/- \*\*Verify:\*\*[\s\S]*/)![0], id).toContain(`\`${rule}\``);
    }
    const guardian = text.split("\n").find((l) => l.startsWith("| guardian (`check_ui`) |"))!;
    for (const id of ["ux:text-on-color", "ux:wcag-2.3.3", "ux:wcag-1.4.3"]) expect(guardian, id).toContain(`\`${id}\``);
  });
});

describe("nested-surfaces (review_ui, never blocks)", () => {
  it("points at a card inside a card, and not at a round avatar or at a border and a radius on different ancestors", async () => {
    const { call, close } = await connect(FIXTURE);
    const r = await call("review_ui", { path: "src/Cards.tsx" });
    await close();
    const nested = (r.structuredContent.findings as { heuristic: string; line: number; severity: string; why: string }[]).filter((f) => f.heuristic === "nested-surfaces");
    expect(nested.map((f) => f.line)).toEqual([5]);
    expect(nested[0]!.severity).toBe("info");
    expect(nested[0]!.why).toContain("ux:gestalt-common-region");
  });
});
