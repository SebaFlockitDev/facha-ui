import { colorsNamed, converter, differenceEuclidean, formatHex, formatHex8, parse, wcagContrast } from "culori";
import type { Color } from "culori";

const toRgb = converter("rgb");
const oklabDistance = differenceEuclidean("oklab");

/** Keywords that are never reported as color literals. */
export const NEUTRAL_KEYWORDS = new Set([
  "transparent",
  "currentcolor",
  "inherit",
  "initial",
  "unset",
  "revert",
  "none",
]);

const NAMED = new Set(Object.keys(colorsNamed).map((n) => n.toLowerCase()));

/** Properties whose values never contain colors (avoids "font-weight: bold"-style false positives). */
const NON_COLOR_PROPERTIES = /^(font|font-family|content|src|grid-template-areas|grid-area|animation(-name)?|transition(-property)?|will-change|counter-.*|list-style-type|quotes|font-feature-settings|text-transform|display|position|cursor|overflow.*|white-space|align.*|justify.*|flex.*|text-align|vertical-align)$/;

export interface ColorMatch {
  text: string;
  index: number;
}

const COLOR_RE =
  /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([^()]*\)|\b[a-zA-Z]+\b/g;

/** Finds color literals inside a CSS value. Ignores var() references and neutral keywords. */
export function findColorLiterals(value: string, property?: string | null): ColorMatch[] {
  const matches: ColorMatch[] = [];
  const checkNamed = !property || !NON_COLOR_PROPERTIES.test(property.toLowerCase());
  // Blank out var(...) references so token names are not read as color names.
  const masked = value.replace(/var\([^()]*\)/g, (m) => " ".repeat(m.length)).replace(/url\([^()]*\)/g, (m) => " ".repeat(m.length));
  for (const m of masked.matchAll(COLOR_RE)) {
    const text = m[0];
    const lower = text.toLowerCase();
    if (NEUTRAL_KEYWORDS.has(lower)) continue;
    if (/^[a-z]+$/i.test(text)) {
      if (!checkNamed || !NAMED.has(lower)) continue;
      // A named color glued to a hyphen is part of an identifier (e.g. "text-white-ish").
      const before = masked[m.index! - 1];
      const after = masked[m.index! + text.length];
      if (before === "-" || after === "-" || before === "." || before === "$") continue;
    }
    if (!parse(text)) continue;
    matches.push({ text, index: m.index! });
  }
  return matches;
}

export function parseColor(value: string): Color | undefined {
  const v = value.trim();
  if (!v || NEUTRAL_KEYWORDS.has(v.toLowerCase())) return undefined;
  return parse(v) ?? undefined;
}

export function isColorValue(value: string): boolean {
  return parseColor(value) !== undefined;
}

export function alphaOf(c: Color): number {
  return c.alpha ?? 1;
}

/** Perceptual distance (OKLab × 100). Translucent vs opaque colors never match. */
export function deltaE(a: Color, b: Color): number {
  if (Math.abs(alphaOf(a) - alphaOf(b)) > 0.02) return Number.POSITIVE_INFINITY;
  return oklabDistance(a, b) * 100;
}

/** Composites a (possibly translucent) color over an opaque background. */
export function compositeOver(fg: Color, bg: Color): Color {
  const f = toRgb(fg);
  const b = toRgb(bg);
  const a = f.alpha ?? 1;
  return {
    mode: "rgb",
    r: f.r * a + b.r * (1 - a),
    g: f.g * a + b.g * (1 - a),
    b: f.b * a + b.b * (1 - a),
  };
}

/** WCAG contrast ratio, rounded to 2 decimals. Translucent colors are composited first. */
export function contrast(fg: Color, bg: Color, base?: Color): number {
  const solidBg = alphaOf(bg) < 1 && base ? compositeOver(bg, base) : bg;
  const solidFg = alphaOf(fg) < 1 ? compositeOver(fg, solidBg) : fg;
  return Math.round(wcagContrast(solidFg, solidBg) * 100) / 100;
}

export function toHex(c: Color): string {
  return alphaOf(c) < 1 ? formatHex8(c) : formatHex(c);
}

export function round(n: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
