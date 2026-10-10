import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contrast } from "../src/color.js";
import { createContext, toPx } from "../src/context.js";
import { tokenColor } from "../src/tokens.js";
import { connect } from "./helpers.js";

// shadcn/ui projects, Tailwind 3 (HSL channels inside @layer, mapping in tailwind.config) and
// Tailwind 4 (oklch with @theme inline). SPEC §7.23.

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

async function load(name: string) {
  const c = await connect(path.join(FIXTURES, name));
  const ds = (await c.call("get_design_system")).structuredContent;
  const check = (await c.call("check_ui", { path: "app/page.tsx" })).structuredContent;
  await c.close();
  const byName = new Map<string, any>(ds.tokens.map((t: any) => [t.name, t]));
  return { ds, check, byName, ctx: createContext(path.join(FIXTURES, name)) };
}

const ratio = (ctx: ReturnType<typeof createContext>, fg: string, bg: string, theme: string) =>
  contrast(tokenColor(ctx.tokens, fg, theme)!, tokenColor(ctx.tokens, bg, theme)!);

describe("shadcn-tw3 · HSL channels in @layer, mapping in tailwind.config", () => {
  let r: Awaited<ReturnType<typeof load>>;
  beforeAll(async () => {
    r = await load("shadcn-tw3");
  });
  afterAll(() => undefined);

  it("finds the design system: not missing", () => {
    expect(["partial", "ok"]).toContain(r.ds.status);
    expect(r.ds.project.themes.map((t: any) => t.name)).toEqual(["light", "dark"]);
  });

  it("reads the channels as colors with their roles and their values per theme", () => {
    const expected: Record<string, string> = {
      "--background": "surface.base",
      "--foreground": "text.primary",
      "--primary": "accent.primary",
      "--primary-foreground": "on-accent",
      "--muted-foreground": "text.secondary",
      "--border": "border.default",
    };
    for (const [name, role] of Object.entries(expected)) expect(r.byName.get(name), name).toMatchObject({ type: "color", format: "hsl-channels", role });
    expect(r.byName.get("--background").values).toEqual({ light: "0 0% 100%", dark: "222.2 84% 4.9%" });
    expect(r.byName.get("--radius")).toMatchObject({ type: "length", role: "radius" });
  });

  it("calculates contrast in both themes, --muted-foreground against --background included", () => {
    expect(ratio(r.ctx, "--foreground", "--background", "light")).toBeGreaterThan(15);
    expect(ratio(r.ctx, "--foreground", "--background", "dark")).toBeGreaterThan(15);
    expect(ratio(r.ctx, "--muted-foreground", "--background", "light")).toBeCloseTo(4.76, 1);
    expect(ratio(r.ctx, "--muted-foreground", "--background", "dark")).toBeCloseTo(7.8, 1);
    // Every text token is measured: none fails against the surfaces of this theme.
    expect(r.ds.health.filter((h: any) => h.kind === "token-contrast")).toEqual([]);
  });

  it("check_ui marks only the hand-written color: not rounded-md, bg-primary or text-foreground", () => {
    expect(r.check.violations.map((v: any) => `${v.rule} ${v.found}`)).toEqual(["color-literal text-[#1e293b]"]);
  });

  it("says what it assumed: shadcn, the channels and the config read without running it", () => {
    const text = r.ds.assumptions.join(" ");
    expect(text).toMatch(/shadcn\/ui project \(components\.json\)/);
    expect(text).toMatch(/token\(s\) written as bare HSL channels read as colors/);
    expect(text).toMatch(/Tailwind config read statically \(tailwind\.config\.ts, never run\)/);
    expect(text).toMatch(/Not read in tailwind\.config\.ts without running it: plugins .*\(line 31\)/);
  });
});

