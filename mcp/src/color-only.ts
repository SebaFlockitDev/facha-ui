import type { Context } from "./context.js";
import type { ElementUsage, Usage } from "./sources/usage.js";
import type { Loc, RuleId, Severity } from "./types.js";
import { statusKindOf } from "./visual.js";

/**
 * a11y-color-only (B-004, WCAG 1.4.1 Use of Color, ux:wcag-1.4.1): a state told by color alone. An
 * element that is not interactive carries a state through its color (a class named for a state, a
 * color utility with a status token, or a className that interpolates a state variable), and nothing
 * else says it: no text of its own or next to it, no accessible name, no icon inside. aria-hidden
 * elements are left alone: the author says they are decorative, next to the text that names the state.
 */

const NON_INTERACTIVE = new Set(["span", "div", "i", "b", "small", "td", "li", "mark", "em", "strong"]);
const COLOR_UTILITY = /^(?:[\w-]+:)*(?:bg|text|border|ring|fill|stroke|outline|decoration)-(.+?)(?:\/\d+)?$/;
const STATE_VAR = /(^|[a-z])(status|state|severity)$|^(health|result)$/i;

type Report = (rule: RuleId, base: Severity, loc: Loc, found: string, message: string, fix: string) => void;

/** The state an element shows by color, and how it was read, or null. */
function stateOf(ctx: Context, e: ElementUsage): string | null {
  for (const c of e.classes) {
    if (statusKindOf(`.${c}`)) return `the class ${c}`;
    const color = c.match(COLOR_UTILITY)?.[1]?.replace(/^\[var\((--[\w-]+)\)\]$/, "$1");
    if (!color) continue;
    for (const name of color.startsWith("--") ? [color] : [`--color-${color}`, `--${color}`]) {
      const t = ctx.tokens.byName.get(name);
      if (t?.type === "color" && t.role.startsWith("status.")) return `the status color ${c}`;
    }
  }
  const v = (e.classVars ?? []).find((n) => STATE_VAR.test(n));
  return v ? `a className that depends on ${v}` : null;
}

export function checkColorOnly(ctx: Context, usages: Usage[], report: Report) {
  for (const u of usages) {
    if (u.kind !== "element" || !NON_INTERACTIVE.has(u.tag)) continue;
    if (u.name !== "none" || u.siblingText || u.graphic) continue;
    if (u.attrs["aria-hidden"] === "true") continue;
    if (["aria-label", "aria-labelledby", "title"].some((a) => u.attrs[a] !== undefined || u.dynamic.includes(a))) continue;
    if (u.spread) continue;
    const state = stateOf(ctx, u);
    if (!state) continue;
    report(
      "a11y-color-only",
      "warning",
      u,
      `<${u.tag} className="${u.classes.join(" ")}">`,
      `A state shown only by color (${state}): nothing else says it (WCAG 1.4.1).`,
      "Say the state besides the color: visible text, or text for screen readers (sr-only), or an icon with a name, next to it.",
    );
  }
}
