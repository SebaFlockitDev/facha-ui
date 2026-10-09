import { deltaE, alphaOf, parseColor, round, toHex } from "./color.js";
import type { Context } from "./context.js";
import { toPx } from "./context.js";
import type { ArbitraryClass } from "./tailwind.js";
import { tokenColor, tokenValue } from "./tokens.js";
import type { Suggestion, Token } from "./types.js";

export const MAX_DELTA_E = 2.0;
const EXACT_DELTA_E = 0.5;
const FONT_SIZE_RANGE_PX = 1;

const NONE = (detail: string): Suggestion => ({ match: "none", kind: "none", value: null, detail, source: null });

/** Which color roles are valid for a CSS property (SPEC §2.a.3). */
export function roleCompatible(property: string | null, role: string): boolean {
  const p = (property ?? "").toLowerCase();
  if (!p || p.startsWith("--") || /shadow/.test(p)) return true;
  if (/^(background|background-color)$/.test(p)) return /^(surface|accent|status|generic)/.test(role);
  if (/^(border|outline|column-rule|divide)/.test(p)) return /^(border|status|generic)/.test(role) || role === "accent.primary";
  if (/^(color|fill|stroke|caret-color|text-decoration-color|-webkit-text-fill-color|--tw-shadow-color)$/.test(p) || p.endsWith("-color")) {
    return /^(text|accent|on-accent|status|generic)/.test(role);
  }
  return true;
}

function defaultTheme(ctx: Context): string {
  return ctx.tokens.themes[0]?.name ?? "light";
}

function otherThemesValues(ctx: Context, t: Token): string {
  const others = ctx.tokens.themes.slice(1).map((th) => {
    const c = tokenColor(ctx.tokens, t.name, th.name);
    return c ? `${th.name}: ${toHex(c)}` : null;
  });
  return others.filter(Boolean).join(", ");
}

export function suggestColor(ctx: Context, literal: string, property: string | null): Suggestion {
  const c = parseColor(literal);
  if (!c) return NONE("Not a parseable color.");
  const theme = defaultTheme(ctx);
  const candidates = ctx.tokens.tokens
    .filter((t) => t.type === "color")
    .map((t) => {
      const tc = tokenColor(ctx.tokens, t.name, theme);
      return { t, d: tc ? deltaE(c, tc) : Number.POSITIVE_INFINITY };
    })
    .filter((x) => Number.isFinite(x.d))
    .sort((a, b) => a.d - b.d || (a.t.name < b.t.name ? -1 : 1));

  const compatible = candidates.filter((x) => roleCompatible(property, x.t.role));
  const exact = compatible.filter((x) => x.d < EXACT_DELTA_E);
  if (exact.length > 0) {
    const best = exact[0]!.t;
    const others = otherThemesValues(ctx, best);
    return {
      match: "exact",
      kind: "token",
      value: `var(${best.name})`,
      detail: `Same value as ${best.name} in the ${theme} theme; the literal freezes it${others ? ` (${others})` : ""}.`,
      source: best.source,
    };
  }
  const near = compatible.filter((x) => x.d <= MAX_DELTA_E);
  if (near.length > 0) {
    const best = near[0]!;
    return {
      match: "nearest",
      kind: "token",
      value: `var(${best.t.name})`,
      detail: `Nearest token with a compatible role (${best.t.role}) at ΔE ${round(best.d)}.`,
      source: best.t.source,
    };
  }
  const parts: string[] = [];
  if (alphaOf(c) < 1) parts.push(`Translucent value (alpha ${round(alphaOf(c), 2)}): no token with the same opacity.`);
  const incompatibleExact = candidates.filter((x) => x.d < EXACT_DELTA_E && !roleCompatible(property, x.t.role));
  if (incompatibleExact.length > 0) {
    const names = incompatibleExact.map((x) => x.t.name);
    const roles = [...new Set(incompatibleExact.map((x) => x.t.role))].join("/");
    const others = incompatibleExact
      .map((x) => {
        const o = otherThemesValues(ctx, x.t);
        return o ? `${x.t.name} ${o}` : null;
      })
      .filter(Boolean);
    parts.push(
      `Matches ${names.join(", ")} by value, but ${roles} tokens are not valid for '${property}'${others.length ? ` (${others.join("; ")})` : ""}.`,
    );
    if (/color|fill|stroke/.test(property ?? "") && !ctx.tokens.tokens.some((t) => t.role === "on-accent")) {
      parts.push("No on-accent token exists.");
    }
  }
  const nearestCompat = compatible[0];
  if (nearestCompat && parts.length === 0) {
    parts.push(`No token within ΔE ${MAX_DELTA_E} with a compatible role (nearest: ${nearestCompat.t.name} at ΔE ${round(nearestCompat.d)}).`);
  } else if (parts.length === 0) {
    parts.push(`No token within ΔE ${MAX_DELTA_E} with a compatible role.`);
  }
  return NONE(parts.join(" "));
}

