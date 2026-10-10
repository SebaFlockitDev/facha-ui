import type { AtRule } from "postcss";
import { deltaE, findColorLiterals, parseColor, round, toHex } from "./color.js";
import type { Context } from "./context.js";
import { toPx } from "./context.js";
import type { Usage } from "./sources/usage.js";
import { suggestFontSize } from "./suggest.js";
import { baseUtility } from "./tailwind.js";
import { TAILWIND_PALETTE } from "./tailwind-palette.js";
import { TAILWIND_SCALES } from "./tailwind-scales.js";
import { aliasOf, tokenColor, tokenValue } from "./tokens.js";
import type { Severity, Suggestion } from "./types.js";

/**
 * Rules that depend on the project's own choices (SPEC §2.a.4, §7.12): Tailwind's default palette
 * used instead of the project's tokens, and the declarative `custom` rules of the config.
 */

// ---------- tailwind-palette-color ----------

/** Utility prefix → CSS property it colors (for role-aware suggestions). Longest prefixes first. */
const PALETTE_PREFIXES: [string, string][] = [
  ["inset-shadow", "box-shadow"],
  ["inset-ring", "border-color"],
  ["ring-offset", "border-color"],
  ["placeholder", "color"],
  ["decoration", "color"],
  ["outline", "outline-color"],
  ["border-x", "border-color"],
  ["border-y", "border-color"],
  ["border-t", "border-color"],
  ["border-r", "border-color"],
  ["border-b", "border-color"],
  ["border-l", "border-color"],
  ["border-s", "border-color"],
  ["border-e", "border-color"],
  ["border", "border-color"],
  ["divide", "border-color"],
  ["shadow", "box-shadow"],
  ["accent", "color"],
  ["stroke", "stroke"],
  ["caret", "color"],
  ["ring", "border-color"],
  ["text", "color"],
  ["fill", "fill"],
  ["from", "background-color"],
  ["via", "background-color"],
  ["bg", "background-color"],
  ["to", "background-color"],
];

const PALETTE_NAMES = [...new Set(Object.keys(TAILWIND_PALETTE).map((k) => k.replace(/-\d+$/, "")))].sort((a, b) => b.length - a.length);
const PALETTE_RE = new RegExp(
  `^(${PALETTE_PREFIXES.map(([p]) => p).join("|")})-(${PALETTE_NAMES.join("|")})(?:-(\\d{2,3}))?(?:\\/([\\w.%]+|\\[[^\\]]+\\]))?$`,
);
const PROPERTY_OF = new Map(PALETTE_PREFIXES);

export interface PaletteClass {
  /** Utility without variants, e.g. "bg-gray-100". */
  utility: string;
  /** Palette key, e.g. "gray-100" or "white". */
  key: string;
  /** Tailwind's value for it. */
  value: string;
  /** CSS property the utility colors. */
  property: string;
  opacity: string | null;
}

/** Recognises a default-palette color utility (with or without variants and opacity). */
export function parsePaletteClass(raw: string): PaletteClass | null {
  const utility = baseUtility(raw);
  const m = utility.match(PALETTE_RE);
  if (!m) return null;
  const key = m[3] ? `${m[2]}-${m[3]}` : m[2]!;
  const value = TAILWIND_PALETTE[key];
  if (!value) return null;
  return { utility, key, value, property: PROPERTY_OF.get(m[1]!)!, opacity: m[4] ?? null };
}

/**
 * Whether a palette utility is a design-system violation in this project. It is not when the
 * project does not use Tailwind, adopted the default theme on purpose (tailwind.useDefaultTheme),
 * mapped that color in @theme (--color-<key>), or defines a class with that exact name.
 */
export function isForeignPalette(ctx: Context, p: PaletteClass): boolean {
  if (!ctx.project.hasTailwind) return false;
  if ((ctx.project.config.tailwind as { useDefaultTheme?: boolean } | undefined)?.useDefaultTheme === true) return false;
  if (themeVariables(ctx).has(`--color-${p.key}`)) return false;
  if (ctx.componentClasses.some((c) => c.selector === `.${p.utility}`)) return false;
  return true;
}

// ---------- custom rules ----------

export interface CompiledCustomRule {
  id: string;
  kind: "forbid-token" | "forbid-class";
  severity: Severity | "off";
  message: string;
  selector?: RegExp;
  property?: RegExp;
  tokens?: Set<string>;
  pattern?: RegExp;
}

const compiled = new WeakMap<Context, CompiledCustomRule[]>();

