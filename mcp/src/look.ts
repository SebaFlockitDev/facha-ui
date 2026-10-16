import { converter } from "culori";
import type { Color } from "culori";
import { contrast, findColorLiterals, parseColor, round, toHex } from "./color.js";
import type { Context } from "./context.js";
import { parsePaletteClass } from "./project-rules.js";
import type { DeclUsage, ElementUsage, Usage } from "./sources/usage.js";
import { baseUtility, parseArbitrary } from "./tailwind.js";
import { tokenColor } from "./tokens.js";
import type { Loc, RuleId, Severity } from "./types.js";
import { colorOf, minRatioOf } from "./visual.js";

/**
 * The parts of the "generic AI look" that break a published rule (B-029, SPEC §2.a.4). The rest of
 * that look is taste and stays out of the guardian (docs/specs/B-029-…):
 * - ux-gray-on-color: a mid gray text on a colored background. Radix designs its text steps for
 *   backgrounds of the same scale, and white or dark text for its solids.
 * - a11y-gradient-text: text on a gradient, measured against every stop (WCAG 1.4.3, G18, F83).
 * - a11y-motion: animations with no reduced-motion alternative (WCAG 2.3.3, C39; Tailwind's
 *   motion-safe / motion-reduce variants).
 */

export type LookReport = (rule: RuleId, base: Severity, loc: Loc, found: string, message: string, fix: string, context: "css" | "jsx-element") => void;

const toOklch = converter("oklch");
const chroma = (c: Color) => toOklch(c)?.c ?? 0;
const lightness = (c: Color) => toOklch(c)?.l ?? 0;
/** A gray of middle lightness: not near black or white, with almost no chroma. */
const isMidGray = (c: Color) => (c.alpha ?? 1) >= 1 && chroma(c) < 0.03 && lightness(c) >= 0.3 && lightness(c) <= 0.85;
/** A background with real color: a solid or a saturated tint, not a barely tinted surface. */
const isColored = (c: Color) => (c.alpha ?? 1) >= 1 && chroma(c) >= 0.06;
const GRADIENT = /(?:linear|radial|conic)-gradient\(/;

const themesOf = (ctx: Context) => (ctx.tokens.themes.length ? ctx.tokens.themes.map((t) => t.name) : ["default"]);
const loc = (u: { file: string; line: number; column: number }): Loc => ({ file: u.file, line: u.line, column: u.column });

const GRAY_FIX =
  "Use a text color of the background's own family (its strong or text step, e.g. --color-primary-strong or --color-<state>-text) or, on a solid fill, its on-color (--color-on-primary).";

/** Colors of a gradient's stops in a theme: literals and var(--token). */
function gradientStops(ctx: Context, value: string, theme: string): { text: string; color: Color }[] {
  const out: { text: string; color: Color }[] = [];
  for (const m of value.matchAll(/var\(\s*(--[\w-]+)[^)]*\)/g)) {
    const c = tokenColor(ctx.tokens, m[1]!, theme);
    if (c) out.push({ text: m[0], color: c });
  }
  for (const lit of findColorLiterals(value)) {
    const c = parseColor(lit.text);
    if (c) out.push({ text: lit.text, color: c });
  }
  return out;
}

/** The worst contrast of a text color against a gradient's stops, per theme. */
function gradientFailure(ctx: Context, fg: (theme: string) => Color | undefined, stops: (theme: string) => { text: string; color: Color }[]) {
  const min = minRatioOf(ctx);
  for (const th of themesOf(ctx)) {
    const f = fg(th);
    const s = stops(th);
    if (!f || s.length < 2) continue;
    const worst = s.map((x) => ({ ...x, ratio: contrast(f, x.color) })).sort((a, b) => a.ratio - b.ratio)[0]!;
    if (worst.ratio < min) return { theme: th, stop: worst.text, ratio: round(worst.ratio, 2), min, fg: toHex(f) };
  }
  return null;
}

/** Whether any CSS of the project offers a reduced-motion alternative. */
function hasReducedMotion(ctx: Context): boolean {
  for (const root of ctx.cssRoots.values()) {
    let found = false;
    root.walkAtRules("media", (a) => {
      if (/prefers-reduced-motion/.test(a.params)) found = true;
    });
    if (found) return true;
  }
  return false;
}