export function suggestFontSize(ctx: Context, value: string): Suggestion {
  const px = toPx(value);
  if (px == null) return NONE(`No font-size token or typography class for ${value}.`);
  const used = ctx.fontSizeUses.get(px);
  const usedNote = used && used.length > 0
    ? ` ${px}px is used in project CSS rules (${[...new Set(used)].slice(0, 4).join(", ")}) but no typography class or token exposes it.`
    : "";
  const sizeTokens = ctx.tokens.tokens.filter((t) => t.role === "font-size");
  const tokenExact = sizeTokens.find((t) => toPx(tokenValue(ctx.tokens, t.name, defaultTheme(ctx)) ?? "") === px);
  if (tokenExact) {
    return { match: "exact", kind: "token", value: `var(${tokenExact.name})`, detail: `Font-size token with the same value.`, source: tokenExact.source };
  }
  const classes = [...ctx.typographyClasses].sort(
    (a, b) => Math.abs(a.fontSizePx - px) - Math.abs(b.fontSizePx - px) || (a.className < b.className ? -1 : 1),
  );
  const best = classes[0];
  const noToken = sizeTokens.length === 0 ? " No font-size token exists." : "";
  if (best && best.fontSizePx === px) {
    return { match: "exact", kind: "class", value: best.className, detail: `Typography class .${best.className} sets ${px}px.${noToken}`, source: best.source };
  }
  if (best && Math.abs(best.fontSizePx - px) <= FONT_SIZE_RANGE_PX) {
    return {
      match: "nearest",
      kind: "class",
      value: best.className,
      detail: `${best.fontSizePx}px, nearest step of the type scale (Δ ${round(Math.abs(best.fontSizePx - px), 2)}px).${noToken}${usedNote}`,
      source: best.source,
    };
  }
  return NONE(
    `No font-size token or typography class for ${px}px.${best ? ` Nearest typography class .${best.className} (${best.fontSizePx}px) is out of range.` : ""}${usedNote}`,
  );
}

export function suggestArbitrary(ctx: Context, a: ArbitraryClass): Suggestion {
  switch (a.category) {
    case "typography":
      if (a.property === "font-size") return suggestFontSize(ctx, a.value);
      return NONE(`No token or class for ${a.property} ${a.value}.`);
    case "radius": {
      const px = toPx(a.value);
      const t = ctx.tokens.tokens.find((t) => t.role === "radius" && toPx(tokenValue(ctx.tokens, t.name, defaultTheme(ctx)) ?? "") === px);
      return t
        ? { match: "exact", kind: "token", value: `var(${t.name})`, detail: `Radius token with the same value.`, source: t.source }
        : NONE(`No radius token for ${a.value}.`);
    }
    case "shadow": {
      const t = ctx.tokens.tokens.find((t) => t.type === "shadow" && tokenValue(ctx.tokens, t.name, defaultTheme(ctx))?.replace(/\s+/g, "") === a.value.replace(/\s+/g, ""));
      return t
        ? { match: "exact", kind: "token", value: `var(${t.name})`, detail: `Shadow token with the same value.`, source: t.source }
        : NONE(`No shadow token for this value.`);
    }
    case "spacing": {
      const px = toPx(a.value);
      if (px == null || a.prefix == null) return NONE(`No spacing step for ${a.value}.`);
      const step = px / 4;
      const sign = px < 0 || a.prefix.startsWith("-") ? "-" : "";
      const prefix = a.prefix.replace(/^-/, "");
      if (Number.isInteger(step)) {
        return { match: "exact", kind: "class", value: `${sign}${prefix}-${Math.abs(step)}`, detail: `${px}px is step ${Math.abs(step)} of the 4px spacing scale.`, source: null };
      }
      const r = Math.round(step);
      return { match: "nearest", kind: "class", value: `${sign}${prefix}-${Math.abs(r)}`, detail: `Nearest step of the 4px spacing scale (${Math.abs(r) * 4}px).`, source: null };
    }
    default:
      return NONE("Layout/sizing value: no design token applies.");
  }
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0]![j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length]![b.length]!;
}

export function suggestTokenName(ctx: Context, name: string): Suggestion {
  const best = ctx.tokens.tokens
    .map((t) => ({ t, d: levenshtein(name, t.name) }))
    .sort((a, b) => a.d - b.d || (a.t.name < b.t.name ? -1 : 1))[0];
  if (best && best.d <= 2) {
    return { match: "nearest", kind: "token", value: `var(${best.t.name})`, detail: `Did you mean ${best.t.name}?`, source: best.t.source };
  }
  return NONE("No token with a similar name. Check get_design_system for the available tokens.");
}
