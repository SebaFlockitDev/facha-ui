import { findColorLiterals } from "./color.js";
import type { Context } from "./context.js";
import type { Usage } from "./sources/usage.js";
import { suggestArbitrary, suggestColor, suggestTokenName } from "./suggest.js";
import { parseArbitrary } from "./tailwind.js";
import { customRules, describeScale, isForeignPalette, isForeignScale, parsePaletteClass, parseScaleClass, suggestScale } from "./project-rules.js";
import { baseUtility } from "./tailwind.js";
import { classContrast, describeContrast, isNonTextTarget, minRatioOf, nonTextContrast, suggestReadable, textContrast } from "./visual.js";
import type { Loc, RuleId, Severity, Suggestion, Unresolved, Violation } from "./types.js";

export const RULES: { id: RuleId; severity: Severity; summary: string }[] = [
  {
    id: "color-literal",
    severity: "error",
    summary:
      "Color literal (hex, rgb(), hsl(), oklch(), named color) outside the token definitions: CSS, style={{}}, bg-[#…], SVG fill/stroke.",
  },
  {
    id: "tailwind-arbitrary-value",
    severity: "error",
    summary:
      "Arbitrary Tailwind values x-[…] and [prop:val]: error for typography, color, radius, shadow and spacing; warning for sizing/layout; info when the value is just var(--existing-token).",
  },
  {
    id: "unknown-token",
    severity: "error",
    summary: "var(--x) where --x is not defined as a design token or as a local custom property.",
  },
  {
    id: "inline-style",
    severity: "info",
    summary: "style={{…}} attribute: a signal of a missing class or component pattern.",
  },
  {
    id: "tailwind-palette-color",
    severity: "error",
    summary:
      "Tailwind default-palette color utilities (text-gray-500, bg-white, border-slate-200…) in a project with its own tokens, unless the color is mapped in @theme or tailwind.useDefaultTheme is true. Suggests the closest project token.",
  },
  {
    id: "tailwind-default-scale",
    severity: "warning",
    summary:
      "Tailwind default scales not mapped in @theme for radius, shadow, font size, tracking and leading (rounded-lg, shadow-md, text-sm, tracking-wide). Spacing, sizing, font weight and layout are accepted by default (tailwind.allowDefaultScale).",
  },
  {
    id: "theme-contrast",
    severity: "error",
    summary:
      "Text color below contrast.minRatio against its real background in some theme: the rule's own background, or the reference surfaces. Error when the background is known (own background or surfaces declared in contrast.surfaces), warning when the surfaces were autodetected.",
  },
  {
    id: "class-contrast",
    severity: "error",
    summary:
      "A class whose CSS rule sets a text color that fails contrast in some theme (the guardian cannot see it from the component otherwise). Same severity logic as theme-contrast.",
  },
  {
    id: "non-text-contrast",
    severity: "warning",
    summary:
      "WCAG 1.4.11: borders and outlines of interactive parts, focus rings and SVG icons below contrast.nonTextMinRatio (3:1 by default) against their background.",
  },
];

const MESSAGES: Record<RuleId, string> = {
  "color-literal": "Color literal outside the design tokens; it does not follow theme changes.",
  "tailwind-arbitrary-value": "Arbitrary Tailwind value bypasses the design system.",
  "unknown-token": "var() references a token that is not defined in the design system.",
  "inline-style": "Inline style: signals a missing pattern (class or component) in the design system.",
  "tailwind-palette-color": "Tailwind default-palette color instead of a project token.",
  "tailwind-default-scale": "Tailwind default scale step instead of a project value.",
  "theme-contrast": "Text color does not reach the minimum contrast against its background in some theme.",
  "class-contrast": "This class sets a text color that does not reach the minimum contrast in some theme.",
  "non-text-contrast": "Interactive border, focus ring or icon does not reach 3:1 against its background.",
};

const ALWAYS_ALLOWED_VARS = /^--tw-/;

/** Config overrides replace the default severity; `soft` findings (token-only arbitrary values) stay as they are. */
export function effectiveSeverity(ctx: Context, rule: RuleId, base: Severity, soft = false): Severity | "off" {
  const override = ctx.project.config.rules?.[rule];
  if (override === "off") return "off";
  if (!override || soft) return base;
  return override;
}

