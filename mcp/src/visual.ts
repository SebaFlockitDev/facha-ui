import { differenceEuclidean, filterDeficiencyDeuter, filterDeficiencyProt, type Color } from "culori";
import type { Rule } from "postcss";
import { contrast, findColorLiterals, parseColor, round, toHex } from "./color.js";
import type { Context } from "./context.js";
import { selectorContext, themeForSelector, tokenColor } from "./tokens.js";
import type { Suggestion } from "./types.js";

/**
 * Visual-quality checks that stay deterministic (SPEC §7.11): contrast of each text usage against
 * its real background, classes whose text color fails contrast, non-text contrast of interactive
 * parts (WCAG 1.4.11) and whether status colors can be told apart, also with color-vision
 * deficiencies. Everything is measured from the project's own tokens and CSS.
 */

/** Semantic hints in selectors. Order matters: "unpaid" must read as danger before "paid". */
export const STATUS_KINDS: [string, RegExp][] = [
  ["danger", /danger|error|unpaid|fail|cancel|reject|destructive|invalid|negative|overdue/],
  ["warning", /warn|pending|review|caution|attention/],
  ["success", /success|paid|(^|[^a-z])ok([^a-z]|$)|done|complete|approved|positive/],
  ["info", /info|sent|notice|hint/],
  ["neutral", /inactive|neutral|archiv/],
];

/** Selector without pseudo-classes/elements, so ":not(:disabled)" is not read as a meaning. */
export function withoutPseudo(selector: string): string {
  return selector.replace(/::?[\w-]+(\((?:[^()]|\([^()]*\))*\))?/g, "");
}

export function statusKindOf(selector: string): string | null {
  const t = withoutPseudo(selector).toLowerCase();
  for (const [kind, re] of STATUS_KINDS) if (re.test(t)) return kind;
  return null;
}

export interface ContrastResult {
  /** Themes where the pair stays below the minimum. */
  failing: string[];
  ratios: Record<string, number>;
  against: Record<string, string>;
  minRatio: number;
  /** The background is known: the rule's own, or surfaces the team declared in contrast.surfaces. */
  certain: boolean;
}

interface VisualIndex {
  /** `${theme}|${baseSelector}|${color|background}` declared in a theme-scoped rule. */
  overrides: Set<string>;
  /** Class name → failing text contrast of a component class that sets its color. */
  classFindings: Map<string, { result: ContrastResult; selector: string; value: string; background: string | null; source: string }>;
}

const indexes = new WeakMap<Context, VisualIndex>();
const oklabDistance = differenceEuclidean("oklab");
const deuteranopia = filterDeficiencyDeuter(1);
const protanopia = filterDeficiencyProt(1);

export function minRatioOf(ctx: Context): number {
  return ctx.project.config.contrast?.minRatio ?? 4.5;
}

function surfaces(ctx: Context): { names: string[]; configured: boolean } {
  const configured = ctx.project.config.contrast?.surfaces;
  if (configured?.length) return { names: configured, configured: true };
  return { names: ctx.tokens.tokens.filter((t) => t.role.startsWith("surface.")).map((t) => t.name), configured: false };
}

/** Color of a CSS value in a theme: var(--token), a literal, or the first color inside a shorthand. */
export function colorOf(ctx: Context, raw: string | null | undefined, theme: string): Color | undefined {
  if (!raw) return undefined;
  const v = raw.trim();
  const only = v.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*([^()]+))?\)$/);
  if (only) return tokenColor(ctx.tokens, only[1]!, theme) ?? (only[2] ? parseColor(only[2]) : undefined);
  const direct = parseColor(v);
  if (direct) return direct;
  for (const m of v.matchAll(/var\(\s*(--[\w-]+)/g)) {
    const c = tokenColor(ctx.tokens, m[1]!, theme);
    if (c) return c;
  }
  const lit = findColorLiterals(v)[0];
  return lit ? parseColor(lit.text) : undefined;
}

/** Splits "html.dark .chip" into its theme and base selector when it is scoped to a non-default theme. */
function themeScope(ctx: Context, selector: string | null): { theme: string | null; base: string | null } {
  if (!selector) return { theme: null, base: null };
  for (const th of ctx.tokens.themes.slice(1)) {
    const prefix = th.selector.trim() + " ";
    if (selector.startsWith(prefix)) return { theme: th.name, base: selector.slice(prefix.length).trim() };
  }
  return { theme: null, base: selector };
}

const BACKGROUND_PROPS = new Set(["background", "background-color"]);

