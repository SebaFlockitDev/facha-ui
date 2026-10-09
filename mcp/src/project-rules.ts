import type { Context } from "./context.js";
import { baseUtility } from "./tailwind.js";
import { TAILWIND_PALETTE } from "./tailwind-palette.js";
import type { Severity } from "./types.js";

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
  if (ctx.definedCustomProps.has(`--color-${p.key}`)) return false;
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
