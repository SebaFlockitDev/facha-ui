import fs from "node:fs";
import path from "node:path";
import { contrast, round, toHex } from "./color.js";
import type { Context } from "./context.js";
import { toPx } from "./context.js";
import { listProjectFiles } from "./project.js";
import { RULES, effectiveSeverity } from "./rules.js";
import { scanFiles } from "./check.js";
import type { Usage } from "./sources/usage.js";
import { suggestColor } from "./suggest.js";
import { tokenColor, tokenValue } from "./tokens.js";

export const SECTIONS = [
  "project", "tokens", "scales", "componentClasses", "coverage", "gaps", "health", "rules", "guidelines", "decisions",
] as const;
export type Section = (typeof SECTIONS)[number];

const REQUIRED_ROLES = ["surface.base", "surface.raised", "text.primary", "text.secondary", "border.default", "accent.primary"];
const RECOMMENDED = [
  "on-accent", "status.success", "status.warning", "status.danger", "status.info",
  "typography.family", "typography.scale", "radius.scale", "shadow", "spacing.scale",
];

export function coverage(ctx: Context) {
  const roles = new Set(ctx.tokens.tokens.map((t) => t.role));
  const count = (role: string) => ctx.tokens.tokens.filter((t) => t.role === role).length;
  const has = (k: string): boolean => {
    switch (k) {
      case "typography.family": return roles.has("font");
      case "typography.scale": return count("font-size") >= 4;
      case "radius.scale": return count("radius") >= 2;
      case "shadow": return roles.has("shadow");
      case "spacing.scale": return ctx.project.hasTailwind || count("spacing") >= 4;
      default: return roles.has(k);
    }
  };
  const all = [...REQUIRED_ROLES, ...RECOMMENDED];
  const present = all.filter(has);
  const missing = all.filter((k) => !has(k));
  const requiredMissing = REQUIRED_ROLES.filter((k) => !has(k));
  const status = ctx.tokens.tokens.length === 0 ? "missing" : missing.length === 0 ? "ok" : "partial";
  return { status, present, missing, requiredMissing };
}

/** Color usages of each token in the `color` property, across the project. */
function colorUsageCounts(usages: Usage[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const u of usages) {
    if (u.kind !== "decl" || u.property !== "color") continue;
    const m = u.value.trim().match(/^var\(\s*(--[\w-]+)\s*\)$/);
    if (m) counts.set(m[1]!, (counts.get(m[1]!) ?? 0) + 1);
  }
  return counts;
}

/**
 * Token-level contrast health (MVP: per token, not per usage). Text-role tokens and tokens used
 * in `color` are measured against every surface token, in every theme.
 */
export function health(ctx: Context, usages: Usage[]) {
  const minRatio = ctx.project.config.contrast?.minRatio ?? 4.5;
  const themes = ctx.tokens.themes.map((t) => t.name);
  const surfaces = ctx.project.config.contrast?.surfaces ?? ctx.tokens.tokens.filter((t) => t.role.startsWith("surface.")).map((t) => t.name);
  const usage = colorUsageCounts(usages);
  const candidates = ctx.tokens.tokens.filter(
    (t) => t.type === "color" && (t.role.startsWith("text.") || t.role === "on-accent" || usage.has(t.name)),
  );
  const out: any[] = [];
  for (const t of candidates) {
    if (t.role === "on-accent") continue; // measured against accents, not surfaces (roadmap)
    const ratios: Record<string, number> = {};
    const against: Record<string, string> = {};
    for (const th of themes) {
      const fg = tokenColor(ctx.tokens, t.name, th);
      if (!fg) continue;
      let worst = Number.POSITIVE_INFINITY;
      let worstName = "";
      for (const s of surfaces) {
        const bg = tokenColor(ctx.tokens, s, th);
        if (!bg) continue;
        const base = tokenColor(ctx.tokens, surfaces[0]!, th);
        const r = contrast(fg, bg, base);
        if (r < worst) {
          worst = r;
          worstName = s;
        }
      }
      if (Number.isFinite(worst)) {
        ratios[th] = worst;
        against[th] = worstName;
      }
    }
    const breaksIn = themes.filter((th) => ratios[th] !== undefined && ratios[th]! < minRatio);
    if (breaksIn.length === 0) continue;
    out.push({
      kind: "token-contrast",
      token: t.name,
      role: t.role,
      status: breaksIn.length === themes.length ? "fails-everywhere" : breaksIn.includes(themes[0]!) ? "fails-in-default-theme" : "breaks-in-theme",
      breaksIn,
      ratios,
      against,
      minRatio,
      values: Object.fromEntries(themes.map((th) => [th, toHex(tokenColor(ctx.tokens, t.name, th)!)])),
      usagesAsTextColor: usage.get(t.name) ?? 0,
    });
  }
  // Color tokens of the default theme that another theme does not redefine.
  const invariant = new Set(ctx.project.config.tokens.invariant ?? []);
  for (const t of ctx.tokens.tokens) {
    if (t.type !== "color" || invariant.has(t.name) || themes.length < 2) continue;
    const defaultRaw = t.values[themes[0]!];
    const notRedefined = themes.slice(1).filter((th) => !declaredIn(ctx, t.name, th) && t.values[th] === defaultRaw);
    if (notRedefined.length > 0) out.push({ kind: "theme-missing", token: t.name, themes: notRedefined });
  }
  return out.sort((a, b) => (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : a.token < b.token ? -1 : 1));
}

