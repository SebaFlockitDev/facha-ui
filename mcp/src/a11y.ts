import type { ElementUsage, Usage } from "./sources/usage.js";
import type { Loc, RuleId, Severity } from "./types.js";

/**
 * Accessibility rules on JSX elements: deterministic, from the source. They cover what a static
 * read can prove (a missing alt, a control without a label, a button without a name, a click
 * handler on a non-interactive element, a positive tabIndex, a removed focus outline, a target
 * under 24×24 px, a skipped heading level). What depends on the rendered page is left to the
 * captures and the review.
 */

export type A11yReport = (rule: RuleId, base: Severity, loc: Loc, found: string, message: string, fix: string) => void;

const INTERACTIVE_ROLES = new Set(["button", "link", "checkbox", "radio", "switch", "tab", "menuitem", "option", "combobox", "textbox", "slider", "treeitem", "gridcell"]);
const NON_INTERACTIVE = new Set(["div", "span", "li", "td", "tr", "th", "p", "img", "section", "article", "header", "footer", "main", "aside", "ul", "ol", "table", "tbody", "svg", "i", "label", "h1", "h2", "h3", "h4", "h5", "h6"]);
const UNLABELED_INPUT_TYPES = new Set(["hidden", "submit", "button", "reset", "image"]);
const FOCUS_REPLACEMENT = /^(focus|focus-visible|focus-within|group-focus|peer-focus):(ring|outline|border|shadow|bg|underline|decoration)/;
const PADDING = /^(p|px|py|pt|pb|pl|pr|ps|pe)-|^min-(h|w)-|^size-(full|auto)/;

const has = (e: ElementUsage, attr: string) => attr in e.attrs;
const hasValue = (e: ElementUsage, attr: string) => has(e, attr) && (e.attrs[attr] !== "" || e.dynamic.includes(attr));
const base = (cls: string) => cls.slice(cls.lastIndexOf(":") + 1).replace(/^!/, "");
const loc = (e: ElementUsage): Loc => ({ file: e.file, line: e.line, column: e.column });
const show = (e: ElementUsage) => `<${e.tag}${e.text ? ` «${e.text.slice(0, 40)}»` : ""}>`;

/** px of a Tailwind size utility (h-4, w-5, size-3, h-[18px]); null when it is not one. */
function sizePx(cls: string, axis: "h" | "w"): number | null {
  const b = base(cls);
  const m = b.match(new RegExp(`^(?:${axis}|size)-(\\d+(?:\\.\\d+)?|\\[(\\d+(?:\\.\\d+)?)(px|rem)\\])$`));
  if (!m) return null;
  if (m[2]) return m[3] === "rem" ? Number(m[2]) * 16 : Number(m[2]);
  return Number(m[1]) * 4;
}

function isButtonLike(e: ElementUsage): boolean {
  return e.tag === "button" || (e.tag === "a" && has(e, "href")) || e.attrs.role === "button" || e.attrs.role === "link";
}

