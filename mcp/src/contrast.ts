import { contrast, shownRatio } from "./color.js";
import type { Context } from "./context.js";
import type { Usage } from "./sources/usage.js";
import { aliasOf, tokenColor } from "./tokens.js";
import { isNonTextTarget } from "./visual.js";

/**
 * The contrast matrix of the design system (B-032): every text on every background where it can
 * appear, in every theme, with WCAG 2.2's levels. Pass or fail is decided on the unrounded ratio
 * (Understanding 1.4.3); the ratio shown is truncated.
 *
 * Pairs, each with its source:
 * - text: every text.* token on every surface (WCAG 1.4.3);
 * - paired: a foreground named for its background: X-foreground, X-fg or on-X on X (shadcn/ui,
 *   Material), X-text on X-bg or X-subtle (Radix step 11 on steps 1-5, the generator's names);
 * - status: each state's text on the surfaces (the plain token when the state has no text variant);
 * - used: a color and a background declared in the same rule of the project;
 * - non-text: control borders and the focus ring on the surfaces (WCAG 1.4.11, 3:1).
 */

export type PairKind = "paired" | "status" | "text" | "used" | "non-text";
export type Level = "AAA" | "AA" | "large-only" | "fail" | "pass";

export interface ContrastPair {
  fg: string;
  bg: string;
  kind: PairKind;
  ratio: Record<string, number>;
  level: Record<string, Level>;
  /** Reaches the minimum in every theme. */
  passes: boolean;
  /** Fails the minimum but reaches the large-text one in every theme: headings of 24px, or 18.66px bold. */
  largeOnly: boolean;
  /** Rules of the project that declare this color on this background. */
  used?: { count: number; where: string[] };
}

const KIND_ORDER: PairKind[] = ["paired", "status", "text", "used", "non-text"];
const TEXT_VARIANT = /(^|-)(text|fg|foreground)$/;
const NOT_PLAIN = /(^|-)(bg|background|subtle|soft|surface|muted|border|outline|ring|stroke|hover|active|pressed|strong|weak|text|fg|foreground|solid|emphasis)(-|$)/;
const CONTROL_BORDER = /(^|-)(strong|input|control|field)(-|$)/;
const FOCUS_RING = /(^|-)(ring|focus)(-|$)/;

/** Backgrounds a token is named for: X-foreground → X, on-X → X, X-text → X-bg, X-subtle… */
export function namedBackgrounds(name: string): string[] {
  const out: string[] = [];
  // Something must come before the suffix: --text and --foreground are plain text, not pairs.
  const fg = name.match(/^(--.+)-(foreground|fg)$/);
  if (fg) out.push(fg[1]!);
  if (/^--(.+-)?on-.+/.test(name)) out.push(name.replace("-on-", "-"));
  const text = name.match(/^(--.+)-text$/);
  if (text) for (const s of ["bg", "background", "subtle", "soft", "surface"]) out.push(`${text[1]}-${s}`);
  return out;
}

