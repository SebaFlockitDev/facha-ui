import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connect } from "./helpers.js";

// B-028: a reference page read by /facha-ui:init reference, turned into the generator's inputs. The
// MCP only reads the JSON the skill wrote (S2: no network).

const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "reference");
const REF = ".facha-ui/references/sample.json";

let h: Awaited<ReturnType<typeof connect>>;
let r: any;
beforeAll(async () => {
  h = await connect(FIXTURE);
  r = (await h.call("propose_design_system", { reference: REF })).structuredContent;
});
afterAll(async () => {
  await h.close();
});

describe("propose_design_system · reference", () => {
  it("takes the brand from the primary button, and says it is another product's brand", () => {
    expect(r.inputs.brandColor).toEqual({ value: "#4f46e5", from: "reference example.com: the primary button's background (a.btn.btn-primary)" });
    expect(r.reference.notes[0]).toContain("brand color of example.com");
  });

  it("takes the style and radius to Material 3's nearest step, and the density from Carbon's sizes", () => {
    expect(r.inputs.style.value).toBe("soft");
    expect(r.inputs.radius).toMatchObject({ value: 16 });
    expect(r.inputs.radius.from).toContain('Material 3 "lg"');
    expect(r.inputs.density).toMatchObject({ value: "balanced" });
    expect(r.directions).toHaveLength(1);
  });

  it("does not propose a font the project does not load (it may need a license)", () => {
    expect(r.inputs.fontFamily.value).toBeNull();
    expect(r.inputs.fontFamily.from).toContain("Inter is not loaded by the project and may need a license");
  });

  it("measures the reference's pairs and says what replaces the failing ones", () => {
    const pairs = r.reference.pairs;
    expect(pairs.find((p: any) => p.pair === "text on the background")).toMatchObject({ pass: true, from: "body" });
    // A 40px heading is large text: 3:1.
    expect(pairs.find((p: any) => p.pair.startsWith("h1.title"))).toMatchObject({ min: 3, pass: true });
    const link = pairs.find((p: any) => p.pair === "links on the background");
    expect(link).toMatchObject({ fg: "#60a5fa", ratio: 2.54, pass: false });
    expect(link.replacedBy.fg).toBe("--color-primary-strong");
    expect(link.replacedBy.ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("lets the arguments win over the reference", async () => {
    const own = (await h.call("propose_design_system", { reference: REF, brandColor: "#0f766e", style: "sober" })).structuredContent;
    expect(own.inputs.brandColor).toEqual({ value: "#0f766e", from: "argument" });
    expect(own.inputs.style).toEqual({ value: "sober", from: "argument" });
  });

  it("proposes the font when the project already loads it", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "facha-ref-"));
    fs.cpSync(FIXTURE, dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "app", "globals.css"), '@font-face { font-family: "Inter"; src: url(/inter.woff2); }\nbody { font-family: Inter, sans-serif; }\n');
    const c = await connect(dir);
    try {
      const out = (await c.call("propose_design_system", { reference: REF })).structuredContent;
      expect(out.inputs.fontFamily.value).toBe('"Inter", system-ui, sans-serif');
      expect(out.inputs.fontFamily.from).toContain("the project already loads it (app/globals.css)");
    } finally {
      await c.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("refuses a file outside the project or that is not a reference", async () => {
    const outside = await h.call("propose_design_system", { reference: "../../../package.json" });
    expect(outside.isError).toBe(true);
    const notRef = await h.call("propose_design_system", { reference: "package.json" });
    expect(notRef.isError).toBe(true);
  });
});

describe("the reading script (skills/init/scripts/reference-styles.js)", () => {
  const script = fs.readFileSync(path.join(FIXTURE, "..", "..", "..", "..", "skills", "init", "scripts", "reference-styles.js"), "utf8");

  it("is one arrow function that reads computed styles and sizes", () => {
    expect(script.trim().startsWith("() => {")).toBe(true);
    expect(script).toContain("getComputedStyle");
    expect(script).toContain("getBoundingClientRect");
    expect(() => new Function(`return (${script})`)).not.toThrow();
  });

  it("never reads the page's text, storage or cookies, never sends, writes or clicks", () => {
    for (const banned of ["fetch(", "XMLHttpRequest", "sendBeacon", "WebSocket", "localStorage", "sessionStorage", "indexedDB", "cookie", "innerText", "textContent", "innerHTML", "outerHTML", ".click(", ".submit(", "postMessage", "window.open", "location.href =", "eval(", "import("])
      expect(script, banned).not.toContain(banned);
  });
});
