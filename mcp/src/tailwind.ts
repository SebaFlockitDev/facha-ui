import { isColorValue } from "./color.js";

export type ArbitraryCategory = "typography" | "color" | "radius" | "shadow" | "spacing" | "sizing" | "layout";

export interface ArbitraryClass {
  /** The full class as written, with variants. */
  raw: string;
  /** Utility prefix, e.g. "text", "max-w". Null for arbitrary properties. */
  prefix: string | null;
  /** Arbitrary value with underscores turned into spaces. */
  value: string;
  property: string;
  category: ArbitraryCategory;
}

/** Strips variants ("md:hover:") and the important modifier. */
export function baseUtility(raw: string): string {
  let depth = 0;
  let last = 0;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === "[") depth++;
    else if (ch === "]") depth--;
    else if (ch === ":" && depth === 0) last = i + 1;
  }
  return raw.slice(last).replace(/^!/, "").replace(/!$/, "");
}

const SPACING = /^-?(p|px|py|pt|pr|pb|pl|ps|pe|m|mx|my|mt|mr|mb|ml|ms|me|gap|gap-x|gap-y|space-x|space-y|inset|inset-x|inset-y|top|right|bottom|left|start|end|scroll-m|scroll-p|indent)$/;
const SIZING = /^(w|h|min-w|min-h|max-w|max-h|size|basis)$/;
const RADIUS = /^rounded(-(t|r|b|l|tl|tr|br|bl|s|e|ss|se|es|ee))?$/;
const COLOR_ONLY = /^(bg|from|via|to|ring|ring-offset|outline|fill|stroke|decoration|accent|caret|placeholder|divide|border|border-[xytrblse])$/;

function isLength(v: string): boolean {
  return /^-?[\d.]+(px|rem|em|%|vh|vw|vmin|vmax|ch|ex|lh|dvh|svh)?$/.test(v) || /^(calc|clamp|min|max)\(/.test(v);
}

/** Parses an arbitrary-value or arbitrary-property class. Returns null for regular utilities. */
export function parseArbitrary(raw: string): ArbitraryClass | null {
  const util = baseUtility(raw);
  const prop = util.match(/^\[([a-z-]+):(.+)\]$/);
  if (prop) {
    const property = prop[1]!;
    const value = prop[2]!.replace(/_/g, " ");
    return { raw, prefix: null, value, property, category: categoryForProperty(property, value) };
  }
  const m = util.match(/^(-?[a-z][a-z0-9-]*?)-\[(.+)\](\/[\w.[\]%-]+)?$/);
  if (!m) return null;
  const prefix = m[1]!;
  let value = m[2]!.replace(/_/g, " ");
  let hint: string | null = null;
  const typed = value.match(/^(length|color|percentage|number|url|image|family-name|absolute-size|relative-size):(.+)$/);
  if (typed) {
    hint = typed[1]!;
    value = typed[2]!;
  }
  const color = hint === "color" || (!hint && (isColorValue(value) || /^var\(--/.test(value) && COLOR_ONLY.test(prefix)));
  const p = prefix.replace(/^-/, "");

  if (p === "text") {
    if (color) return { raw, prefix, value, property: "color", category: "color" };
    return { raw, prefix, value, property: "font-size", category: "typography" };
  }
  if (p === "font") return { raw, prefix, value, property: /^\d+$/.test(value) ? "font-weight" : "font-family", category: "typography" };
  if (p === "leading") return { raw, prefix, value, property: "line-height", category: "typography" };
  if (p === "tracking") return { raw, prefix, value, property: "letter-spacing", category: "typography" };
  if (RADIUS.test(p)) return { raw, prefix, value, property: "border-radius", category: "radius" };
  if (p === "shadow" || p === "drop-shadow") {
    return color
      ? { raw, prefix, value, property: "--tw-shadow-color", category: "color" }
      : { raw, prefix, value, property: "box-shadow", category: "shadow" };
  }
  if (COLOR_ONLY.test(p)) {
    if (color) {
      const property = p === "bg" ? "background-color" : p.startsWith("border") || p === "divide" ? "border-color" : p === "fill" ? "fill" : p === "stroke" ? "stroke" : `${p}-color`;
      return { raw, prefix, value, property, category: "color" };
    }
    if (p === "bg") return { raw, prefix, value, property: "background", category: "layout" };
    if (isLength(value)) return { raw, prefix, value, property: p.startsWith("border") ? "border-width" : `${p}-width`, category: "sizing" };
    return { raw, prefix, value, property: p, category: "layout" };
  }
  if (SPACING.test(p)) return { raw, prefix, value, property: spacingProperty(p), category: "spacing" };
  if (SIZING.test(p)) return { raw, prefix, value, property: sizingProperty(p), category: "sizing" };
  return { raw, prefix, value, property: p, category: "layout" };
}

function categoryForProperty(property: string, value: string): ArbitraryCategory {
  if (/color|^background$|^fill$|^stroke$/.test(property) && isColorValue(value)) return "color";
  if (/^(font|line-height|letter-spacing|text-transform)/.test(property)) return "typography";
  if (/radius/.test(property)) return "radius";
  if (/shadow/.test(property)) return "shadow";
  if (/^(margin|padding|gap|inset|top|right|bottom|left)/.test(property)) return "spacing";
  if (/^(width|height|min-|max-)/.test(property)) return "sizing";
  return "layout";
}

function spacingProperty(p: string): string {
  const map: Record<string, string> = {
    p: "padding", px: "padding-inline", py: "padding-block", pt: "padding-top", pr: "padding-right",
    pb: "padding-bottom", pl: "padding-left", m: "margin", mx: "margin-inline", my: "margin-block",
    mt: "margin-top", mr: "margin-right", mb: "margin-bottom", ml: "margin-left", gap: "gap",
  };
  return map[p] ?? p;
}

function sizingProperty(p: string): string {
  const map: Record<string, string> = {
    w: "width", h: "height", "min-w": "min-width", "min-h": "min-height", "max-w": "max-width",
    "max-h": "max-height", size: "width/height", basis: "flex-basis",
  };
  return map[p] ?? p;
}