export function contrastMatrix(ctx: Context, usages: Usage[]) {
  const cfg = ctx.project.config.contrast;
  const min = cfg?.minRatio ?? 4.5;
  const large = min >= 7 ? 4.5 : 3;
  const nonText = cfg?.nonTextMinRatio ?? 3;
  const themes = ctx.tokens.themes.map((t) => t.name);
  // A pure alias (Tailwind 4's --color-x: var(--x)) is the same color: measured once, as its target.
  const canon = (name: string) => {
    let n = name;
    for (let i = 0; i < 5; i++) n = aliasOf(ctx.tokens, n) ?? n;
    return n;
  };
  const allColors = ctx.tokens.tokens.filter((t) => t.type === "color");
  const colors = allColors.filter((t) => canon(t.name) === t.name);
  const isColor = new Set(colors.map((t) => t.name));
  const surfaces = [
    ...new Set(cfg?.surfaces?.length ? cfg.surfaces.map(canon).filter((s) => isColor.has(s)) : colors.filter((t) => t.role.startsWith("surface.")).map((t) => t.name)),
  ];

  const wanted = new Map<string, { fg: string; bg: string; kind: PairKind }>();
  const want = (fg: string, bg: string, kind: PairKind) => {
    if (fg === bg || !isColor.has(fg) || !isColor.has(bg)) return;
    const key = `${fg}|${bg}`;
    const prev = wanted.get(key);
    if (!prev || KIND_ORDER.indexOf(kind) < KIND_ORDER.indexOf(prev.kind)) wanted.set(key, { fg, bg, kind });
  };

  for (const t of allColors) for (const bg of namedBackgrounds(t.name)) if (ctx.tokens.byName.has(bg)) want(canon(t.name), canon(bg), "paired");
  // A state's text: its text variant, or the plain token when the state has none.
  const states = new Map<string, string[]>();
  for (const t of colors) if (t.role.startsWith("status.")) states.set(t.role, [...(states.get(t.role) ?? []), t.name]);
  for (const names of states.values()) {
    const bare = (n: string) => n.replace(/^--/, "").replace(/^color-/, "");
    const texts = names.filter((n) => TEXT_VARIANT.test(bare(n)));
    const readers = texts.length ? texts : names.filter((n) => !NOT_PLAIN.test(bare(n)));
    for (const fg of readers) for (const s of surfaces) want(fg, s, "status");
  }
  for (const t of colors) if (t.role.startsWith("text.")) for (const s of surfaces) want(t.name, s, "text");

  // Pairs the project declares together, with where.
  const used = new Map<string, { count: number; where: string[] }>();
  const nonTextUsed = new Set<string>();
  const tokenIn = (v: string | null | undefined) => {
    const name = v?.trim().match(/^var\(\s*(--[\w-]+)\s*\)$/)?.[1];
    return name ? canon(name) : undefined;
  };
  for (const u of usages) {
    if (u.kind !== "decl") continue;
    const fg = tokenIn(u.value);
    if (!fg) continue;
    if (u.property === "color") {
      const bg = tokenIn(u.siblingBackground);
      if (!bg) continue;
      want(fg, bg, "used");
      const rec = used.get(`${fg}|${bg}`) ?? { count: 0, where: [] };
      rec.count++;
      if (rec.where.length < 3) rec.where.push(`${u.file}:${u.line}`);
      used.set(`${fg}|${bg}`, rec);
    } else if (isNonTextTarget(u.property, u.selector, u.context)) nonTextUsed.add(fg);
  }
  for (const t of colors) {
    const bare = t.name.replace(/^--/, "");
    const control = (t.role.startsWith("border.") && CONTROL_BORDER.test(bare)) || FOCUS_RING.test(bare) || nonTextUsed.has(t.name);
    if (control && !t.role.startsWith("text.") && !t.role.startsWith("surface.")) for (const s of surfaces) want(t.name, s, "non-text");
  }

  const pairs: ContrastPair[] = [];
  for (const { fg, bg, kind } of wanted.values()) {
    const ratio: Record<string, number> = {};
    const level: Record<string, Level> = {};
    let passes = true;
    let largeOk = true;
    for (const th of themes) {
      const f = tokenColor(ctx.tokens, fg, th);
      const b = tokenColor(ctx.tokens, bg, th);
      if (!f || !b) continue;
      const base = surfaces[0] ? tokenColor(ctx.tokens, surfaces[0], th) : undefined;
      const r = contrast(f, b, base);
      ratio[th] = shownRatio(r);
      if (kind === "non-text") {
        level[th] = r >= nonText ? "pass" : "fail";
        if (r < nonText) passes = largeOk = false;
      } else {
        level[th] = r >= 7 ? "AAA" : r >= 4.5 ? "AA" : r >= 3 ? "large-only" : "fail";
        if (r < min) passes = false;
        if (r < large) largeOk = false;
      }
    }
    if (!Object.keys(ratio).length) continue;
    const pair: ContrastPair = { fg, bg, kind, ratio, level, passes, largeOnly: !passes && largeOk && kind !== "non-text" };
    const u = used.get(`${fg}|${bg}`);
    if (u) pair.used = u;
    pairs.push(pair);
  }
  const rank = (p: ContrastPair) => (p.passes ? 2 : p.largeOnly ? 1 : 0);
  pairs.sort((a, b) => rank(a) - rank(b) || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || (a.fg < b.fg ? -1 : a.fg > b.fg ? 1 : a.bg < b.bg ? -1 : 1));

  // For whoever writes UI: on each background, which text can go there.
  const bySurface: Record<string, { pass: string[]; largeOnly: string[]; fail: string[] }> = {};
  for (const p of pairs) {
    if (p.kind === "non-text") continue;
    const row = (bySurface[p.bg] ??= { pass: [], largeOnly: [], fail: [] });
    (p.passes ? row.pass : p.largeOnly ? row.largeOnly : row.fail).push(p.fg);
  }
  for (const row of Object.values(bySurface)) for (const list of [row.pass, row.largeOnly, row.fail]) list.sort();

  const byKind: Record<string, { pairs: number; failing: number }> = {};
  for (const p of pairs) {
    const k = (byKind[p.kind] ??= { pairs: 0, failing: 0 });
    k.pairs++;
    if (!p.passes) k.failing++;
  }
  return {
    standard: "WCAG 2.2",
    minimums: { text: min, largeText: large, enhanced: 7, nonText },
    largeText: "24px or more, or 18.66px (14pt) bold (WCAG 2.2, large-scale text)",
    themes,
    summary: {
      pairs: pairs.length,
      passing: pairs.filter((p) => p.passes).length,
      largeOnly: pairs.filter((p) => p.largeOnly).length,
      failing: pairs.filter((p) => !p.passes && !p.largeOnly).length,
      byKind,
    },
    bySurface,
    pairs,
  };
}