function clip(s: string, n = 200): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export interface FileResult {
  violations: Violation[];
  unresolved: Unresolved[];
}

export function checkUsages(ctx: Context, usages: Usage[]): FileResult {
  const violations: Violation[] = [];
  const unresolved: Unresolved[] = [];
  const otherThemes = ctx.tokens.themes.slice(1).map((t) => t.name);
  const allowed = new Set((ctx.project.config.allow?.literals ?? []).map((s) => s.toLowerCase()));
  const custom = customRules(ctx);

  const push = (
    rule: RuleId | `custom/${string}`,
    base: Severity,
    loc: Loc,
    found: string,
    property: string | null,
    context: Violation["context"],
    suggestion: Suggestion,
    breaksThemes: string[] = [],
    soft = false,
    message?: string,
  ) => {
    const severity = rule.startsWith("custom/") ? base : effectiveSeverity(ctx, rule as RuleId, base, soft);
    if (severity === "off") return;
    violations.push({
      id: `${loc.file}:${loc.line}:${loc.column}:${rule}`,
      rule,
      severity,
      file: loc.file,
      line: loc.line,
      column: loc.column,
      found: clip(found),
      property,
      context,
      message: message ?? MESSAGES[rule as RuleId],
      breaksThemes,
      suggestion,
    });
  };

  const checkVarRefs = (text: string, locAt: (i: number) => Loc, property: string | null, context: Violation["context"]) => {
    for (const m of text.matchAll(/var\(\s*(--[\w-]+)/g)) {
      const name = m[1]!;
      if (ALWAYS_ALLOWED_VARS.test(name) || ctx.definedCustomProps.has(name)) continue;
      push("unknown-token", "error", locAt(m.index!), m[0] + ")", property, context, suggestTokenName(ctx, name));
    }
  };

  for (const u of usages) {
    if (u.kind === "class-dynamic") {
      unresolved.push({ file: u.file, line: u.line, column: u.column, found: u.raw, reason: "Dynamic class name: only the static part can be checked." });
      continue;
    }
    if (u.kind === "inline-style") {
      push("inline-style", "info", u, u.raw, null, "inline-style", {
        match: "none",
        kind: "none",
        value: null,
        detail: "Consider a component class (or an existing one) instead of inline styles.",
        source: null,
      });
      continue;
    }
    if (u.kind === "class") {
      const loc0 = { file: u.file, line: u.line, column: u.column };
      const util = baseUtility(u.raw);
      for (const cr of custom) {
        if (cr.kind !== "forbid-class" || cr.severity === "off" || !cr.pattern!.test(util)) continue;
        push(`custom/${cr.id}`, cr.severity, loc0, u.raw, null, "className", {
          match: "none",
          kind: "none",
          value: null,
          detail: `Matches /${cr.pattern!.source}/ from the project's custom rules.`,
          source: "facha-ui.config.json",
        }, [], false, cr.message);
      }
      const a = parseArbitrary(u.raw);
      if (!a) {
        const palette = parsePaletteClass(u.raw);
        if (palette && isForeignPalette(ctx, palette)) {
          push(
            "tailwind-palette-color",
            "error",
            loc0,
            u.raw,
            palette.property,
            "className",
            suggestColor(ctx, palette.value, palette.property),
            otherThemes,
            false,
            `${palette.utility} is Tailwind's default ${palette.key} (${palette.value})${palette.opacity ? ` at ${palette.opacity} opacity` : ""}, not a project token.`,
          );
          continue;
        }
        const scale = parseScaleClass(u.raw);
        if (scale && isForeignScale(ctx, scale)) {
          push("tailwind-default-scale", "warning", loc0, u.raw, scale.property, "className", suggestScale(ctx, scale), [], false, describeScale(scale));
          continue;
        }
        const finding = classContrast(ctx, util);
        if (finding) {
          const r = finding.result;
          push(
            "class-contrast",
            r.certain ? "error" : "warning",
            { file: u.file, line: u.line, column: u.column },
            u.raw,
            "color",
            "className",
            { ...suggestReadable(ctx, finding.value, finding.background, finding.selector, r), source: finding.source },
            r.failing,
            false,
            `.${u.raw} sets color: ${finding.value} (${finding.source}): ${describeContrast(r)}.`,
          );
        }
        continue;
      }
      const loc = { file: u.file, line: u.line, column: u.column };
      const varOnly = a.value.match(/^var\(\s*(--[\w-]+)\s*\)$/);
      if (varOnly) {
        const name = varOnly[1]!;
        if (!ctx.definedCustomProps.has(name) && !ALWAYS_ALLOWED_VARS.test(name)) {
          push("unknown-token", "error", loc, u.raw, a.property, "className", suggestTokenName(ctx, name));
        } else {
          const t = ctx.tokens.byName.get(name);
          const property = a.prefix === "text" && t?.type === "color" ? "color" : a.property;
          push("tailwind-arbitrary-value", "info", loc, u.raw, property, "className", {
            match: "none",
            kind: "none",
            value: null,
            detail: `Uses the token ${name} through an arbitrary value; prefer a component class or an @theme utility.`,
            source: t?.source ?? null,
          }, [], true);
        }
        continue;
      }
      if (a.category === "color") {
        const lit = findColorLiterals(a.value, a.property)[0];
        if (lit && !allowed.has(lit.text.toLowerCase())) {
          push("color-literal", "error", loc, u.raw, a.property, "className", suggestColor(ctx, lit.text, a.property), otherThemes);
          continue;
        }
      }
      checkVarRefs(a.value, () => loc, a.property, "className");
      const severity: Severity = a.category === "sizing" || a.category === "layout" ? "warning" : "error";
      push("tailwind-arbitrary-value", severity, loc, u.raw, a.property, "className", suggestArbitrary(ctx, a));
      continue;
    }
    // decl: CSS declaration, inline style property or SVG attribute
    const context: Violation["context"] = u.context === "css" ? "css" : u.context;
    for (const lit of findColorLiterals(u.value, u.property)) {
      if (allowed.has(lit.text.toLowerCase())) continue;
      push("color-literal", "error", u.locAt(lit.index), lit.text, u.property, context, suggestColor(ctx, lit.text, u.property), otherThemes);
    }
    checkVarRefs(u.value, u.locAt, u.property, context);

    // Declarative team rules: tokens forbidden in some selectors/properties.
    for (const cr of custom) {
      if (cr.kind !== "forbid-token" || cr.severity === "off") continue;
      if (cr.selector && !(u.selector && cr.selector.test(u.selector))) continue;
      if (cr.property && !cr.property.test(u.property)) continue;
      for (const m of u.value.matchAll(/var\(\s*(--[\w-]+)/g)) {
        if (!cr.tokens!.has(m[1]!)) continue;
        push(`custom/${cr.id}`, cr.severity, u.locAt(m.index!), `${u.property}: ${m[0]})`, u.property, context, {
          match: "none",
          kind: "none",
          value: null,
          detail: `${m[1]} is forbidden here by the project's custom rule ${cr.id}.`,
          source: "facha-ui.config.json",
        }, [], false, cr.message);
      }
    }

    // Contrast of the text color against its real background (per usage).
    if (u.property === "color" && (u.context === "css" || u.context === "inline-style")) {
      const bg = u.siblingBackground ?? null;
      const r = textContrast(ctx, u.value, bg, u.selector, minRatioOf(ctx));
      if (r && r.failing.length > 0) {
        push(
          "theme-contrast",
          r.certain ? "error" : "warning",
          { file: u.file, line: u.line, column: u.column },
          u.value,
          "color",
          context,
          suggestReadable(ctx, u.value, bg, u.selector, r),
          r.failing,
          false,
          `Text color ${u.value.trim()}: ${describeContrast(r)}.`,
        );
      }
    }
    // WCAG 1.4.11 for interactive borders, focus rings and icons.
    if (isNonTextTarget(u.property, u.selector, u.context)) {
      const bg = u.siblingBackground ?? null;
      const r = nonTextContrast(ctx, u.value, bg, u.selector);
      if (r && r.failing.length > 0) {
        push(
          "non-text-contrast",
          "warning",
          { file: u.file, line: u.line, column: u.column },
          u.value,
          u.property,
          context,
          { match: "none", kind: "none", value: null, detail: describeContrast(r), source: null },
          r.failing,
          false,
          `${u.property}: ${u.value.trim()}: ${describeContrast(r)}.`,
        );
      }
    }
  }

  return { violations, unresolved };
}
