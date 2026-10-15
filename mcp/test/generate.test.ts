import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { createContext } from "../src/context.js";
import { coverage, getDesignSystem } from "../src/design-system.js";
import { proposeSystem, seedColors, type Direction, type SystemInput } from "../src/generate.js";
import { HOVER_DELTA_E, SOURCES } from "../src/standards.js";
import { converter, differenceEuclidean } from "culori";
import { connect } from "./helpers.js";

// The design-system generator (B-025, SPEC §2.h).

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

const base: SystemInput = { density: "balanced", level: "AA", format: "css" };
/** Cold, warm, light, dark, saturated and muted brands, plus one close to a state. */
const BRANDS = ["#4f46e5", "#e11d48", "#f59e0b", "#0f766e", "#fde047", "#64748b", "#000080", "#84cc16", "#16a34a", "#111111"];

describe("propose_design_system · color", () => {
  it.each(BRANDS)("every text and control pair passes WCAG 2.2 AA in light and dark, in every direction (%s)", (brand) => {
    for (const d of proposeSystem({ ...base, brandColor: brand }).directions) {
      const failing = d.proof.filter((p) => !p.pass);
      expect(failing, `${d.id}: ${JSON.stringify(failing)}`).toEqual([]);
      expect(d.proof.filter((p) => p.min === 4.5).length).toBeGreaterThan(30);
      expect(d.proof.filter((p) => p.min === 3).length).toBe(8);
    }
  });

  it.each(BRANDS)("AAA raises every text pair to 7:1 (%s)", (brand) => {
    const d = proposeSystem({ ...base, level: "AAA", brandColor: brand }).directions[0]!;
    expect(d.proof.filter((p) => !p.pass)).toEqual([]);
    expect(d.proof.filter((p) => p.rule === "wcag146").every((p) => p.min === 7)).toBe(true);
  });

  it("keeps the brand as step 9 in both modes when text on it is legible, and says when it moves", () => {
    const d = proposeSystem({ ...base, brandColor: "#4f46e5" }).directions[0]!;
    const primary = d.tokens.find((t) => t.name === "--color-primary")!;
    expect([primary.light, primary.dark]).toEqual(["#4f46e5", "#4f46e5"]);
    expect(d.tokens.find((t) => t.name === "--color-on-primary")!.light).toBe("#ffffff");
    expect(d.adjustments.filter((a) => a.token === "--color-primary")).toEqual([]);

    const bright = proposeSystem({ ...base, brandColor: "#fde047" }).directions[0]!;
    expect(bright.tokens.find((t) => t.name === "--color-primary")!.light).toBe("#fde047");
    expect(bright.tokens.find((t) => t.name === "--color-on-primary")!.light).not.toBe("#ffffff");

    const aaa = proposeSystem({ ...base, level: "AAA", brandColor: "#4f46e5" }).directions[0]!;
    const moved = aaa.adjustments.find((a) => a.token === "--color-primary")!;
    expect(moved.from).toBe("#4f46e5");
    expect(moved.to).not.toBe("#4f46e5");
    expect(moved.why).toContain("7:1");
  });

  it.each(BRANDS)("the hover step moves at least as far from the solid as Radix's does (%s)", (brand) => {
    const d = proposeSystem({ ...base, brandColor: brand }).directions[0]!;
    for (const mode of ["light", "dark"] as const) {
      const solid = d.tokens.find((t) => t.name === "--color-primary")![mode];
      const hover = d.tokens.find((t) => t.name === "--color-primary-hover")![mode];
      if (hover === solid) expect(d.notes.join(" ")).toContain(`${mode}: the hover step equals the brand color`);
      else expect(differenceEuclidean("oklab")(solid, hover) * 100, `${mode} ${solid} ${hover}`).toBeGreaterThanOrEqual(HOVER_DELTA_E[mode]);
    }
  });

  it("solves light and dark separately: the dark background is dark, not the light one inverted", () => {
    const d = proposeSystem({ ...base, brandColor: "#4f46e5" }).directions[0]!;
    const bg = d.tokens.find((t) => t.name === "--color-background")!;
    expect(bg.light).not.toBe(bg.dark);
    expect(d.scales.light.neutral).toHaveLength(12);
    expect(d.scales.dark.accent).toHaveLength(12);
  });

  it("reports a brand that looks like a state, with its solution", () => {
    const d = proposeSystem({ ...base, brandColor: "#16a34a" }).directions[0]!;
    const c = d.conflicts.find((x) => x.with === "status.success")!;
    expect(c.deltaE).toBeLessThan(10);
    expect(c.solution).toContain("text label and an icon");
    expect(c.source).toBe("wcag141");
    const blue = proposeSystem({ ...base, brandColor: "#4f46e5" }).directions[0]!;
    expect(blue.conflicts).toEqual([]);
    expect(blue.notes.join(" ")).toContain("info state uses the brand");
    expect(blue.tokens.find((t) => t.name === "--color-info")!.light).toBe("#4f46e5");
  });

  it("without a brand, builds 3 to 5 directions from Radix accents no state is confused with, spread by hue", () => {
    const s = proposeSystem({ ...base });
    expect(s.directions.map((d) => d.id)).toEqual(["indigo-standard", "plum-sober", "cyan-soft"]);
    expect(s.directions.every((d) => d.conflicts.length === 0 && d.seed.from.startsWith("Radix "))).toBe(true);
    expect(proposeSystem({ ...base, seeds: 5 }).directions.length).toBeLessThanOrEqual(5);
    expect(seedColors(5).length).toBeGreaterThanOrEqual(3);
  });

  // B-026: each direction is a seed (or the brand) plus a style.
  const value = (d: { tokens: { name: string; light: string }[] }, name: string) => d.tokens.find((t) => t.name === name)!.light;
  /** The axes two directions differ in: hue, neutral tint, radius, elevation. */
  const axes = (a: Direction, b: Direction) =>
    [
      a.seed.hex !== b.seed.hex && "hue",
      a.style.neutral !== b.style.neutral || (a.style.neutral === "tinted" && a.seed.hex !== b.seed.hex) ? "tint" : false,
      value(a, "--radius") !== value(b, "--radius") && "radius",
      value(a, "--shadow-card") !== value(b, "--shadow-card") && "elevation",
    ].filter(Boolean);

  it.each([["#4f46e5"], [undefined]])("every pair of directions differs in at least two of hue, tint, radius and elevation (brand %s)", (brand) => {
    const ds = proposeSystem({ ...base, brandColor: brand }).directions;
    expect(ds).toHaveLength(3);
    for (let i = 0; i < ds.length; i++)
      for (let j = i + 1; j < ds.length; j++) expect(axes(ds[i]!, ds[j]!).length, `${ds[i]!.id} vs ${ds[j]!.id}`).toBeGreaterThanOrEqual(2);
  });

  it("styles take their radius, neutral and card elevation from published systems", () => {
    const [standard, sober, soft] = proposeSystem({ ...base, brandColor: "#4f46e5" }).directions;
    expect([standard!.id, sober!.id, soft!.id]).toEqual(["brand-standard", "brand-sober", "brand-soft"]);
    expect([value(standard!, "--radius"), value(sober!, "--radius"), value(soft!, "--radius")]).toEqual(["8px", "4px", "16px"]);
    expect(value(sober!, "--shadow-card")).toBe("none");
    expect(value(standard!, "--shadow-card")).toBe("0 0 2px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.14)");
    expect(value(soft!, "--shadow-card")).toBe("0 0 2px rgba(0, 0, 0, 0.12), 0 4px 8px rgba(0, 0, 0, 0.14)");
    // Sober's neutral is Radix's untinted gray; the others are tinted with the brand's hue.
    const chroma = (hex: string) => converter("oklch")(hex)!.c ?? 0;
    expect(chroma(value(sober!, "--color-panel"))).toBeLessThan(0.001);
    expect(chroma(value(standard!, "--color-panel"))).toBeGreaterThan(0.001);
    expect(sober!.style.sources).toContain("carbonLayering");
  });

  it("a brand color and a style give one direction: that is how two directions are mixed", () => {
    const s = proposeSystem({ ...base, brandColor: "#ab4aba", style: "soft" });
    expect(s.directions.map((d) => d.id)).toEqual(["brand-soft"]);
    expect(value(s.directions[0]!, "--radius")).toBe("16px");
  });

  it("is deterministic", () => {
    expect(proposeSystem({ ...base, brandColor: "#e11d48" })).toEqual(proposeSystem({ ...base, brandColor: "#e11d48" }));
    expect(proposeSystem({ ...base })).toEqual(proposeSystem({ ...base }));
  });
});

