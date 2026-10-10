import fs from "node:fs";
import path from "node:path";
import postcss, { type AtRule, type ChildNode, type Declaration, type Root, type Rule } from "postcss";
import picomatch from "picomatch";
import { isColorValue, parseColor } from "./color.js";
import { listProjectFiles, readSource, rel, type Project } from "./project.js";
import { colorEvidence, hslFromChannels, isHslChannels, isShadcnName, shadcnRole } from "./shadcn.js";
import type { Theme, Token, TokenType } from "./types.js";

export interface TokenSet {
  sources: string[];
  themes: Theme[];
  tokens: Token[];
  byName: Map<string, Token>;
  /** Custom properties declared outside theme blocks (component-local), by name. */
  localCustomProps: Set<string>;
  /** Parsed CSS of every token source, keyed by project-relative path. */
  parsed: Map<string, Root>;
}

const DEFAULT_SELECTORS = new Set([":root", "html", "@theme"]);

function norm(sel: string): string {
  return sel.replace(/\s+/g, " ").replace(/'/g, '"').trim();
}

/**
 * Context string of a rule: enclosing at-rules + selector, e.g. "@media (prefers-color-scheme: dark) :root".
 * Cascade layers are left out: `@layer base { :root {…} }` matches the same elements as `:root {…}`,
 * so a layer never decides a theme or a component class (shadcn/ui and Tailwind 3 declare tokens there).
 */
export function selectorContext(node: Rule | AtRule): string {
  const parts: string[] = [];
  let cur: ChildNode | Root | undefined = node as any;
  while (cur && cur.type !== "root") {
    if (cur.type === "rule") parts.unshift((cur as Rule).selector);
    else if (cur.type === "atrule") {
      const a = cur as AtRule;
      if (a.name !== "layer") parts.unshift(a.name === "theme" ? "@theme" : `@${a.name} ${a.params}`.trim());
    }
    cur = (cur as any).parent;
  }
  return norm(parts.join(" "));
}

/**
 * Returns the theme name a block defines, or null if it is not a theme block.
 * With configured themes only exact selector matches count.
 */
export function themeForSelector(ctx: string, configured?: Record<string, string>): string | null {
  if (configured && Object.keys(configured).length > 0) {
    for (const [name, sel] of Object.entries(configured)) if (norm(sel) === ctx) return name;
    return null;
  }
  const prefersDark = /@media[^]*prefers-color-scheme:\s*dark/.test(ctx);
  const sel = ctx.replace(/@media\s*\([^)]*\)\s*/g, "").trim();
  const parts = sel.split(",").map((s) => s.trim());
  for (const p of parts) {
    if (DEFAULT_SELECTORS.has(p)) return prefersDark ? "dark" : "default";
    const dataTheme = p.match(/^(?::root|html)?\[data-theme=["']?([\w-]+)["']?\]$/);
    if (dataTheme) return dataTheme[1]!;
    if (/^(?::root|html)?\.dark$/.test(p)) return "dark";
    if (/^(?::root|html)?\.light$/.test(p)) return "default";
  }
  return null;
}

function inferType(name: string, value: string): TokenType {
  const v = value.trim();
  if (/gradient\(/.test(v)) return "gradient";
  if (isColorValue(v)) return "color";
  if (/font|family/.test(name) || /["']|,\s*(sans-serif|serif|monospace)\b/.test(v)) return "font";
  if (/(^|\s)-?[\d.]+px\s+-?[\d.]+px/.test(v) && /(rgba?|hsla?|#)/.test(v)) return "shadow";
  if (/^-?[\d.]+(px|rem|em|%|vh|vw|ch)?$/.test(v)) return "length";
  return "other";
}

/** Role inference by name (SPEC §2.0.2 footnote 3). */
export function inferRole(name: string, type: TokenType): string {
  if (type === "shadow") return "shadow";
  if (type === "font") return "font";
  if (type === "gradient") return "gradient";
  const n = name.replace(/^--/, "").replace(/^color-/, "").toLowerCase();
  if (type === "length") {
    if (/radius|rounded/.test(n)) return "radius";
    if (/^(text|font-size|fs)(-|$)/.test(n)) return "font-size";
    if (/space|spacing|gap/.test(n)) return "spacing";
    return "generic";
  }
  if (type !== "color") return "generic";
  if (/(^|-)on-/.test(n)) return "on-accent";
  if (/success|positive/.test(n)) return "status.success";
  if (/warning|caution/.test(n)) return "status.warning";
  if (/danger|error|negative/.test(n)) return "status.danger";
  if (/(^|-)info(-|$)/.test(n)) return "status.info";
  if (/status|state/.test(n)) return "status.other";
  if (/border|outline|divider|stroke/.test(n)) return "border.default";
  if (/(^|-)(text|fg|foreground)(-|$)/.test(n)) {
    return /soft|muted|secondary|subtle|faint/.test(n) ? "text.secondary" : "text.primary";
  }
  if (/(^|-)(bg|background|canvas)(-|$)/.test(n)) return "surface.base";
  if (/panel|card|raised|elevated/.test(n)) return "surface.raised";
  if (/surface/.test(n)) return "surface.base";
  if (/^(brand|primary|accent)$/.test(n)) return "accent.primary";
  if (/brand|primary|accent/.test(n)) return "accent";
  return "generic";
}

function trailingComment(decl: Declaration): string | null {
  const next = decl.next();
  if (next && next.type === "comment" && next.source?.start?.line === decl.source?.start?.line) {
    return next.text.trim() || null;
  }
  return null;
}

/** Candidate token source files when the config does not name them. */
function autodetectSources(project: Project): string[] {
  const priority = ["app/globals.css", "src/index.css", "src/app/globals.css", "styles/globals.css"];
  const cssFiles = listProjectFiles(project)
    .filter((f) => f.endsWith(".css"))
    .map((f) => rel(project, f));
  const withTokens = cssFiles.filter((r) => {
    const text = readSource(path.join(project.root, r)) ?? "";
    return /(:root|@theme)[^{]*\{[^}]*--[\w-]+\s*:/.test(text);
  });
  return withTokens.sort((a, b) => {
    const pa = priority.indexOf(a);
    const pb = priority.indexOf(b);
    return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb) || (a < b ? -1 : 1);
  });
}

function resolveSources(project: Project): string[] {
  const globs = project.config.tokens.sources;
  if (!globs) return autodetectSources(project);
  const isMatch = picomatch(globs);
  const all: string[] = [];
  for (const g of globs) if (!/[*?{[]/.test(g) && fs.existsSync(path.join(project.root, g))) all.push(g);
  const walked = listProjectFiles({ ...project, include: ["**/*.css"], exclude: [] })
    .map((f) => rel(project, f))
    .filter((r) => isMatch(r));
  return [...new Set([...all, ...walked])].sort();
}

export function loadTokens(project: Project): TokenSet {
  const sources = resolveSources(project);
  const configuredThemes = project.config.tokens.themes;
  const themeOrder: string[] = [];
  const themeSelectors = new Map<string, string>();
  const raw = new Map<string, { values: Map<string, string>; comment: string | null; source: string }>();
  const localCustomProps = new Set<string>();
  const parsed = new Map<string, Root>();

  if (configuredThemes) {
    for (const [name, sel] of Object.entries(configuredThemes)) {
      themeOrder.push(name);
      themeSelectors.set(name, sel);
    }
  }

  for (const source of sources) {
    const text = readSource(path.join(project.root, source));
    if (text == null) continue;
    let root: Root;
    try {
      root = postcss.parse(text, { from: source });
    } catch {
      continue;
    }
    parsed.set(source, root);
    root.walkDecls((decl) => {
      if (!decl.prop.startsWith("--")) return;
      const parent = decl.parent as Rule | AtRule | undefined;
      if (!parent || (parent.type !== "rule" && parent.type !== "atrule")) return;
      const ctx = selectorContext(parent);
      let theme = themeForSelector(ctx, configuredThemes);
      if (theme === null) {
        localCustomProps.add(decl.prop);
        return;
      }
      if (!configuredThemes) {
        if (theme === "default") theme = "light";
        if (!themeOrder.includes(theme)) {
          if (theme === "light") themeOrder.unshift(theme);
          else themeOrder.push(theme);
          themeSelectors.set(theme, ctx);
        }
      }
      const entry = raw.get(decl.prop) ?? {
        values: new Map<string, string>(),
        comment: null,
        source: `${source}:${decl.source?.start?.line ?? 0}`,
      };
      if (!entry.values.has(theme)) entry.values.set(theme, decl.value.trim());
      if (theme === themeOrder[0]) {
        entry.comment = entry.comment ?? trailingComment(decl);
        entry.source = `${source}:${decl.source?.start?.line ?? 0}`;
      }
      raw.set(decl.prop, entry);
    });
  }

  if (themeOrder.length === 0 && raw.size > 0) themeOrder.push("light");
  const themes: Theme[] = themeOrder.map((name, i) => ({
    name,
    selector: themeSelectors.get(name) ?? ":root",
    default: i === 0,
  }));
  const defaultTheme = themeOrder[0];

  // Values per theme: inherit the default theme when a theme does not override a token.
  const valueIn = (name: string, theme: string): string | undefined => {
    const e = raw.get(name);
    if (!e) return undefined;
    return e.values.get(theme) ?? (defaultTheme ? e.values.get(defaultTheme) : undefined) ?? [...e.values.values()][0];
  };

  // Colors written as bare channels count as colors only with the project's own evidence (SPEC §2.0.2).
  const evidence = colorEvidence(project, raw.keys());
  const channelColors: string[] = [];

  const tokens: Token[] = [...raw.keys()].sort().map((name) => {
    const e = raw.get(name)!;
    const values: Record<string, string> = {};
    for (const t of themeOrder) {
      const v = valueIn(name, t);
      if (v !== undefined) values[t] = v;
    }
    const resolvedDefault = resolveVars(values[defaultTheme ?? ""] ?? "", defaultTheme ?? "", valueIn);
    let type = inferType(name, resolvedDefault);
    let format: Token["format"];
    if (type === "other" && isHslChannels(resolvedDefault) && (evidence.hslConsumed.has(name) || (evidence.shadcn && isShadcnName(name)))) {
      type = "color";
      format = "hsl-channels";
      channelColors.push(name);
    }
    const role =
      project.config.tokens.roles?.[name] ?? (evidence.shadcn && type === "color" ? shadcnRole(name) : undefined) ?? inferRole(name, type);
    return { name, type, role, ...(format ? { format } : {}), values, comment: e.comment, source: e.source };
  });

  if (evidence.shadcn) {
    project.assumptions.push(`shadcn/ui project (${evidence.shadcnReason}): its canonical tokens take the shadcn roles (SPEC §2.0.2); tokens.roles in the config overrides them.`);
  }
  if (channelColors.length) {
    project.assumptions.push(
      `${channelColors.length} token(s) written as bare HSL channels read as colors (hsl(var(--x)) in the project${evidence.shadcn ? " or the shadcn/ui names" : ""}): ${channelColors.slice(0, 8).join(", ")}${channelColors.length > 8 ? "…" : ""}.`,
    );
  }

  return {
    sources,
    themes,
    tokens,
    byName: new Map(tokens.map((t) => [t.name, t])),
    localCustomProps,
    parsed,
  };
}

/** Substitutes var(--x, fallback) recursively with the value of --x in the given theme. */
export function resolveVars(
  value: string,
  theme: string,
  lookup: (name: string, theme: string) => string | undefined,
  depth = 0,
): string {
  if (depth > 10 || !value.includes("var(")) return value;
  const out = value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g, (_m, name: string, fallback?: string) => {
    const v = lookup(name, theme);
    return v !== undefined ? v : (fallback ?? "").trim();
  });
  return resolveVars(out, theme, lookup, depth + 1);
}

/** Resolved value of a token in a theme (var() references substituted). */
export function tokenValue(ts: TokenSet, name: string, theme: string): string | undefined {
  const lookup = (n: string, t: string) => ts.byName.get(n)?.values[t];
  const v = lookup(name, theme);
  return v === undefined ? undefined : resolveVars(v, theme, lookup);
}

/** A token's color in a theme. Bare HSL channels of a color token are read as hsl(…). */
export function tokenColor(ts: TokenSet, name: string, theme: string) {
  const v = tokenValue(ts, name, theme);
  if (v === undefined) return undefined;
  if (ts.byName.get(name)?.type === "color" && isHslChannels(v)) return parseColor(hslFromChannels(v));
  return parseColor(v);
}