export function customRules(ctx: Context): CompiledCustomRule[] {
  const cached = compiled.get(ctx);
  if (cached) return cached;
  const out: CompiledCustomRule[] = (ctx.project.config.custom ?? []).map((r: any) => {
    if (r.kind === "forbid-token") {
      return {
        id: r.id,
        kind: "forbid-token",
        severity: r.severity ?? "error",
        message: r.message ?? `Custom rule ${r.id}: ${r.tokens.join(", ")} cannot be used here.`,
        selector: r.selector ? new RegExp(r.selector) : undefined,
        property: r.property ? new RegExp(r.property) : undefined,
        tokens: new Set<string>(r.tokens),
      };
    }
    return {
      id: r.id,
      kind: "forbid-class",
      severity: r.severity ?? "error",
      message: r.message ?? `Custom rule ${r.id}: classes matching /${r.pattern}/ are not allowed.`,
      pattern: new RegExp(r.pattern),
    };
  });
  compiled.set(ctx, out);
  return out;
}

/** Summary of the custom rules for get_design_system → rules and the rules resource. */
export function customRulesInfo(ctx: Context) {
  return customRules(ctx).map((r) => ({
    id: `custom/${r.id}`,
    severity: r.severity,
    summary:
      r.kind === "forbid-token"
        ? `${r.message} (forbid-token: ${[...r.tokens!].join(", ")}${r.selector ? ` in selectors /${r.selector.source}/` : ""}${r.property ? `, property /${r.property.source}/` : ""})`
        : `${r.message} (forbid-class: /${r.pattern!.source}/)`,
  }));
}

// ---------- @theme variables ----------

const themeVars = new WeakMap<Context, Set<string>>();

/**
 * The utilities the project maps to its own values, as @theme variable names: the variables of
 * @theme blocks (Tailwind 4), the theme keys read statically from tailwind.config (Tailwind 3) and
 * tailwind.mapped from the config, for what cannot be read without running code.
 */
export function themeVariables(ctx: Context): Set<string> {
  const cached = themeVars.get(ctx);
  if (cached) return cached;
  const out = new Set<string>([...(ctx.tailwindConfig?.mapped ?? []), ...((ctx.project.config.tailwind as { mapped?: string[] } | undefined)?.mapped ?? [])]);
  for (const root of ctx.cssRoots.values()) {
    root.walkAtRules("theme", (at: AtRule) => {
      at.walkDecls((d) => {
        if (d.prop.startsWith("--")) out.add(d.prop);
      });
    });
  }
  themeVars.set(ctx, out);
  return out;
}

// ---------- tailwind-default-scale ----------

export type ScaleKind = "radius" | "shadow" | "fontSize" | "tracking" | "leading";

export interface ScaleClass {
  utility: string;
  kind: ScaleKind;
  /** Step name, e.g. "lg". */
  name: string;
  /** The @theme variable that would map it, e.g. "--radius-lg". */
  themeVar: string;
  /** Tailwind's default value. */
  value: string;
  property: string;
}

const SCALE_PATTERNS: { kind: ScaleKind; re: RegExp; varPrefix: (m: RegExpMatchArray) => string; property: string; bare?: string }[] = [
  { kind: "radius", re: /^rounded(?:-(?:t|r|b|l|tl|tr|br|bl|s|e|ss|se|es|ee))?(?:-(xs|sm|md|lg|xl|2xl|3xl|4xl))?$/, varPrefix: () => "--radius-", property: "border-radius", bare: "sm" },
  { kind: "shadow", re: /^(shadow|inset-shadow|drop-shadow)(?:-(2xs|xs|sm|md|lg|xl|2xl|inner))?$/, varPrefix: (m) => `--${m[1]}-`, property: "box-shadow", bare: "sm" },
  { kind: "fontSize", re: /^text-(xs|sm|base|lg|xl|[2-9]xl)(?:\/[\w.]+)?$/, varPrefix: () => "--text-", property: "font-size" },
  { kind: "tracking", re: /^tracking-(tighter|tight|wide|wider|widest)$/, varPrefix: () => "--tracking-", property: "letter-spacing" },
  { kind: "leading", re: /^leading-(tight|snug|relaxed|loose)$/, varPrefix: () => "--leading-", property: "line-height" },
];

