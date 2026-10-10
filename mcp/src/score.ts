import fs from "node:fs";
import path from "node:path";
import { scanFiles } from "./check.js";
import type { Context } from "./context.js";
import { isInLab, listProjectFiles, readSource, rel, resolveUserPath, walk } from "./project.js";
import { reviewUi } from "./review.js";
import type { Severity, Violation } from "./types.js";

/**
 * UX score per screen, 0–100, from the deterministic signals facha-ui already measures: the
 * guardian's rules (by category) and review_ui's hierarchy and state signals. A screen counts its
 * own file plus the project components it imports (its shell included). Same input, same score:
 * it can gate CI against a baseline (`facha-ui-mcp score --baseline …`).
 */

export const CATEGORIES = ["consistency", "accessibility", "responsive", "copy", "hierarchy"] as const;
export type Category = (typeof CATEGORIES)[number];

const WEIGHTS: Record<Category, number> = { consistency: 0.25, accessibility: 0.25, responsive: 0.15, copy: 0.15, hierarchy: 0.2 };
const PENALTY: Record<Severity, number> = { error: 15, warning: 6, info: 2 };
const SCREEN = /(^|\/)page\.[jt]sx$/;
const EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"];

export function categoryOf(rule: string): Category {
  if (rule.startsWith("a11y-") || /contrast$/.test(rule)) return "accessibility";
  if (rule.startsWith("responsive-")) return "responsive";
  if (rule.startsWith("copy-")) return "copy";
  return "consistency";
}

/** Project files a screen imports (relative and "@/" imports), up to two levels deep. */
function importsOf(ctx: Context, abs: string, depth = 2, seen = new Set<string>()): Set<string> {
  seen.add(abs);
  if (depth === 0) return seen;
  const source = readSource(abs) ?? "";
  for (const m of source.matchAll(/(?:from\s+|import\s*\(\s*)["']([^"']+)["']/g)) {
    const spec = m[1]!;
    const bases = spec.startsWith(".")
      ? [path.resolve(path.dirname(abs), spec)]
      : spec.startsWith("@/")
        ? [path.join(ctx.project.root, spec.slice(2)), path.join(ctx.project.root, "src", spec.slice(2))]
        : [];
    for (const b of bases) {
      const hit = [b, ...EXTENSIONS.map((e) => b + e), ...EXTENSIONS.map((e) => path.join(b, "index" + e))].find(
        (p) => fs.existsSync(p) && fs.statSync(p).isFile() && !p.includes(`${path.sep}node_modules${path.sep}`),
      );
      if (hit && !seen.has(hit) && hit.startsWith(ctx.project.root)) importsOf(ctx, hit, depth - 1, seen);
    }
  }
  return seen;
}

interface Finding {
  category: Category;
  severity: Severity;
  rule: string;
  file: string;
  line: number;
  message: string;
}

export function scoreOf(findings: Finding[]) {
  const categories = Object.fromEntries(
    CATEGORIES.map((c) => {
      const mine = findings.filter((f) => f.category === c);
      const count = { error: 0, warning: 0, info: 0 };
      for (const f of mine) count[f.severity]++;
      const penalty = mine.reduce((s, f) => s + PENALTY[f.severity], 0);
      return [c, { score: Math.max(0, 100 - penalty), ...count }];
    }),
  ) as Record<Category, { score: number; error: number; warning: number; info: number }>;
  const score = Math.round(CATEGORIES.reduce((s, c) => s + categories[c].score * WEIGHTS[c], 0));
  return { score, categories };
}

export function uxScore(ctx: Context, input?: string) {
  let screens: string[];
  if (input) {
    const { abs, isDir } = resolveUserPath(ctx.project, input);
    screens = (isDir ? walk(abs) : [abs]).filter((f) => SCREEN.test(rel(ctx.project, f)));
  } else {
    screens = listProjectFiles(ctx.project).filter((f) => SCREEN.test(rel(ctx.project, f)) && !isInLab(ctx.project, rel(ctx.project, f)));
  }

  const violationsByFile = new Map<string, Violation[]>();
  const violationsOf = (abs: string) => {
    if (!violationsByFile.has(abs)) violationsByFile.set(abs, scanFiles(ctx, [abs]).violations);
    return violationsByFile.get(abs)!;
  };

  const results = screens.sort().map((abs) => {
    const screen = rel(ctx.project, abs);
    const files = [...importsOf(ctx, abs)];
    const findings: Finding[] = [];
    for (const f of files) {
      for (const v of violationsOf(f)) {
        findings.push({ category: categoryOf(v.rule), severity: v.severity, rule: v.rule, file: v.file, line: v.line, message: v.message });
      }
    }
    for (const r of reviewUi(ctx, screen).findings) {
      findings.push({ category: "hierarchy", severity: r.severity, rule: `review/${r.heuristic}`, file: r.file, line: r.line, message: r.why });
    }
    const { score, categories } = scoreOf(findings);
    const worst = [...findings]
      .sort((a, b) => PENALTY[b.severity] - PENALTY[a.severity] || (a.file < b.file ? -1 : 1) || a.line - b.line)
      .slice(0, 5)
      .map((f) => ({ rule: f.rule, severity: f.severity, at: `${f.file}:${f.line}`, message: f.message }));
    return { screen, score, categories, files: files.map((f) => rel(ctx.project, f)).sort(), worst };
  });

  const average = results.length ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length) : null;
  return {
    configSource: ctx.project.configSource,
    average,
    screens: results,
    method: {
      weights: WEIGHTS,
      penalty: PENALTY,
      note: "Each category starts at 100 and loses 15 per error, 6 per warning and 2 per info found in the screen, its imported components and review_ui. Deterministic: use it to compare a screen with itself over time, not as an absolute grade.",
    },
  };
}

export interface Regression {
  screen: string;
  before: number;
  after: number;
}

/** Screens whose score went down against a baseline produced by the same command. */
export function regressions(current: ReturnType<typeof uxScore>, baseline: { screens?: { screen: string; score: number }[] }): Regression[] {
  const before = new Map((baseline.screens ?? []).map((s) => [s.screen, s.score]));
  return current.screens
    .filter((s) => before.has(s.screen) && s.score < before.get(s.screen)!)
    .map((s) => ({ screen: s.screen, before: before.get(s.screen)!, after: s.score }));
}
