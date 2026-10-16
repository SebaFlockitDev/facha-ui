import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connect } from "./helpers.js";

// B-004: a state told by color alone (WCAG 1.4.1, ux:wcag-1.4.1).

const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "color-only");

let h: Awaited<ReturnType<typeof connect>>;
let lines: number[];
let vs: any[];
beforeAll(async () => {
  h = await connect(FIXTURE);
  vs = (await h.call("check_ui", { path: "app/page.tsx", rules: ["a11y-color-only"] })).structuredContent.violations;
  lines = vs.map((v) => v.line);
});
afterAll(async () => {
  await h.close();
});

describe("a11y-color-only", () => {
  it("warns about a state dot with nothing else that says the state", () => {
    expect(vs[0]).toMatchObject({ rule: "a11y-color-only", severity: "warning", line: 12 });
    expect(vs[0].message).toContain("the class dot-paid");
    expect(vs[0].suggestion.detail).toContain("sr-only");
  });

  it("reads the state from a className that interpolates it, and from a status color", () => {
    expect(vs.find((v) => v.line === 15).message).toContain("depends on status");
    expect(lines).toContain(18);
  });

  it("leaves alone text next to it, an aria-label, aria-hidden, an icon, its own text, sr-only text and a button", () => {
    expect(lines).toEqual([12, 15, 18]);
  });
});
