import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { PRODUCT_TYPES } from "../src/brief.js";
import { createContext } from "../src/context.js";
import { getDesignSystem } from "../src/design-system.js";
import { proposeSystem, type SystemInput } from "../src/generate.js";
import { PROFILES, SOURCES } from "../src/standards.js";
import { connect } from "./helpers.js";

// Product profiles (B-027, SPEC §2.h): what a type of product sets by default, each value with its source.

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

const base: SystemInput = { density: "balanced", level: "AA", format: "css", brandColor: "#4f46e5" };
const token = (s: ReturnType<typeof proposeSystem>, name: string) => s.directions[0]!.tokens.find((t) => t.name === name)?.light;

describe("product profiles", () => {
  it("cover every product type but `other`, and every value names a published source", () => {
    expect(Object.keys(PROFILES).sort()).toEqual(PRODUCT_TYPES.filter((t) => t !== "other").sort());
    for (const [type, p] of Object.entries(PROFILES)) {
      const values = [p.density, p.typeSet, p.control, ...p.tokens, ...p.guidelines].filter(Boolean);
      expect(values.length, type).toBeGreaterThan(0);
      for (const v of values) {
        expect(v!.sources.length, `${type}: ${JSON.stringify(v)}`).toBeGreaterThan(0);
        for (const s of v!.sources) expect(SOURCES[s], `${type}: ${s}`).toMatch(/https:\/\//);
      }
    }
  });

  it("cite principles that exist in ux-principles.md", () => {
    const principles = fs.readFileSync(path.join(REPO, "skills", "_shared", "ux-principles.md"), "utf8");
    for (const p of Object.values(PROFILES)) for (const g of p.guidelines) if (g.principle) expect(principles, g.principle).toContain(`### ${g.principle} · `);
  });

  it("a dashboard gets Carbon's productive scale, 32px rows and controls, and tabular figures", () => {
    const s = proposeSystem({ ...base, density: "compact", productType: "saas-dashboard" });
    expect(s.typography.scaleSource).toBe("carbonType");
    expect(s.typography.base).toBe(14);
    expect(token(s, "--size-row")).toBe("32px");
    expect(token(s, "--numerals")).toBe("tabular-nums");
    expect(token(s, "--size-control")).toBe("32px");
    expect(s.profile!.guidelines.map((g) => g.principle)).toContain("ux:numeric-alignment");
  });

  it("fintech keeps the productive scale even at a balanced density", () => {
    const s = proposeSystem({ ...base, productType: "fintech" });
    expect(s.typography.base).toBe(14);
    expect(s.typography.scaleFrom).toBe("profile fintech");
    expect(token(s, "--numerals")).toBe("tabular-nums");
    expect(token(s, "--size-control")).toBe("40px");
  });

  it("e-commerce and consumer apps raise controls to 48px for touch; content caps the line length", () => {
    const shop = proposeSystem({ ...base, density: "compact", productType: "ecommerce" });
    expect(token(shop, "--size-control")).toBe("48px");
    expect(shop.directions[0]!.tokens.find((t) => t.name === "--size-control")!.sources).toContain("wcag255");
    expect(token(shop, "--measure")).toBe("75ch");
    expect(shop.typography.base).toBe(16);
    expect(token(proposeSystem({ ...base, productType: "consumer-app" }), "--size-control")).toBe("48px");
    expect(token(proposeSystem({ ...base, density: "airy", productType: "content" }), "--measure")).toBe("75ch");
  });

  it("without a profile nothing changes: the density decides, as before", () => {
    const none = proposeSystem({ ...base, density: "compact" });
    const other = proposeSystem({ ...base, density: "compact", productType: "other" });
    expect(none.profile).toBeNull();
    expect(other.profile).toBeNull();
    expect(token(none, "--numerals")).toBeUndefined();
    expect(none.typography).toEqual(other.typography);
  });

  it("every generated system with a profile still passes every contrast pair and reads back with status ok", () => {
    for (const type of Object.keys(PROFILES)) {
      const s = proposeSystem({ ...base, productType: type });
      for (const d of s.directions) expect(d.proof.filter((p) => !p.pass), `${type} ${d.id}`).toEqual([]);
    }
  });
});

describe("profile through the brief and the MCP", () => {
  function project(decisions: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "facha-profile-"));
    dirs.push(dir);
    const files: Record<string, string> = {
      "package.json": JSON.stringify({ dependencies: { react: "18.3.1", "react-dom": "18.3.1" }, devDependencies: { vite: "5.4.10" } }),
      "index.html": '<!doctype html><html><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>\n',
      "src/main.tsx": 'import "./index.css";\n',
      "src/index.css": "body { margin: 0; }\n",
      "design-system/decisions.md": decisions,
    };
    for (const [name, text] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
      fs.writeFileSync(path.join(dir, name), text);
    }
    return dir;
  }
  const brief = (product: string, density = "") =>
    `# Design decisions\n\n## dec-2026-10-16-brief · Brief\n- **Fecha:** 2026-10-16\n- **Producto:** \`${product}\` — prueba\n${density ? `- **Densidad:** ${density}\n` : ""}`;

  it("get_design_system returns the brief's profile with its sources spelled out", () => {
    const ds = getDesignSystem(createContext(project(brief("internal-tool"))), ["profile"]) as { profile: { type: string; label: string; sources: Record<string, string> } };
    expect(ds.profile.type).toBe("internal-tool");
    expect(ds.profile.sources.carbonTableRows).toContain("carbondesignsystem.com");
    expect((getDesignSystem(createContext(project(brief("other"))), ["profile"]) as { profile: unknown }).profile).toBeNull();
  });

  it("propose_design_system takes the profile's density when the brief has none, and the brief's when it has one", async () => {
    const a = await connect(project(brief("content")));
    const r = await a.call("propose_design_system");
    expect(r.structuredContent.inputs.productType.value).toBe("content");
    expect(r.structuredContent.inputs.density.value).toBe("airy");
    expect(r.structuredContent.inputs.density.from).toMatch(/^profile content/);
    await a.close();
    const b = await connect(project(brief("content", "compacta")));
    const s = await b.call("propose_design_system");
    expect(s.structuredContent.inputs.density.value).toBe("compact");
    expect(s.structuredContent.inputs.density.from).toMatch(/^brief /);
    await b.close();
  });
});