describe("propose_design_system · type, space, radius and shadow", () => {
  it("takes the type scale from Carbon (compact) or Material 3 (balanced, airy), never under 12px", () => {
    const compact = proposeSystem({ ...base, density: "compact", brandColor: "#4f46e5" });
    expect(compact.typography.scale.map((s) => s.px)).toEqual([12, 14, 16, 20, 28, 32, 42]);
    expect(compact.typography.scaleSource).toBe("carbonType");
    expect(compact.spacing.control).toBe(32);
    const airy = proposeSystem({ ...base, density: "airy", brandColor: "#4f46e5" });
    expect(airy.typography.scale.map((s) => s.px)).toEqual([12, 14, 16, 22, 28, 36, 45]);
    expect(airy.spacing.control).toBe(48);
    expect(airy.typography.lineHeight.body).toBe(1.5);
  });

  it("uses the brief's family when given, and the system stack otherwise", () => {
    const d = proposeSystem({ ...base, brandColor: "#4f46e5", fontFamily: "Inter, sans-serif" }).directions[0]!;
    expect(d.tokens.find((t) => t.name === "--font-sans")).toMatchObject({ light: "Inter, sans-serif", sources: ["brief"] });
    expect(proposeSystem({ ...base, brandColor: "#4f46e5" }).typography.family).toContain("system-ui");
  });

  it("every token and every rule names a published source", () => {
    const s = proposeSystem({ ...base, brandColor: "#4f46e5" });
    for (const t of s.directions[0]!.tokens) {
      expect(t.sources.length, t.name).toBeGreaterThan(0);
      for (const src of t.sources) if (src !== "brief") expect(SOURCES[src], `${t.name}: ${src}`).toBeDefined();
    }
    for (const p of s.directions[0]!.proof) expect(SOURCES[p.rule]).toBeDefined();
    for (const text of Object.values(SOURCES)) expect(text).toMatch(/https:\/\/|mcp\/src\/|skills\//);
  });
});

describe("propose_design_system · facha-ui reads what it generates", () => {
  function project(css: string, pkg: object = { dependencies: { react: "18.3.1", "react-dom": "18.3.1" }, devDependencies: { vite: "5.4.10" } }): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "facha-gen-"));
    dirs.push(dir);
    const files: Record<string, string> = {
      "package.json": JSON.stringify(pkg),
      "index.html": '<!doctype html><html><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>\n',
      "src/main.tsx": 'import "./index.css";\n',
      "src/index.css": css,
    };
    for (const [name, text] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
      fs.writeFileSync(path.join(dir, name), text);
    }
    return dir;
  }

  it.each(["#4f46e5", "#fde047"])("written as CSS, the tokens get their roles, both themes, and status ok (%s)", (brand) => {
    const d = proposeSystem({ ...base, brandColor: brand }).directions[0]!;
    const ctx = createContext(project(`${d.css.light.text}\n\n${d.css.dark.text}\n`));
    expect(coverage(ctx).status).toBe("ok");
    expect(ctx.tokens.themes.map((t) => t.name).sort()).toEqual(["dark", "light"]);
    for (const t of d.tokens) expect(ctx.tokens.tokens.find((x) => x.name === t.name)?.role, t.name).toBe(t.role);
    const ds = getDesignSystem(ctx, ["health"]) as { health: { kind: string }[] };
    // Nothing but near-duplicates of different roles, which the rule itself says to ignore
    // ("different roles that happen to match"); two texts-on-a-solid may share white or dark.
    const findings = (ds.health as unknown as { kind: string; roles?: string[] }[]).filter(
      (h) => !(h.kind === "near-duplicate-tokens" && (h.roles![0] !== h.roles![1] || h.roles![0] === "on-accent")),
    );
    expect(findings).toEqual([]);
  });

  it("an alias is declared again in the dark block: a var() in :root resolves there, with the light value", () => {
    const d = proposeSystem({ ...base, brandColor: "#4f46e5" }).directions[0]!;
    const aliases = d.tokens.filter((t) => t.alias);
    expect(aliases.map((t) => t.name)).toContain("--color-info-bg");
    for (const t of aliases) expect(d.css.dark.text, t.name).toContain(`${t.name}: var(${t.alias});`);
    const ctx = createContext(project(`${d.css.light.text}\n\n${d.css.dark.text}\n`));
    const info = ctx.tokens.tokens.find((t) => t.name === "--color-info-bg")!;
    expect(Object.keys(info.values).sort()).toEqual(["dark", "light"]);
  });

  it.each(["vite", "next"] as const)("B-026: the lab's specimen draws only with the system's tokens: check_ui finds 0 errors (%s)", async (framework) => {
    const SYSTEM = path.join(SRC, "..", "..", "skills", "variants", "templates", "next-app", "system");
    for (const d of proposeSystem({ ...base, brandColor: "#4f46e5" }).directions) {
      const css = `${d.css.light.text}\n\n${d.css.dark.text}\n`;
      const root =
        framework === "vite"
          ? project(css)
          : project("", { dependencies: { next: "15.3.0", react: "19.0.0", "react-dom": "19.0.0" } });
      if (framework === "next") {
        fs.mkdirSync(path.join(root, "app"), { recursive: true });
        fs.writeFileSync(path.join(root, "app", "globals.css"), css);
        fs.writeFileSync(path.join(root, "app", "layout.tsx"), 'import "./globals.css";\nexport default function L({ children }: { children: React.ReactNode }) { return <html><body>{children}</body></html>; }\n');
      }
      const dir = framework === "vite" ? "src/preview" : "app/preview";
      fs.mkdirSync(path.join(root, dir), { recursive: true });
      for (const f of ["lab-specimen.tsx", "lab-specimen.module.css"]) fs.copyFileSync(path.join(SYSTEM, f), path.join(root, dir, f));
      const { call, close } = await connect(root);
      const r = await call("check_ui", { path: dir });
      const errors = (r.structuredContent.violations ?? []).filter((v: { severity: string }) => v.severity === "error");
      expect(r.structuredContent.summary.files, `${framework}: files checked`).toBe(2);
      expect(r.structuredContent.summary.error, `${framework} ${d.id}: ${JSON.stringify(errors.slice(0, 3))}`).toBe(0);
      await close();
    }
  });

  it("B-026: css.lab scopes each direction to html[data-facha-direction], light and dark", () => {
    const d = proposeSystem({ ...base, brandColor: "#4f46e5", style: "sober" }).directions[0]!;
    expect(d.css.lab).toContain('html[data-facha-direction="brand-sober"] {');
    expect(d.css.lab).toContain('html.dark[data-facha-direction="brand-sober"] {');
    expect(d.css.lab).toContain("--color-info-bg: var(--color-primary-subtle);");
    expect(d.css.lab).not.toMatch(/:root|@theme|^\.dark/m);
  });

  it("in Tailwind 4 the default theme goes in @theme, which facha-ui reads too", () => {
    const d = proposeSystem({ ...base, brandColor: "#4f46e5", format: "tailwind4" }).directions[0]!;
    expect(d.css.light.selector).toBe("@theme");
    const ctx = createContext(project(`@import "tailwindcss";\n\n${d.css.light.text}\n\n${d.css.dark.text}\n`, { dependencies: { react: "18.3.1", "react-dom": "18.3.1", tailwindcss: "4.1.0" }, devDependencies: { vite: "5.4.10" } }));
    expect(coverage(ctx).status).toBe("ok");
    expect(ctx.tokens.tokens.find((t) => t.name === "--color-primary")?.role).toBe("accent.primary");
  });
});

describe("S2 · the generator only computes", () => {
  it("imports culori and its own modules, and touches no file, network or process", () => {
    for (const f of ["generate.ts", "standards.ts"]) {
      const code = fs.readFileSync(path.join(SRC, f), "utf8");
      const imports = [...code.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]);
      expect(imports.every((i) => i === "culori" || i === "./standards.js"), `${f}: ${imports}`).toBe(true);
      expect(code).not.toMatch(/\brequire\s*\(|\bimport\s*\(|\beval\s*\(|new Function|node:|fetch\(|process\./);
    }
  });
});