export function checkA11y(usages: Usage[], report: A11yReport): void {
  const elements = usages.filter((u): u is ElementUsage => u.kind === "element");
  const labelled = new Set(elements.filter((e) => e.tag === "label" && e.attrs.htmlFor && e.attrs.htmlFor !== "{}").map((e) => e.attrs.htmlFor!));
  const anyDynamicLabel = elements.some((e) => e.tag === "label" && e.dynamic.includes("htmlFor"));
  let lastHeading = 0;

  for (const e of elements) {
    const hidden = e.attrs["aria-hidden"] === "true" || e.attrs.role === "presentation" || e.attrs.role === "none";
    const named = hasValue(e, "aria-label") || hasValue(e, "aria-labelledby");

    if (e.tag === "img" && !e.spread && !hidden && !has(e, "alt")) {
      report("a11y-img-alt", "error", loc(e), show(e),
        "Image without alt: screen readers announce the file name or nothing.",
        'Add alt with what the image tells (alt="" if it is only decorative).');
    }

    const inputType = e.attrs.type ?? "text";
    const isControl = e.tag === "select" || e.tag === "textarea" || (e.tag === "input" && !UNLABELED_INPUT_TYPES.has(inputType) && !e.dynamic.includes("type"));
    if (isControl && !e.spread && !hidden && !named && !e.inLabel && !hasValue(e, "title")) {
      const id = e.attrs.id;
      const byFor = id && id !== "{}" && labelled.has(id);
      const unknown = e.dynamic.includes("id") || (id && anyDynamicLabel);
      if (!byFor && !unknown) {
        report("a11y-control-label", "error", loc(e), show(e),
          `Form control without a label${has(e, "placeholder") ? " (a placeholder is not a label: it disappears when typing)" : ""}.`,
          'Wrap it in <label>, or give it an id with <label htmlFor="…">, or aria-label when the label is visual only.');
      }
    }

    if (isButtonLike(e) && !e.spread && !hidden && !named && !hasValue(e, "title") && e.name === "none") {
      report("a11y-button-name", "error", loc(e), show(e),
        "Button or link without an accessible name: it is announced as just \"button\".",
        "Add visible text, or aria-label when it is an icon (and aria-hidden on the icon).");
    }

    const backdrop = ["dialog", "alertdialog", "presentation", "none"].includes(e.attrs.role ?? "");
    if (NON_INTERACTIVE.has(e.tag) && has(e, "onClick") && !e.spread && !backdrop) {
      const role = e.attrs.role;
      const keyboard = has(e, "onKeyDown") || has(e, "onKeyUp") || has(e, "onKeyPress");
      const focusable = has(e, "tabIndex");
      if (!(role && INTERACTIVE_ROLES.has(role) && keyboard && focusable)) {
        report("a11y-click-target", "warning", loc(e), show(e),
          `Click handler on a <${e.tag}>: it cannot be reached with the keyboard${role ? "" : " and has no role"}.`,
          "Use a <button> (or <a href> to navigate). If it must stay, add role, tabIndex={0} and a key handler.");
      }
    }

    const tabIndex = Number(e.attrs.tabIndex);
    if (has(e, "tabIndex") && !e.dynamic.includes("tabIndex") && tabIndex > 0) {
      report("a11y-tabindex", "warning", loc(e), `tabIndex=${tabIndex}`,
        "Positive tabIndex changes the keyboard order away from the visual order.",
        "Use tabIndex={0} (or none) and order the elements in the markup.");
    }

    const removesOutline = e.classes.some((c) => /^(outline-none|outline-0)$/.test(base(c)) && (!c.includes(":") || /^(focus|focus-visible):/.test(c)));
    if (removesOutline && !e.classes.some((c) => FOCUS_REPLACEMENT.test(c))) {
      report("a11y-focus-visible", "warning", loc(e), e.classes.find((c) => /outline-(none|0)$/.test(c)) ?? "outline-none",
        "The focus outline is removed with no visible replacement: keyboard users lose track of where they are.",
        "Keep the outline, or add a focus-visible style (focus-visible:ring-… or an outline with a project token).");
    }

    if (isButtonLike(e) && !e.classes.some((c) => PADDING.test(base(c)))) {
      const h = Math.min(...e.classes.map((c) => sizePx(c, "h") ?? Infinity));
      const w = Math.min(...e.classes.map((c) => sizePx(c, "w") ?? Infinity));
      const small = Math.min(h, w);
      if (Number.isFinite(small) && small < 24) {
        report("a11y-target-size", "warning", loc(e), `${show(e)} ${Math.round(small)}px`,
          `Target of ${Math.round(small)}px: below the 24×24 px minimum (WCAG 2.5.8); hard to hit on touch screens.`,
          "Give the control at least 24×24 px (padding or a min size), even if the icon stays small.");
      }
    }

    const heading = e.tag.match(/^h([1-6])$/);
    if (heading) {
      const level = Number(heading[1]);
      if (lastHeading > 0 && level > lastHeading + 1) {
        report("a11y-heading-order", "warning", loc(e), `<h${lastHeading}> → <h${level}>`,
          `Heading level jumps from h${lastHeading} to h${level}: the outline that screen readers navigate has a hole.`,
          `Use h${lastHeading + 1} here, and style it with the class you need (the level is structure, not size).`);
      }
      lastHeading = level;
    }
  }
}

/** CSS that removes the focus outline in a :focus rule without another visible focus style. */
export function removesFocusOutline(property: string, value: string, selector: string | null, siblings: { prop: string; value: string }[] | null): boolean {
  if (!selector || !/:focus(?!-within)/.test(selector) || /:not\(:focus-visible\)/.test(selector)) return false;
  if (!/^outline(-style|-width)?$/.test(property) || !/^(none|0(px)?)$/.test(value.trim())) return false;
  return !(siblings ?? []).some((d) => /^(box-shadow|border|border-color|outline-color|background|background-color|text-decoration)$/.test(d.prop) && !/^(none|0)$/.test(d.value.trim()));
}