function declaredIn(ctx: Context, token: string, theme: string): boolean {
  const sel = ctx.tokens.themes.find((t) => t.name === theme)?.selector;
  if (!sel) return false;
  for (const root of ctx.tokens.parsed.values()) {
    let found = false;
    root.walkDecls(token, (d) => {
      const p: any = d.parent;
      if (p?.selector && p.selector.replace(/\s+/g, " ").trim() === sel) found = true;
      if (p?.type === "atrule" && sel.startsWith("@")) found = true;
    });
    if (found) return true;
  }
  return false;
}

function scales(ctx: Context) {
  const theme = ctx.tokens.themes[0]?.name ?? "light";
  const fmt = (px: number) => `${round(px, 2)}px`;
  const fontTokens = ctx.tokens.tokens.filter((t) => t.role === "font-size");
  const fontValues = new Set<number>([...ctx.fontSizeUses.keys()]);
  for (const t of fontTokens) {
    const px = toPx(tokenValue(ctx.tokens, t.name, theme) ?? "");
    if (px != null) fontValues.add(px);
  }
  const classes: Record<string, string[]> = {};
  for (const c of [...ctx.typographyClasses].sort((a, b) => a.fontSizePx - b.fontSizePx)) {
    (classes[fmt(c.fontSizePx)] ??= []).push(`.${c.className}`);
  }
  const radiusTokens = ctx.tokens.tokens.filter((t) => t.role === "radius");
  const radiusValues = new Map<number, string>();
  for (const cc of ctx.componentClasses) {
    for (const d of cc.decls) {
      if (!/radius/.test(d.prop)) continue;
      const px = toPx(d.value);
      if (px != null && !radiusValues.has(px)) radiusValues.set(px, fmt(px));
    }
  }
  for (const t of radiusTokens) {
    const px = toPx(tokenValue(ctx.tokens, t.name, theme) ?? "");
    if (px != null) radiusValues.set(px, `${fmt(px)} (${t.name})`);
  }
  const src = (tokens: number, inferred: number) =>
    tokens && inferred ? "tokens+inferred" : tokens ? "tokens" : inferred ? "inferred" : "none";
  return {
    fontSize: {
      source: src(fontTokens.length, ctx.fontSizeUses.size),
      values: [...fontValues].sort((a, b) => a - b).map(fmt),
      classes,
    },
    radius: {
      source: src(radiusTokens.length, radiusValues.size - radiusTokens.length),
      values: [...radiusValues.entries()].sort(([a], [b]) => a - b).map(([, v]) => v),
    },
    spacing: { source: ctx.project.hasTailwind ? "tailwind-default" : "none" },
  };
}

