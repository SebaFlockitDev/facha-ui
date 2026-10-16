import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connect } from "./helpers.js";

// B-030: the project's UI components, the native elements they stand for, and the warning when one
// of them is made by hand (ds-component-reuse, ux:nielsen-4).

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

let h: Awaited<ReturnType<typeof connect>>;
beforeAll(async () => {
  h = await connect(path.join(FIXTURES, "shadcn-tw4"));
});
afterAll(async () => {
  await h.close();
});

describe("components · the inventory (get_design_system)", () => {
  it("reads the UI folder that components.json names, with the import and what each one stands for", async () => {
    const ds = (await h.call("get_design_system", {})).structuredContent;
    expect(ds.components.dir).toBe("components/ui");
    expect(ds.components.source).toBe("components.json");
    expect(ds.components.components).toEqual([
      { name: "Button", file: "components/ui/button.tsx", line: 4, importPath: "@/components/ui/button", standsFor: ["button"] },
      { name: "Card", file: "components/ui/card.tsx", line: 3, importPath: "@/components/ui/card", standsFor: [] },
      { name: "Input", file: "components/ui/input.tsx", line: 3, importPath: "@/components/ui/input", standsFor: ["input"] },
    ]);
  });

  it("is empty in a project with no UI folder", async () => {
    const plain = await connect(path.join(FIXTURES, "next-visual"));
    try {
      const ds = (await plain.call("get_design_system", { sections: ["components"] })).structuredContent;
      expect(ds.components).toEqual({ dir: null, source: null, components: [] });
      const r = await plain.call("check_ui", { path: ".", rules: ["ds-component-reuse"] });
      expect(r.structuredContent.violations).toEqual([]);
    } finally {
      await plain.close();
    }
  });
});

describe("ds-component-reuse", () => {
  it("warns about a <button> made by hand, with the exact import", async () => {
    const r = await h.call("check_ui", { path: "app", rules: ["ds-component-reuse"] });
    const vs = r.structuredContent.violations;
    expect(vs.map((v: any) => `${v.file}:${v.line} ${v.severity} ${v.found} → ${v.suggestion.value}`)).toEqual([
      "app/page.tsx:6 warning <button> → <Button>",
    ]);
    expect(vs[0].message).toContain('import { Button } from "@/components/ui/button";');
    expect(vs[0].suggestion.source).toBe("components/ui/button.tsx:4");
  });

  it("does not warn about the components themselves, input type=hidden, a label with no Label, or a div next to a Card", async () => {
    const r = await h.call("check_ui", { path: ".", rules: ["ds-component-reuse"] });
    const files = r.structuredContent.violations.map((v: any) => v.file);
    expect(files.filter((f: string) => f.startsWith("components/ui/"))).toEqual([]);
    expect(files.filter((f: string) => f === "app/settings/page.tsx")).toEqual([]);
  });
});

describe("ux_score · design-system coverage (B-030)", () => {
  it("counts components used against made by hand, and colors from tokens against literals, next to the score", async () => {
    const r = (await h.call("ux_score", {})).structuredContent;
    const by = Object.fromEntries(r.screens.map((s: any) => [s.screen, s.coverage]));
    expect(by["app/page.tsx"]).toEqual({ components: { used: 0, handmade: 1, ratio: 0 }, tokens: { viaToken: 5, literal: 1, ratio: 0.83 } });
    expect(by["app/settings/page.tsx"]).toEqual({ components: { used: 2, handmade: 0, ratio: 1 }, tokens: { viaToken: 2, literal: 0, ratio: 1 } });
    expect(r.coverage.components).toEqual({ used: 2, handmade: 1, ratio: 0.67 });
    expect(r.method.coverage).toContain("Not part of the score");
  });
});
