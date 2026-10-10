import type { A11yReport } from "./a11y.js";
import type { DeclUsage, ElementUsage, Usage } from "./sources/usage.js";
import type { RuleId, Severity } from "./types.js";

/**
 * Responsive rules: what a static read can tell about a layout that breaks on a phone. A fixed
 * width wider than a phone, a grid of 3+ columns that never collapses, a table with no scroll
 * container, and 100vh heights. The rendered page is measured in the lab (?check=responsive).
 */

/** Usable width of a 375px phone with 16px gutters: anything wider overflows. */
export const PHONE_WIDTH = 343;

const BREAKPOINT = /^(sm|md|lg|xl|2xl|min-\[[^\]]+\]|@\w+):/;
const SCROLLS = /^(overflow-x-auto|overflow-x-scroll|overflow-auto|overflow-scroll)$/;

const base = (cls: string) => cls.slice(cls.lastIndexOf(":") + 1).replace(/^!/, "");
const unprefixed = (cls: string) => !BREAKPOINT.test(cls);

function lengthPx(value: string): number | null {
  const m = value.trim().match(/^(\d+(?:\.\d+)?)(px|rem)$/);
  if (!m) return null;
  return m[2] === "rem" ? Number(m[1]) * 16 : Number(m[1]);
}

/** px of a fixed width utility (w-96, w-[800px], min-w-[40rem]); null otherwise. */
function fixedWidthPx(cls: string): number | null {
  const m = base(cls).match(/^(?:min-)?w-(?:(\d+(?:\.\d+)?)|\[([^\]]+)\])$/);
  if (!m) return null;
  if (m[1]) return Number(m[1]) * 4;
  return lengthPx(m[2]!);
}

export function checkResponsive(usages: Usage[], overflowClasses: Set<string>, report: A11yReport): void {
  for (const e of usages.filter((u): u is ElementUsage => u.kind === "element")) {
    const where = { file: e.file, line: e.line, column: e.column };
    const own = e.classes.filter(unprefixed);

    const capped = own.some((c) => /^max-w-(full|screen|\[100%\]|\[100vw\])$/.test(base(c)));
    for (const c of own) {
      const px = fixedWidthPx(c);
      if (px != null && px > PHONE_WIDTH && !capped) {
        report("responsive-fixed-width", "warning", where, c,
          `Fixed width of ${Math.round(px)}px: wider than a phone (${PHONE_WIDTH}px usable at 375px), so the page scrolls sideways.`,
          `Use w-full with a max-w-… cap, or set the fixed width only from a breakpoint up (md:${base(c)}).`);
        break;
      }
    }

    const cols = own.map((c) => base(c).match(/^grid-cols-(\d+)$/)).find(Boolean);
    if (cols && Number(cols[1]) >= 3 && !e.classes.some((c) => BREAKPOINT.test(c) && /grid-cols-/.test(c))) {
      report("responsive-grid-columns", "warning", where, cols[0],
        `${cols[1]} columns at every width: on a phone each one gets about ${Math.round(PHONE_WIDTH / Number(cols[1]))}px.`,
        `Start with 1 column and add them from breakpoints up (grid-cols-1 md:grid-cols-${cols[1]}), or use auto-fit with a minimum.`);
    }

    if (e.tag === "table") {
      const containers = [...e.ancestorClasses, ...e.classes].map(base);
      const scrolls = containers.some((c) => SCROLLS.test(c) || overflowClasses.has(c));
      if (!scrolls) {
        report("responsive-table-scroll", "info", where, "<table>",
          "Table with no horizontal scroll container in this file: on a phone it overflows the page or gets clipped.",
          "Wrap it in an element with overflow-x: auto (overflow-x-auto), or show the rows as cards below a breakpoint. If the wrapper is in another file, ignore this.");
      }
    }

    if (own.some((c) => base(c) === "h-screen")) {
      report("responsive-viewport-height", "info", where, "h-screen",
        "100vh on a phone includes the area under the browser's address bar: the bottom gets hidden.",
        "Use h-dvh (or min-h-dvh), which follows the visible height.");
    }
  }
}

export interface ResponsiveDeclFinding {
  rule: RuleId;
  base: Severity;
  message: string;
  fix: string;
}

/** CSS and inline-style declarations that break on a phone. */
export function responsiveDecl(u: DeclUsage): ResponsiveDeclFinding | null {
  if (u.context === "svg-attribute") return null;
  if (u.selector && /@media|@container/.test(u.selector)) return null;
  const value = u.value.trim();
  if (u.property === "width" || u.property === "min-width") {
    const px = lengthPx(value);
    if (px != null && px > PHONE_WIDTH) {
      return {
        rule: "responsive-fixed-width",
        base: "warning",
        message: `${u.property}: ${value} is wider than a phone (${PHONE_WIDTH}px usable at 375px), so the page scrolls sideways.`,
        fix: `Use max-width: ${value} with width: 100%, or move the fixed width into a min-width media query.`,
      };
    }
  }
  if (u.property === "grid-template-columns" && !/auto-(fit|fill)/.test(value)) {
    const rep = value.match(/^repeat\(\s*(\d+)\s*,/);
    const tracks = rep ? Number(rep[1]) : value.split(/\s+(?![^(]*\))/).filter(Boolean).length;
    if (tracks >= 3) {
      return {
        rule: "responsive-grid-columns",
        base: "warning",
        message: `${tracks} grid columns at every width: on a phone each one gets about ${Math.round(PHONE_WIDTH / tracks)}px.`,
        fix: "Use repeat(auto-fit, minmax(<min>, 1fr)), or set the columns inside a min-width media query.",
      };
    }
  }
  if ((u.property === "height" || u.property === "min-height") && /^100vh$/.test(value)) {
    return {
      rule: "responsive-viewport-height",
      base: "info",
      message: "100vh on a phone includes the area under the browser's address bar: the bottom gets hidden.",
      fix: "Use 100dvh, which follows the visible height (keep 100vh before it as a fallback if needed).",
    };
  }
  return null;
}
