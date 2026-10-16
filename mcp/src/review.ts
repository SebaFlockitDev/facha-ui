import path from "node:path";
import { extractFile, toPx, type Context } from "./context.js";
import { parseScaleClass } from "./project-rules.js";
import { readSource, rel, resolveUserPath, SOURCE_EXTENSIONS, walk } from "./project.js";
import { isScreen } from "./screens.js";
import type { ElementUsage, Usage } from "./sources/usage.js";
import { FachaError, type Severity } from "./types.js";

/**
 * review_ui: measurable signals of visual hierarchy and state coverage, for the critique the
 * variants skill does over the captures. Deterministic and read-only. These are heuristics, not
 * rules: they never block, they point where a senior would look first.
 */

export interface ReviewFinding {
  id: string;
  heuristic: "primary-action" | "accents" | "type-scale" | "headings" | "states" | "nested-surfaces";
  severity: Severity;
  file: string;
  line: number;
  evidence: string;
  why: string;
  fix: string;
}

const MAX_ACCENTS = 2;
const MAX_FONT_SIZES = 4;
/** A shell or layout component that receives the screen's title (<AppShell title="…">). */
const TITLE_PROP = /<[A-Z][\w.]*[^>]*\btitle=/;
const RENDERS_LIST = /\.map\(/;
const LOADS_DATA = /\buse[A-Z]\w*\(|\bfetch\(|\bawait\s|\buseQuery\(|\buseSWR\(/;
const STATE_SIGNALS: Record<"loading" | "empty" | "error", RegExp> = {
  loading: /\b(is)?[lL]oading\b|\bisPending\b|[sS]keleton|aria-busy|[sS]pinner|Cargando/,
  empty: /\.length\s*===?\s*0|!\s*[\w.?]+\.length\b|\b[eE]mpty|vac[ií]o|No hay|[sS]in resultados|no results/i,
  error: /\b[eE]rror\b|role=["']alert["']|\bcatch\s*\(/,
};

const base = (cls: string) => cls.slice(cls.lastIndexOf(":") + 1).replace(/^!/, "");
const varRefs = (text: string) => [...text.matchAll(/var\(\s*(--[\w-]+)|\((--[\w-]+)\)/g)].map((m) => (m[1] ?? m[2])!);

function isAction(e: ElementUsage): boolean {
  return (
    e.tag === "button" ||
    (e.tag === "a" && "href" in e.attrs) ||
    e.attrs.role === "button" ||
    (e.tag === "input" && (e.attrs.type === "submit" || e.attrs.type === "button"))
  );
}

/** The code without comments, keeping line breaks so line numbers still match. */
export function withoutComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (m, lead: string) => lead + " ".repeat(m.length - lead.length));
}

function lineOf(text: string, re: RegExp): number | null {
  const m = re.exec(text);
  return m ? text.slice(0, m.index).split("\n").length : null;
}

/**
 * Classes that make an element look like a card: a corner radius plus a border or a shadow (Tailwind
 * utilities on the same element, or one project class that declares both).
 */
function looksLikeCard(classes: string[], classRule: Map<string, { decls: { prop: string; value: string }[] }>): boolean {
  const own = classes.filter((c) => !c.includes(":")).map(base);
  const rounded = own.some((c) => /^rounded(-(?!none|full)[\w-]+)?$/.test(c));
  const edge = own.some((c) => /^border(-[0-9]+)?$/.test(c) || /^shadow(-(?!none)[\w-]+)?$/.test(c));
  if (rounded && edge) return true;
  return own.some((c) => {
    const decls = classRule.get(c)?.decls ?? [];
    const radius = decls.some((d) => d.prop === "border-radius" && !/^(0|0px|none)$/.test(d.value.trim()));
    const border = decls.some(
      (d) => (/^border(-(top|right|bottom|left))?$/.test(d.prop) && !/^(0|none)\b/.test(d.value.trim())) || (d.prop === "box-shadow" && d.value.trim() !== "none"),
    );
    return radius && border;
  });
}

export function reviewUi(ctx: Context, input: string) {
  const { abs, isDir } = resolveUserPath(ctx.project, input);
  const relPath = rel(ctx.project, abs) || ".";
  const files = (isDir ? walk(abs) : [abs]).filter((f) => SOURCE_EXTENSIONS.has(path.extname(f)) && !f.endsWith(".css"));
  if (!isDir && files.length === 0) throw new FachaError("UNSUPPORTED_FILE", `review_ui reads JSX/TSX files: ${relPath}`, { path: input });

  const roleOf = (token: string) => ctx.tokens.byName.get(token)?.role ?? "";
  const classRule = new Map(ctx.componentClasses.filter((c) => /^\.[\w-]+$/.test(c.selector)).map((c) => [c.selector.slice(1), c]));
  const typography = new Map(ctx.typographyClasses.map((t) => [t.className, t.fontSizePx]));

  const results = [];
  const findings: ReviewFinding[] = [];

  for (const f of files.sort()) {
    const { usages } = extractFile(ctx, f);
    const file = rel(ctx.project, f);
    const source = withoutComments(readSource(f) ?? "");
    const elements = usages.filter((u): u is ElementUsage => u.kind === "element");

    // Primary actions: buttons and links painted with the brand's primary accent.
    const primary = elements.filter((e) => {
      if (!isAction(e)) return false;
      return e.classes.some((c) => {
        const b = base(c);
        if (/^bg-/.test(b) && varRefs(b).some((t) => roleOf(t) === "accent.primary")) return true;
        const cc = classRule.get(b);
        if (!cc) return false;
        const paints = cc.decls.some((d) => /^background(-color)?$/.test(d.prop) && varRefs(d.value).some((t) => roleOf(t) === "accent.primary"));
        return paints || /(^|-)(primary|cta)($|-)/.test(b);
      });
    });

    // Accents in use: tokens with an accent role, from classes, styles and the component classes used.
    const accents = new Set<string>();
    const addRefs = (text: string) => {
      for (const t of varRefs(text)) if (roleOf(t).startsWith("accent")) accents.add(t);
    };
    for (const u of usages as Usage[]) {
      if (u.kind === "class") addRefs(u.raw);
      else if (u.kind === "decl") addRefs(u.value);
      else if (u.kind === "element") for (const c of u.classes) for (const t of classRule.get(base(c))?.tokens ?? []) if (roleOf(t).startsWith("accent")) accents.add(t);
    }

    // Font sizes in use (px): typography classes, component classes, Tailwind steps and literals.
    const sizes = new Set<number>();
    for (const e of elements) {
      for (const c of e.classes) {
        const b = base(c);
        const typo = typography.get(b);
        if (typo != null) sizes.add(typo);
        const fs = classRule.get(b)?.decls.find((d) => d.prop === "font-size");
        const ccPx = fs ? toPx(fs.value) : null;
        if (ccPx != null) sizes.add(ccPx);
        const scale = parseScaleClass(b);
        if (scale?.kind === "fontSize" && scale.value) {
          const px = toPx(scale.value);
          if (px != null) sizes.add(px);
        }
        const arb = b.match(/^text-\[(\d+(?:\.\d+)?)(px|rem)\]$/);
        if (arb) sizes.add(arb[2] === "rem" ? Number(arb[1]) * 16 : Number(arb[1]));
      }
    }
    for (const u of usages) if (u.kind === "decl" && u.property === "font-size") {
      const px = toPx(u.value);
      if (px != null) sizes.add(px);
    }

    const headings = elements
      .filter((e) => /^h[1-6]$/.test(e.tag))
      .map((e) => ({ level: Number(e.tag[1]), text: e.text, line: e.line }));

    const screen = isScreen(ctx, file);
    const states = Object.fromEntries(
      (Object.keys(STATE_SIGNALS) as (keyof typeof STATE_SIGNALS)[]).map((k) => [k, lineOf(source, STATE_SIGNALS[k])]),
    ) as Record<keyof typeof STATE_SIGNALS, number | null>;

    results.push({
      file,
      primaryActions: primary.map((e) => ({ line: e.line, element: `<${e.tag}${e.text ? ` «${e.text.slice(0, 40)}»` : ""}>` })),
      accents: [...accents].sort(),
      fontSizesPx: [...sizes].sort((a, b) => a - b),
      headings,
      states: screen ? states : null,
    });

    const add = (heuristic: ReviewFinding["heuristic"], severity: Severity, line: number, evidence: string, why: string, fix: string) =>
      findings.push({ id: `${file}:${line}:${heuristic}`, heuristic, severity, file, line, evidence, why, fix });

    if (primary.length > 1) {
      add("primary-action", "warning", primary[1]!.line, `${primary.length} primary actions: ${primary.map((e) => `line ${e.line}`).join(", ")}`,
        "Several primary actions compete: the eye has no single answer to \"what do I do here?\".",
        "Keep one primary action per view (the one that serves the goal); make the others secondary or links. Repeated row actions can be secondary with the main one at the top.");
    }
    if (accents.size > MAX_ACCENTS) {
      add("accents", "warning", 1, `${accents.size} accent tokens: ${[...accents].sort().join(", ")}`,
        "Too many accents compete for attention, so none of them stands out.",
        `Use at most ${MAX_ACCENTS} accents (brand plus one punctual emphasis); status colors are for states, not decoration.`);
    }
    if (sizes.size > MAX_FONT_SIZES) {
      add("type-scale", "info", 1, `${sizes.size} font sizes: ${[...sizes].sort((a, b) => a - b).map((s) => `${s}px`).join(", ")}`,
        "Many sizes blur the hierarchy: the difference between levels stops being readable.",
        `Stay within ${MAX_FONT_SIZES} steps of the project's type scale: title, section, body and caption.`);
    }
    if (headings.filter((h) => h.level === 1).length > 1) {
      add("headings", "warning", headings.filter((h) => h.level === 1)[1]!.line, "more than one <h1>",
        "Two main titles split the page's purpose for readers and screen readers.",
        "Keep one h1 (often in the shell) and use h2 for the sections.");
    }
    if (screen && headings.length === 0 && !TITLE_PROP.test(source)) {
      add("headings", "info", 1, "no heading in the screen",
        "Sections without headings are hard to scan and to navigate with a screen reader.",
        "Give each section a heading (h2) with the project's section-title class.");
    }
    // A card inside a card: two boundaries that both claim to group the same content (common region).
    for (const e of elements) {
      if (!looksLikeCard(e.classes, classRule)) continue;
      if (!(e.ancestorClassLists ?? []).some((a) => looksLikeCard(a, classRule))) continue;
      add("nested-surfaces", "info", e.line, `<${e.tag}> with a border or shadow inside another card`,
        "A boundary groups what is inside it (ux:gestalt-common-region): a card inside a card draws two groups around the same content, and the inner one often adds noise instead of structure.",
        "Check that the inner boundary groups something on its own (a callout, a selected item); if not, drop its border or shadow and separate with space or a subtle background.");
      break;
    }
    if (screen && LOADS_DATA.test(source)) {
      for (const [state, line] of Object.entries(states)) {
        if (line != null || (state === "empty" && !RENDERS_LIST.test(source))) continue;
        add("states", "info", 1, `no ${state} state found`,
          state === "loading" ? "Without a loading state the screen looks broken or empty while data arrives."
            : state === "empty" ? "Without an empty state, no data looks like an error and gives no next step."
              : "Without an error state, a failure leaves the user with nothing to do.",
          state === "loading" ? "Show a loading state that keeps the layout (skeleton or a short message)."
            : state === "empty" ? "Show what is missing and the next step (a message and, if it applies, an action)."
              : "Show what failed in plain words and how to retry.");
      }
    }
  }

  const summary = { warning: findings.filter((f) => f.severity === "warning").length, info: findings.filter((f) => f.severity === "info").length, files: results.length };
  return {
    path: relPath,
    configSource: ctx.project.configSource,
    summary,
    files: results,
    findings: findings.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line || (a.heuristic < b.heuristic ? -1 : 1))),
    notes: [
      "Signals for a visual critique, not rules: they never block. Confirm each one on the captures (light and dark) before changing anything.",
      "State signals are found by reading the code; check them in the captures with ?state=loading|empty|error|long in the lab.",
    ],
  };
}
