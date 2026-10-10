import path from "node:path";
import postcss, { type AtRule, type Root, type Rule } from "postcss";
import { findColorLiterals } from "./color.js";
import { extractCss } from "./sources/css.js";
import { extractJsx } from "./sources/jsx.js";
import type { Usage } from "./sources/usage.js";
import { listProjectFiles, openProject, readSource, rel, type Project, type Workspace } from "./project.js";
import { readTailwindConfig, type TailwindConfigMapping } from "./tailwind-config.js";
import { loadTokens, selectorContext, themeForSelector, type TokenSet } from "./tokens.js";
import type { Skipped } from "./types.js";

export const CLASS_HELPERS = ["clsx", "cn", "cva", "twMerge", "classnames", "classNames"];

const TYPO_PROPS = new Set([
  "font-size", "font-weight", "letter-spacing", "line-height", "text-transform", "color",
  "font-family", "font-variant-numeric", "margin", "margin-top", "margin-bottom",
]);

export interface ComponentClass {
  selector: string;
  source: string;
  decls: { prop: string; value: string }[];
  tokens: string[];
  literals: string[];
}

export interface Context {
  project: Project;
  tokens: TokenSet;
  componentClasses: ComponentClass[];
  /** Single-class rules that only set typographic properties and a font-size. */
  typographyClasses: { className: string; fontSizePx: number; source: string }[];
  /** font-size literals used anywhere in component classes, in px → selectors. */
  fontSizeUses: Map<number, string[]>;
  /** Custom properties defined anywhere in project CSS (tokens + local). */
  definedCustomProps: Set<string>;
  /** Parsed CSS by project-relative path (token sources and project CSS). */
  cssRoots: Map<string, Root>;
  /** Tailwind 3 theme mapping read statically from tailwind.config, when the project has one. */
  tailwindConfig: TailwindConfigMapping | null;
}