describe("calc() of lengths", () => {
  it("evaluates calc() made only of px, rem and numbers, and nothing else", () => {
    expect(toPx("calc(0.625rem - 2px)")).toBe(8);
    expect(toPx("calc(0.625rem + 4px)")).toBe(14);
    expect(toPx("calc(1rem * 2 - 4px)")).toBe(28);
    for (const bad of ["calc(100% - 2px)", "calc(var(--radius) - 2px)", "calc(10px / 0)", "calc(2px-1px)"]) expect(toPx(bad), bad).toBeNull();
  });
});

describe("shadcn-tw4 · oklch with @theme inline", () => {
  let r: Awaited<ReturnType<typeof load>>;
  beforeAll(async () => {
    r = await load("shadcn-tw4");
  });

  it("keeps working as before: partial, every required role present", () => {
    expect(r.ds.status).toBe("partial");
    expect(r.ds.coverage.requiredMissing).toEqual([]);
  });

  it("gives the canonical tokens the shadcn roles", () => {
    const roles = Object.fromEntries(["--background", "--card", "--foreground", "--muted", "--accent", "--muted-foreground", "--primary", "--primary-foreground", "--destructive", "--border", "--input", "--ring"].map((n) => [n, r.byName.get(n)?.role]));
    expect(roles).toEqual({
      "--background": "surface.base",
      "--card": "surface.raised",
      "--foreground": "text.primary",
      "--muted": "surface.raised",
      "--accent": "surface.raised",
      "--muted-foreground": "text.secondary",
      "--primary": "accent.primary",
      "--primary-foreground": "on-accent",
      "--destructive": "status.danger",
      "--border": "border.default",
      "--input": "border.default",
      "--ring": "border.default",
    });
    expect(r.byName.get("--color-muted-foreground")?.role).toBe("text.secondary");
    expect(r.byName.get("--primary").format).toBeUndefined();
  });

  it("measures --muted-foreground on the soft surfaces, where shadcn's default falls short in light", () => {
    const finding = r.ds.health.find((h: any) => h.kind === "token-contrast" && h.token === "--muted-foreground");
    expect(finding).toMatchObject({ status: "fails-in-default-theme", breaksIn: ["light"] });
    expect(finding.ratios.light).toBeLessThan(4.5);
    expect(ratio(r.ctx, "--muted-foreground", "--background", "light")).toBeGreaterThan(4.5);
    // --primary-foreground is text on the brand, not on a surface: no false alarm.
    expect(r.ds.health.some((h: any) => h.kind === "token-contrast" && h.token === "--primary-foreground")).toBe(false);
  });

  it("treats @theme inline aliases as aliases: no missing-theme or repeated near-duplicate findings", () => {
    const aliases = (h: any) => [h.token, ...(h.tokens ?? [])].some((n: string) => n?.includes("--color-"));
    expect(r.ds.health.filter((h: any) => h.kind === "theme-missing")).toEqual([]);
    expect(r.ds.health.filter((h: any) => h.kind === "near-duplicate-tokens" && aliases(h))).toEqual([]);
    // The real near-duplicates of shadcn's neutral theme are reported once, between the tokens themselves.
    expect(r.ds.health.filter((h: any) => h.kind === "near-duplicate-tokens").map((h: any) => h.token)).toEqual(["--accent ~ --muted", "--card ~ --primary-foreground", "--card-foreground ~ --foreground"]);
  });

  it("reads calc(var(--radius) ± n) as a radius with its px value", () => {
    for (const n of ["--radius-sm", "--radius-md", "--radius-lg", "--radius-xl"]) expect(r.byName.get(n), n).toMatchObject({ type: "length", role: "radius" });
    // One entry per px value: --radius and --radius-lg are both 10px.
    expect(r.ds.scales.radius.values).toEqual(["6px (--radius-sm)", "8px (--radius-md)", expect.stringMatching(/^10px \(--radius(-lg)?\)$/), "14px (--radius-xl)"]);
  });

  it("check_ui marks only the hand-written color: rounded-md is mapped in @theme inline", () => {
    expect(r.check.violations.map((v: any) => `${v.rule} ${v.found}`)).toEqual(["color-literal text-[#1e293b]"]);
  });
});