function scaleTable(kind: ScaleKind, m: RegExpMatchArray): Record<string, string> {
  switch (kind) {
    case "radius":
      return TAILWIND_SCALES.radius;
    case "fontSize":
      return TAILWIND_SCALES.fontSize;
    case "tracking":
      return TAILWIND_SCALES.tracking;
    case "leading":
      return TAILWIND_SCALES.leading;
    case "shadow":
      return m[1] === "inset-shadow" ? TAILWIND_SCALES.insetShadow : m[1] === "drop-shadow" ? TAILWIND_SCALES.dropShadow : TAILWIND_SCALES.shadow;
  }
}

/** Recognises a default-scale utility for radius, shadow, font size, tracking or leading. */
export function parseScaleClass(raw: string): ScaleClass | null {
  const utility = baseUtility(raw);
  for (const p of SCALE_PATTERNS) {
    const m = utility.match(p.re);
    if (!m) continue;
    const name = (p.kind === "shadow" ? m[2] : m[1]) ?? p.bare;
    if (!name) return null;
    const value = scaleTable(p.kind, m)[name];
    if (!value) return null;
    return { utility, kind: p.kind, name, themeVar: `${p.varPrefix(m)}${name}`, value, property: p.property };
  }
  return null;
}

/**
 * Whether a default-scale utility is a design-system violation: the project uses Tailwind, did not
 * adopt its default theme, did not allow that scale (tailwind.allowDefaultScale), did not map the
 * step in @theme, and has no class with that exact name.
 */
export function isForeignScale(ctx: Context, s: ScaleClass): boolean {
  if (!ctx.project.hasTailwind) return false;
  const tw = ctx.project.config.tailwind as { useDefaultTheme?: boolean; allowDefaultScale?: Partial<Record<ScaleKind, boolean>> } | undefined;
  if (tw?.useDefaultTheme === true) return false;
  if (tw?.allowDefaultScale?.[s.kind] === true) return false;
  if (themeVariables(ctx).has(s.themeVar)) return false;
  if (ctx.componentClasses.some((c) => c.selector === `.${s.utility}`)) return false;
  return true;
}

const SCALE_LABEL: Record<ScaleKind, string> = { radius: "radius", shadow: "shadow", fontSize: "font size", tracking: "letter spacing", leading: "line height" };

/** The project's closest value for a default-scale step: a font-size class, a radius token, or the list of shadow tokens. */
export function suggestScale(ctx: Context, s: ScaleClass): Suggestion {
  const theme = ctx.tokens.themes[0]?.name ?? "light";
  const none = (detail: string): Suggestion => ({ match: "none", kind: "none", value: null, detail, source: null });
  if (s.kind === "fontSize") {
    const px = toPx(s.value);
    return px == null ? none(`No font-size step for ${s.value}.`) : suggestFontSize(ctx, `${round(px, 2)}px`);
  }
  if (s.kind === "radius") {
    const px = toPx(s.value);
    if (px == null) return none(`No radius step for ${s.value}.`);
    const radii = ctx.tokens.tokens
      .filter((t) => t.role === "radius")
      .map((t) => ({ name: t.name, source: t.source, px: toPx(tokenValue(ctx.tokens, t.name, theme) ?? "") }))
      .filter((x): x is { name: string; source: string; px: number } => x.px != null)
      .sort((a, b) => Math.abs(a.px - px) - Math.abs(b.px - px) || (a.name < b.name ? -1 : 1));
    const best = radii[0];
    if (best && Math.abs(best.px - px) <= 2) {
      return {
        match: best.px === px ? "exact" : "nearest",
        kind: "token",
        value: `var(${best.name})`,
        detail: `${best.name} is ${best.px}px (${s.utility} is ${px}px).`,
        source: best.source,
      };
    }
    return none(
      radii.length
        ? `No radius token within 2px of ${px}px. Project radius tokens: ${radii.map((r) => `${r.name} (${r.px}px)`).join(", ")}.`
        : "No radius tokens in the project: it is a gap (/facha-ui:init scales can propose a scale).",
    );
  }
  if (s.kind === "shadow") {
    const shadows = ctx.tokens.tokens.filter((t) => t.type === "shadow").map((t) => t.name);
    return none(shadows.length ? `Project shadow tokens: ${shadows.join(", ")}. Which one fits is a design decision.` : "No shadow tokens in the project: it is a gap.");
  }
  return none(`No ${SCALE_LABEL[s.kind]} token in the project; check the guidelines.`);
}

export function describeScale(s: ScaleClass): string {
  return `${s.utility} is Tailwind's default ${SCALE_LABEL[s.kind]} ${s.name} (${s.value}), not a project value. Map it in @theme (${s.themeVar}) or use the project's token.`;
}

// ---------- palette sprawl (health) ----------