function gaps(ctx: Context) {
  const out: { kind: string; where: string; values: string[]; note: string }[] = [];
  for (const cc of ctx.componentClasses) {
    const missing: string[] = [];
    const notes = new Set<string>();
    for (const d of cc.decls) {
      for (const lit of cc.literals) {
        if (!d.value.includes(lit)) continue;
        const s = suggestColor(ctx, lit, d.prop);
        if (s.match === "none" && !missing.includes(lit)) {
          missing.push(lit);
          notes.add(s.detail);
        }
      }
    }
    if (missing.length > 0) {
      out.push({ kind: "literal-without-token", where: `${cc.source} (${cc.selector})`, values: missing, note: [...notes].join(" ") });
    }
  }
  return out;
}

export function parseDecisions(ctx: Context) {
  const file = ctx.project.config.memory.decisionsFile;
  const abs = path.join(ctx.project.root, file);
  if (!fs.existsSync(abs)) return [];
  const lines = fs.readFileSync(abs, "utf8").split(/\r?\n/);
  const out: { id: string; title: string; date: string | null; source: string }[] = [];
  lines.forEach((line, i) => {
    const m = line.match(/^##\s+(dec-[\w-]+)\s*[·\-—]\s*(.+)$/);
    if (!m) return;
    let date: string | null = null;
    for (let j = i + 1; j < Math.min(lines.length, i + 8); j++) {
      const d = lines[j]!.match(/\*\*(?:Fecha|Date):\*\*\s*(\S+)/);
      if (d) {
        date = d[1]!;
        break;
      }
    }
    out.push({ id: m[1]!, title: m[2]!.trim().slice(0, 200), date, source: `${file}:${i + 1}` });
  });
  return out;
}

export function rulesInfo(ctx: Context) {
  return RULES.map((r) => ({ id: r.id, severity: effectiveSeverity(ctx, r.id, r.severity), summary: r.summary }));
}

export function labUrlPattern(labDir: string): string {
  const route = labDir.replace(/^(src\/)?app\/?/, "").split("/").filter((s) => s && !/^\(.*\)$/.test(s)).join("/");
  return `/${route}/{screen}/{variant}`.replace(/\/+/g, "/");
}

export function getDesignSystem(ctx: Context, sections: readonly Section[] = SECTIONS) {
  const want = new Set(sections);
  const cov = coverage(ctx);
  const out: Record<string, unknown> = { status: cov.status, configSource: ctx.project.configSource };
  if (ctx.project.assumptions.length) out.assumptions = ctx.project.assumptions;
  if (want.has("project")) {
    const pkgDeps = readDeps(ctx.project.root);
    const twVersion = (pkgDeps.tailwindcss ?? "").match(/\d+/)?.[0] ?? null;
    out.project = {
      root: path.basename(ctx.project.root),
      framework: ctx.project.config.framework === "auto" ? ctx.project.frameworkDetected : ctx.project.config.framework,
      tailwind: {
        detected: ctx.project.hasTailwind,
        version: twVersion,
        themeMapped: [...ctx.tokens.parsed.values()].some((r) => {
          let found = false;
          r.walkAtRules("theme", () => { found = true; });
          return found;
        }),
      },
      tokenSources: ctx.tokens.sources,
      themes: ctx.tokens.themes,
      lab: { dir: ctx.project.labDir, urlPattern: labUrlPattern(ctx.project.labDir) },
      preview: ctx.project.config.preview,
      decisionsFile: ctx.project.config.memory.decisionsFile,
    };
  }
  if (want.has("tokens")) out.tokens = ctx.tokens.tokens;
  if (want.has("scales")) out.scales = scales(ctx);
  if (want.has("componentClasses")) out.componentClasses = ctx.componentClasses.map(({ decls, ...c }) => c);
  if (want.has("coverage")) out.coverage = { present: cov.present, missing: cov.missing, requiredMissing: cov.requiredMissing };
  if (want.has("gaps")) out.gaps = gaps(ctx);
  if (want.has("health")) {
    const scan = scanFiles(ctx, listProjectFiles(ctx.project));
    out.health = health(ctx, scan.usages);
  }
  if (want.has("rules")) out.rules = rulesInfo(ctx);
  if (want.has("guidelines")) out.guidelines = ctx.project.config.guidelines.map((text, i) => ({ id: `g${i + 1}`, text }));
  if (want.has("decisions")) out.decisions = parseDecisions(ctx);
  return out;
}

function readDeps(root: string): Record<string, string> {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    return { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  } catch {
    return {};
  }
}