function index(ctx: Context): VisualIndex {
  const cached = indexes.get(ctx);
  if (cached) return cached;
  const idx: VisualIndex = { overrides: new Set(), classFindings: new Map() };
  indexes.set(ctx, idx);
  const rules: { rule: Rule; selector: string; file: string }[] = [];
  for (const [file, root] of [...ctx.cssRoots.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    root.walkRules((rule) => {
      const selector = selectorContext(rule);
      if (themeForSelector(selector, ctx.project.config.tokens.themes) !== null) return;
      rules.push({ rule, selector, file });
      const { theme, base } = themeScope(ctx, selector);
      if (!theme || !base) return;
      for (const n of rule.nodes ?? []) {
        if (n.type !== "decl") continue;
        if (n.prop === "color") idx.overrides.add(`${theme}|${base}|color`);
        if (BACKGROUND_PROPS.has(n.prop)) idx.overrides.add(`${theme}|${base}|background`);
      }
    });
  }
  const minRatio = minRatioOf(ctx);
  for (const { rule, selector, file } of rules) {
    if (selector.includes(":") || selector.startsWith("@")) continue; // states and at-rules are not what a class name means
    const decls = (rule.nodes ?? []).filter((n: any) => n.type === "decl") as any[];
    const color = decls.find((d) => d.prop === "color");
    if (!color) continue;
    const bg = decls.find((d) => BACKGROUND_PROPS.has(d.prop))?.value ?? null;
    const result = textContrast(ctx, color.value, bg, selector, minRatio);
    if (!result || result.failing.length === 0) continue;
    // The class a component uses is the one in the last compound selector ("p" in ".table .p").
    for (const part of selector.split(",")) {
      const last = part.trim().split(/[\s>+~]+/).pop() ?? "";
      for (const m of last.matchAll(/\.([\w-]+)/g)) {
        const name = m[1]!;
        if (!idx.classFindings.has(name)) {
          idx.classFindings.set(name, { result, selector, value: color.value, background: bg, source: `${file}:${color.source?.start?.line ?? 0}` });
        }
      }
    }
  }
  return idx;
}

/**
 * Contrast of a text color against its background in every theme. The background is the rule's
 * own when it declares one, otherwise the worst of the reference surfaces. Themes where a
 * theme-scoped rule overrides the color or the background are skipped. Returns null when a value
 * cannot be resolved to a color (gradients, images, unknown tokens): nothing is guessed.
 */
export function textContrast(
  ctx: Context,
  value: string,
  background: string | null,
  selector: string | null,
  minRatio: number,
  opts: { text?: boolean } = { text: true },
): ContrastResult | null {
  const { theme: scoped, base } = themeScope(ctx, selector);
  const idx = index(ctx);
  const themes = ctx.tokens.themes.map((t) => t.name).filter((t) => !scoped || t === scoped);
  const surf = surfaces(ctx);
  const ratios: Record<string, number> = {};
  const against: Record<string, string> = {};
  for (const th of themes) {
    if (!scoped && base && th !== ctx.tokens.themes[0]?.name) {
      if (idx.overrides.has(`${th}|${base}|color`)) continue;
      if (background && idx.overrides.has(`${th}|${base}|background`)) continue;
    }
    const fg = colorOf(ctx, value, th);
    if (!fg) return null;
    const baseSurface = surf.names[0] ? tokenColor(ctx.tokens, surf.names[0], th) : undefined;
    if (background) {
      const bg = colorOf(ctx, background, th);
      // Unknown backdrop: a gradient/image, or a translucent overlay over something we cannot see.
      if (!bg || (bg.alpha ?? 1) < 1) return null;
      ratios[th] = contrast(fg, bg, baseSurface);
      against[th] = background.trim();
      continue;
    }
    let worst = Number.POSITIVE_INFINITY;
    let worstName = "";
    for (const s of surf.names) {
      const bg = tokenColor(ctx.tokens, s, th);
      if (!bg) continue;
      const r = contrast(fg, bg, baseSurface);
      if (r < worst) {
        worst = r;
        worstName = s;
      }
    }
    if (!Number.isFinite(worst)) continue;
    ratios[th] = worst;
    against[th] = worstName;
  }
  const measured = Object.keys(ratios);
  if (measured.length === 0) return null;
  // Text that would be invisible on the reference surfaces in the default theme sits on another
  // background (a dark sidebar, a colored header): we cannot see it, so we do not guess.
  const defaultTheme = ctx.tokens.themes[0]?.name;
  if (opts.text !== false && !background && defaultTheme && ratios[defaultTheme] !== undefined && ratios[defaultTheme]! < 1.5) return null;
  return {
    failing: measured.filter((th) => ratios[th]! < minRatio),
    ratios,
    against,
    minRatio,
    certain: !!background || surf.configured,
  };
}

export function describeContrast(r: ContrastResult): string {
  return r.failing.map((th) => `${r.ratios[th]}:1 on ${r.against[th]} in ${th}`).join("; ") + ` (needs ${r.minRatio}:1)`;
}

/** A text token that reaches the minimum on the same background in every theme, closest to the current color. */
export function suggestReadable(ctx: Context, value: string, background: string | null, selector: string | null, r: ContrastResult): Suggestion {
  const defaultTheme = ctx.tokens.themes[0]?.name ?? "light";
  const current = colorOf(ctx, value, defaultTheme);
  const readable = (role: string) => /^(text\.|on-accent|accent|status\.)/.test(role);
  const familyOf = (role: string) => role.split(".")[0]!;
  // The role the value plays: its token's role, or the role of the token the literal (almost) equals.
  const own = value.trim().match(/^var\(\s*(--[\w-]+)\s*\)$/)?.[1];
  const twin = !own && current
    ? ctx.tokens.tokens.find((t) => {
        const c = t.type === "color" ? tokenColor(ctx.tokens, t.name, defaultTheme) : undefined;
        return c && readable(t.role) && oklabDistance(current, c) * 100 < 2;
      })
    : undefined;
  const statusKind = selector ? statusKindOf(selector) : null;
  const role =
    (own ? ctx.tokens.byName.get(own)?.role : twin?.role) ??
    (statusKind ? `status.${statusKind === "neutral" ? "other" : statusKind}` : null);
  const passing = ctx.tokens.tokens
    // Colors meant to be read: text, accents, statuses. Surfaces and borders are never suggested as text.
    .filter((t) => t.type === "color" && readable(t.role) && t.name !== own)
    .map((t) => ({ t, res: textContrast(ctx, `var(${t.name})`, background, selector, r.minRatio) }))
    .filter((x) => x.res && x.res.failing.length === 0)
    .map((x) => {
      const c = tokenColor(ctx.tokens, x.t.name, defaultTheme);
      return { ...x, d: current && c ? oklabDistance(current, c) : Number.POSITIVE_INFINITY };
    })
    .sort((a, b) => a.d - b.d || (a.t.name < b.t.name ? -1 : 1));
  // Same role family first (text for text, accent for accent). Plain text falls back to text
  // tokens; a status or accent color never falls back to an unrelated family: that is a gap.
  const sameFamily = role && readable(role) ? passing.filter((x) => familyOf(x.t.role) === familyOf(role)) : [];
  const textOnly = passing.filter((x) => x.t.role.startsWith("text."));
  const textLike = !role || !readable(role) || familyOf(role) === "text" || (!!own && familyOf(role) === "accent");
  const candidates = sameFamily.length ? sameFamily : textLike ? textOnly : [];
  const why = describeContrast(r);
  if (candidates.length === 0) {
    return {
      match: "none",
      kind: "none",
      value: null,
      detail: `${why}. No ${role?.startsWith("status.") ? "status" : "text"} token reaches it on this background in every theme: it is a gap${role?.startsWith("status.") ? " (/facha-ui:init can propose status tokens)" : ""}.`,
      source: null,
    };
  }
  const best = candidates[0]!;
  const reached = Object.entries(best.res!.ratios).map(([th, v]) => `${v}:1 in ${th}`).join(", ");
  return {
    match: "nearest",
    kind: "token",
    value: `var(${best.t.name})`,
    detail: `${why}. ${best.t.name} reaches it in every theme (${reached}).`,
    source: best.t.source,
  };
}

/** Failing text contrast of the CSS rule behind a class name, when there is one. */
export function classContrast(ctx: Context, className: string) {
  return index(ctx).classFindings.get(className) ?? null;
}

const INTERACTIVE = /(^|[\s>+~,(])(input|select|textarea|button)\b|:focus|\.(btn|button|field|input|select|checkbox|radio|switch|toggle|tab)\b|\[role=/i;

/** Non-text parts that WCAG 1.4.11 covers: borders and outlines of interactive parts, focus rings, icons. */
export function isNonTextTarget(property: string, selector: string | null, context: string): boolean {
  const p = property.toLowerCase();
  if (context === "svg-attribute") return p === "fill" || p === "stroke";
  if (!selector || !INTERACTIVE.test(selector)) return false;
  if (/^(border|outline)(-[a-z]+)*$/.test(p)) return !/(radius|width|style|offset|collapse|spacing|image)/.test(p);
  return p === "box-shadow" && /:focus/.test(selector);
}

export function nonTextContrast(ctx: Context, value: string, background: string | null, selector: string | null) {
  const min = ctx.project.config.contrast?.nonTextMinRatio ?? 3;
  return textContrast(ctx, value, background, selector, min, { text: false });
}

/**
 * Status colors that are hard to tell apart (health, informative). Status tokens and status
 * component classes are compared kind against kind (success vs warning…), with normal vision and
 * simulated deuteranopia and protanopia. Two states differ by the largest distance among the parts
 * they share (text, background).
 */
export function statusConfusable(ctx: Context) {
  const threshold = ctx.project.config.contrast?.statusMinDeltaE ?? 10;
  const themes = ctx.tokens.themes.map((t) => t.name);
  type Item = { label: string; kind: string; source: string; parts: Record<"fg" | "bg", Record<string, Color>> };
  const items: Item[] = [];

  const byKind = new Map<string, Item>();
  for (const t of ctx.tokens.tokens) {
    if (t.type !== "color" || !t.role.startsWith("status.")) continue;
    const kind = t.role.slice("status.".length).replace("other", "neutral");
    const part = /(bg|background|soft|tint|surface|subtle)/.test(t.name) ? "bg" : "fg";
    const item = byKind.get(kind) ?? { label: `status ${kind} tokens`, kind, source: t.source, parts: { fg: {}, bg: {} } };
    for (const th of themes) {
      const c = tokenColor(ctx.tokens, t.name, th);
      if (c && !item.parts[part][th]) item.parts[part][th] = c;
    }
    byKind.set(kind, item);
  }
  items.push(...byKind.values());

  for (const cc of ctx.componentClasses) {
    if (themeScope(ctx, cc.selector).theme || cc.selector.includes(":")) continue;
    const kind = statusKindOf(cc.selector);
    if (!kind) continue;
    const item: Item = { label: cc.selector, kind, source: cc.source, parts: { fg: {}, bg: {} } };
    for (const d of cc.decls) {
      const part = d.prop === "color" ? "fg" : BACKGROUND_PROPS.has(d.prop) ? "bg" : null;
      if (!part) continue;
      for (const th of themes) {
        const c = colorOf(ctx, d.value, th);
        if (c) item.parts[part][th] = c;
      }
    }
    if (Object.keys(item.parts.fg).length || Object.keys(item.parts.bg).length) items.push(item);
  }

  const visions: [string, (c: Color) => Color][] = [
    ["normal", (c) => c],
    ["deuteranopia", (c) => deuteranopia(c) as Color],
    ["protanopia", (c) => protanopia(c) as Color],
  ];
  const worstByPair = new Map<string, any>();
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i]!;
      const b = items[j]!;
      if (a.kind === b.kind) continue;
      for (const th of themes) {
        const deltaE: Record<string, number> = {};
        let shared = false;
        for (const [name, sim] of visions) {
          let best = 0;
          for (const part of ["fg", "bg"] as const) {
            const ca = a.parts[part][th];
            const cb = b.parts[part][th];
            if (!ca || !cb) continue;
            shared = true;
            best = Math.max(best, oklabDistance(sim(ca), sim(cb)) * 100);
          }
          deltaE[name] = round(best, 1);
        }
        if (!shared) continue;
        const min = Math.min(...Object.values(deltaE));
        if (min >= threshold) continue;
        const key = [a.kind, b.kind].sort().join("|");
        const prev = worstByPair.get(key);
        if (prev) {
          if (!prev.themes.includes(th)) prev.themes.push(th);
          if (Math.min(...Object.values(prev.deltaE as Record<string, number>)) <= min) continue;
        }
        const [first, second] = a.kind < b.kind ? [a, b] : [b, a];
        worstByPair.set(key, {
          themes: prev?.themes ?? [th],
          kind: "status-confusable",
          token: `${first.label} ~ ${second.label}`,
          states: [first.kind, second.kind],
          items: [
            { label: first.label, source: first.source, colors: partsHex(first, th) },
            { label: second.label, source: second.source, colors: partsHex(second, th) },
          ],
          measuredIn: th,
          deltaE,
          minDeltaE: threshold,
          hardFor: Object.entries(deltaE).filter(([, v]) => v < threshold).map(([k]) => k),
          note: "These states are hard to tell apart by color alone for the listed vision types: keep a text label or an icon, or separate them more in lightness.",
        });
      }
    }
  }
  return [...worstByPair.values()]
    .map(({ themes: ths, ...rest }) => ({ ...rest, themes: [...ths].sort((p: string, q: string) => themes.indexOf(p) - themes.indexOf(q)) }))
    .sort((x, y) => (x.token < y.token ? -1 : x.token > y.token ? 1 : 0));
}

function partsHex(item: { parts: Record<"fg" | "bg", Record<string, Color>> }, theme: string) {
  const out: Record<string, string> = {};
  if (item.parts.fg[theme]) out.text = toHex(item.parts.fg[theme]!);
  if (item.parts.bg[theme]) out.background = toHex(item.parts.bg[theme]!);
  return out;
}