function cssDecl(ctx: Context, u: DeclUsage, report: LookReport, reducedMotion: () => boolean) {
  if (u.context !== "css") return;
  const value = u.value.trim();

  if (u.property === "color") {
    const bg = u.siblingBackground ?? null;
    const image = u.siblingBackgroundImage ?? null;
    const gradient = [bg, image].find((b) => b && GRADIENT.test(b));
    if (gradient) {
      const fail = gradientFailure(ctx, (th) => colorOf(ctx, value, th), (th) => gradientStops(ctx, gradient, th));
      if (fail)
        report("a11y-gradient-text", "warning", loc(u), `${u.selector ?? ""} { color: ${value} }`,
          `Text on a gradient: ${fail.ratio}:1 against the stop ${fail.stop} in ${fail.theme} (needs ${fail.min}:1). The text has to reach the minimum on every part of the background behind it (WCAG 1.4.3, technique G18).`,
          "Pick a text color that passes on every stop, darken or lighten the stops it does not pass on, or put the text on a solid area of the background.", "css");
      return;
    }
    if (!bg) return;
    for (const th of themesOf(ctx)) {
      const fg = colorOf(ctx, value, th);
      const back = colorOf(ctx, bg, th);
      if (fg && back && isMidGray(fg) && isColored(back)) {
        report("ux-gray-on-color", "warning", loc(u), `${u.selector ?? ""} { color: ${value}; background: ${bg.trim()} }`,
          `A gray text (${toHex(fg)}) on a colored background (${toHex(back)}) in ${th}: neither the background's own text color nor white or dark text on a solid, which is what Radix designs its scales for.`,
          GRAY_FIX, "css");
        return;
      }
    }
  }

  if ((u.property === "animation" || u.property === "animation-name") && !/^(none|initial|inherit|unset)$/i.test(value)) {
    if (u.selector && /prefers-reduced-motion/.test(u.selector)) return;
    if (reducedMotion()) return;
    report("a11y-motion", "warning", loc(u), `${u.selector ?? ""} { ${u.property}: ${value} }`,
      "An animation, and no CSS of the project has a @media (prefers-reduced-motion: reduce) alternative: people who get dizzy or distracted by motion cannot turn it off (WCAG 2.3.3).",
      "Add @media (prefers-reduced-motion: reduce) { <selector> { animation: none; } } (technique C39), or keep it only if the motion itself is essential.", "css");
  }
}

/** The color a Tailwind utility of one kind (text-*, bg-*, from-*, via-*, to-*) sets, in a theme. */
function utilityColor(ctx: Context, cls: string, prefix: string, theme: string): { text: string; color: Color } | undefined {
  const utility = baseUtility(cls);
  if (!utility.startsWith(`${prefix}-`)) return undefined;
  const arbitrary = parseArbitrary(cls);
  if (arbitrary && arbitrary.prefix === prefix) {
    if (arbitrary.category !== "color") return undefined;
    const c = colorOf(ctx, arbitrary.value, theme);
    return c ? { text: utility, color: c } : undefined;
  }
  if (prefix === "text" || prefix === "bg") {
    const p = parsePaletteClass(cls);
    if (p && !p.opacity && p.property === (prefix === "text" ? "color" : "background-color")) {
      const c = parseColor(p.value);
      if (c) return { text: utility, color: c };
    }
  } else {
    const key = utility.slice(prefix.length + 1);
    const p = parsePaletteClass(`bg-${key}`);
    if (p && !p.opacity) {
      const c = parseColor(p.value);
      if (c) return { text: utility, color: c };
    }
  }
  const name = utility.slice(prefix.length + 1);
  const c = tokenColor(ctx.tokens, `--color-${name}`, theme);
  return c ? { text: utility, color: c } : undefined;
}

function element(ctx: Context, e: ElementUsage, report: LookReport) {
  // Only the classes that always apply: hover:, dark:, md:… are other states.
  const own = e.classes.filter((c) => !c.includes(":"));
  const first = (prefix: string, th: string) => own.map((c) => utilityColor(ctx, c, prefix, th)).find(Boolean);

  const gradient = own.some((c) => /^bg-(gradient-to|linear|radial|conic)-/.test(baseUtility(c)));
  if (gradient) {
    const fail = gradientFailure(
      ctx,
      (th) => first("text", th)?.color,
      (th) => ["from", "via", "to"].map((p) => first(p, th)).filter((x): x is { text: string; color: Color } => !!x),
    );
    if (fail)
      report("a11y-gradient-text", "warning", loc(e), `<${e.tag}> ${own.join(" ")}`.slice(0, 200),
        `Text on a gradient: ${fail.ratio}:1 against ${fail.stop} in ${fail.theme} (needs ${fail.min}:1). The text has to reach the minimum on every part of the background behind it (WCAG 1.4.3, technique G18).`,
        "Pick a text color that passes on every stop, change the stops it does not pass on, or put the text on a solid area.", "jsx-element");
  } else {
    for (const th of themesOf(ctx)) {
      const fg = first("text", th);
      const bg = first("bg", th);
      if (fg && bg && isMidGray(fg.color) && isColored(bg.color)) {
        report("ux-gray-on-color", "warning", loc(e), `${fg.text} on ${bg.text}`,
          `A gray text (${toHex(fg.color)}) on a colored background (${toHex(bg.color)}) in ${th}: neither the background's own text color nor white or dark text on a solid, which is what Radix designs its scales for.`,
          GRAY_FIX, "jsx-element");
        break;
      }
    }
  }

  const animated = e.classes.find((c) => /^animate-(?!none$)/.test(c));
  if (animated && !e.classes.some((c) => c.startsWith("motion-reduce:"))) {
    report("a11y-motion", "warning", loc(e), animated,
      `${animated} runs for everyone: people who get dizzy or distracted by motion cannot turn it off (WCAG 2.3.3).`,
      `Use motion-safe:${animated} so it only runs when the person has not asked for less motion, or add motion-reduce:animate-none; keep it only if the motion is essential.`, "jsx-element");
  }
}

export function checkLook(ctx: Context, usages: Usage[], report: LookReport): void {
  let cached: boolean | undefined;
  const reducedMotion = () => (cached ??= hasReducedMotion(ctx));
  for (const u of usages) {
    if (u.kind === "decl") cssDecl(ctx, u, report, reducedMotion);
    else if (u.kind === "element") element(ctx, u, report);
  }
}