/**
 * Values that are almost the same and could be one (informative, health): color tokens within
 * ΔE 2 of each other in every theme, hand-written colors within ΔE 2 of each other, and font sizes
 * (±0.5px) or radii (±1px) used in component classes that are nearly equal.
 */
export function sprawl(ctx: Context, usages: Usage[]) {
  const out: any[] = [];
  const themes = ctx.tokens.themes.map((t) => t.name);

  // 1. Near-duplicate color tokens (in every theme, and not aliases of each other). Pure aliases
  // (--color-x: var(--x)) are left out: the pair of their targets is reported once.
  const colors = ctx.tokens.tokens.filter((t) => t.type === "color" && !aliasOf(ctx.tokens, t.name));
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const a = colors[i]!;
      const b = colors[j]!;
      const aliases = Object.values(a.values).some((v) => v.includes(`var(${b.name}`)) || Object.values(b.values).some((v) => v.includes(`var(${a.name}`));
      if (aliases) continue;
      const d: Record<string, number> = {};
      let all = themes.length > 0;
      for (const th of themes) {
        const ca = tokenColor(ctx.tokens, a.name, th);
        const cb = tokenColor(ctx.tokens, b.name, th);
        const x = ca && cb ? deltaE(ca, cb) : Number.POSITIVE_INFINITY;
        if (!(x < 2)) {
          all = false;
          break;
        }
        d[th] = round(x, 2);
      }
      if (!all) continue;
      out.push({
        kind: "near-duplicate-tokens",
        token: `${a.name} ~ ${b.name}`,
        tokens: [a.name, b.name],
        roles: [a.role, b.role],
        deltaE: d,
        sources: [a.source, b.source],
        note: "Almost the same color in every theme: one token would do. If the difference is intentional (different roles that happen to match), ignore it.",
      });
    }
  }

  // 2. Near-duplicate hand-written colors.
  const literals = new Map<string, { color: NonNullable<ReturnType<typeof parseColor>>; where: string[] }>();
  for (const u of usages) {
    if (u.kind !== "decl") continue;
    for (const lit of findColorLiterals(u.value, u.property)) {
      const c = parseColor(lit.text);
      if (!c) continue;
      const hex = toHex(c).toLowerCase();
      const loc = u.locAt(lit.index);
      const e = literals.get(hex) ?? { color: c, where: [] };
      e.where.push(`${loc.file}:${loc.line}`);
      literals.set(hex, e);
    }
  }
  const lits = [...literals.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
  for (let i = 0; i < lits.length; i++) {
    for (let j = i + 1; j < lits.length; j++) {
      const [ha, a] = lits[i]!;
      const [hb, b] = lits[j]!;
      const x = deltaE(a.color, b.color);
      if (!(x < 2)) continue;
      out.push({
        kind: "near-duplicate-literals",
        token: `${ha} ~ ${hb}`,
        values: [ha, hb],
        deltaE: round(x, 2),
        where: [...a.where.slice(0, 3), ...b.where.slice(0, 3)],
        note: "Two hand-written colors that look the same: they could be one value, ideally a token.",
      });
    }
  }

  // 3. Near-duplicate steps: font sizes (±0.5px) and radii (±1px) used in component classes.
  const steps = (prop: string, values: Map<number, string[]>, tolerance: number) => {
    const sorted = [...values.entries()].sort(([a], [b]) => a - b);
    let cluster: [number, string[]][] = [];
    const flush = () => {
      if (cluster.length > 1) {
        out.push({
          kind: "near-duplicate-steps",
          token: `${prop} ${cluster.map(([v]) => `${round(v, 2)}px`).join(" ~ ")}`,
          property: prop,
          values: cluster.map(([v]) => `${round(v, 2)}px`),
          where: [...new Set(cluster.flatMap(([, sels]) => sels))].slice(0, 6),
          note: `Values this close look the same: one step of the ${prop} scale would do.`,
        });
      }
      cluster = [];
    };
    for (const entry of sorted) {
      if (cluster.length && entry[0] - cluster[0]![0] > tolerance) flush();
      cluster.push(entry);
    }
    flush();
  };
  steps("font-size", ctx.fontSizeUses, 0.5);
  const radii = new Map<number, string[]>();
  for (const cc of ctx.componentClasses) {
    for (const d of cc.decls) {
      if (!/radius/.test(d.prop) || d.value.includes("var(")) continue;
      const px = toPx(d.value);
      if (px != null && px < 999) radii.set(px, [...(radii.get(px) ?? []), cc.selector]);
    }
  }
  steps("border-radius", radii, 1);
  return out;
}