/** Reads the tailwind.config mapping (without running it) and says what was and was not read. */
function tailwindMapping(project: Project, cssRoots: Map<string, Root>): TailwindConfigMapping | null {
  if (!project.hasTailwind) return null;
  // Tailwind 4 can point to a v3 config from CSS with @config "<path>", relative to that stylesheet.
  const cssConfigs: string[] = [];
  for (const [file, root] of cssRoots) {
    root.walkAtRules("config", (at: AtRule) => {
      const p = at.params.trim().replace(/^["']|["']$/g, "");
      if (p) cssConfigs.push(path.posix.normalize(path.posix.join(path.posix.dirname(file), p)));
    });
  }
  const mapping = readTailwindConfig(project, cssConfigs);
  if (!mapping) return null;
  const sample = [...mapping.mapped].slice(0, 6).join(", ");
  project.assumptions.push(
    `Tailwind config read statically (${mapping.file}, never run): ${mapping.mapped.size} utilit${mapping.mapped.size === 1 ? "y" : "ies"} mapped to project values${sample ? ` (${sample}${mapping.mapped.size > 6 ? "…" : ""})` : ""}.`,
  );
  if (mapping.unread.length) {
    const list = mapping.unread.map((u) => `${u.what}${u.line ? ` (line ${u.line})` : ""}`).join("; ");
    project.assumptions.push(`Not read in ${mapping.file} without running it: ${list}. If they map utilities to project values, list them in tailwind.mapped.`);
  }
  return mapping;
}

export function toPx(value: string): number | null {
  const v = value.trim();
  const calc = v.match(/^calc\((.+)\)$/);
  if (calc) return calcPx(calc[1]!);
  const m = v.match(/^(-?[\d.]+)(px|rem|em)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (m[2] === "rem" || m[2] === "em") return n * 16;
  return n;
}

/**
 * px of a calc() made only of lengths and numbers, left to right with * and / first:
 * "0.625rem - 2px" → 8. Null for anything else (var(), %, viewport units…).
 */
function calcPx(expr: string): number | null {
  const parts = expr.trim().split(/\s+([-+*/])\s+/);
  const terms: { n: number; length: boolean }[] = [];
  const ops: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) {
      ops.push(parts[i]!);
      continue;
    }
    const m = parts[i]!.match(/^(-?[\d.]+)(px|rem|em)?$/);
    if (!m) return null;
    const n = Number(m[1]);
    terms.push({ n: m[2] === "rem" || m[2] === "em" ? n * 16 : n, length: m[2] !== undefined });
  }
  // * and / first.
  for (let i = 0; i < ops.length; ) {
    if (ops[i] === "*" || ops[i] === "/") {
      const a = terms[i]!;
      const b = terms[i + 1]!;
      if (ops[i] === "/" && b.n === 0) return null;
      terms.splice(i, 2, { n: ops[i] === "*" ? a.n * b.n : a.n / b.n, length: a.length || b.length });
      ops.splice(i, 1);
    } else i++;
  }
  let total = terms[0]!.n;
  for (let i = 0; i < ops.length; i++) total = ops[i] === "+" ? total + terms[i + 1]!.n : total - terms[i + 1]!.n;
  return Math.round(total * 1000) / 1000;
}

export function createContext(root: string, ws?: Workspace): Context {
  const project = openProject(root, ws);
  const tokens = loadTokens(project);
  const cssRoots = new Map<string, Root>(tokens.parsed);
  for (const abs of listProjectFiles(project)) {
    const r = rel(project, abs);
    if (!r.endsWith(".css") || cssRoots.has(r)) continue;
    const text = readSource(abs);
    if (text == null) continue;
    try {
      cssRoots.set(r, postcss.parse(text, { from: r }));
    } catch {
      /* reported when the file is checked */
    }
  }

  const definedCustomProps = new Set<string>([...tokens.byName.keys(), ...tokens.localCustomProps]);
  const componentClasses: ComponentClass[] = [];
  const typographyClasses: Context["typographyClasses"] = [];
  const fontSizeUses = new Map<number, string[]>();

  for (const [file, root] of [...cssRoots.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    root.walkRules((rule: Rule) => {
      const ctx = selectorContext(rule);
      const decls = (rule.nodes ?? []).filter((n: any) => n.type === "decl") as any[];
      for (const d of decls) if (d.prop.startsWith("--")) definedCustomProps.add(d.prop);
      if (themeForSelector(ctx, project.config.tokens.themes) !== null) return;
      for (const d of decls) {
        if (d.prop !== "font-size") continue;
        const px = toPx(d.value);
        if (px != null) fontSizeUses.set(px, [...(fontSizeUses.get(px) ?? []), ctx]);
      }
      if (!rule.selector.includes(".")) return;
      const tokensUsed = new Set<string>();
      const literals: string[] = [];
      for (const d of decls) {
        for (const m of String(d.value).matchAll(/var\(\s*(--[\w-]+)/g)) tokensUsed.add(m[1]!);
        for (const c of findColorLiterals(d.value, d.prop)) literals.push(c.text);
      }
      const source = `${file}:${rule.source?.start?.line ?? 0}`;
      componentClasses.push({
        selector: ctx,
        source,
        decls: decls.map((d) => ({ prop: d.prop, value: d.value })),
        tokens: [...tokensUsed].sort(),
        literals,
      });
      const single = rule.selector.trim().match(/^\.([\w-]+)$/);
      const fs = decls.find((d) => d.prop === "font-size");
      // Typography classes outside any at-rule (a cascade layer does not count: it does not change matching).
      const atRule = (rule.parent as AtRule)?.name;
      if (single && fs && decls.every((d) => TYPO_PROPS.has(d.prop)) && (!atRule || atRule === "layer")) {
        const px = toPx(fs.value);
        if (px != null) typographyClasses.push({ className: single[1]!, fontSizePx: px, source });
      }
    });
  }

  const tailwindConfig = tailwindMapping(project, cssRoots);
  return { project, tokens, componentClasses, typographyClasses, fontSizeUses, definedCustomProps, cssRoots, tailwindConfig };
}

/** Extracts usages from one file. */
export function extractFile(ctx: Context, abs: string): { usages: Usage[]; skipped?: Skipped } {
  const file = rel(ctx.project, abs);
  const ext = path.extname(abs);
  const code = readSource(abs);
  if (code == null) return { usages: [], skipped: { file, code: "FILE_TOO_LARGE", detail: "File is larger than 1 MB" } };
  try {
    if (ext === ".css") {
      return {
        usages: extractCss(file, code, {
          isTokenSource: ctx.tokens.sources.includes(file),
          themes: ctx.project.config.tokens.themes,
          parsed: ctx.cssRoots.get(file),
        }),
      };
    }
    return { usages: extractJsx(file, code, ext, CLASS_HELPERS) };
  } catch (e) {
    const err = e as Error & { loc?: { line: number } };
    return {
      usages: [],
      skipped: { file, code: "PARSE_ERROR", detail: `${err.message}${err.loc ? ` (line ${err.loc.line})` : ""}`.slice(0, 200) },
    };
  }
}
