import path from "node:path";
import { extractFile, type Context } from "./context.js";
import { isInLab, listProjectFiles, rel, resolveUserPath, SOURCE_EXTENSIONS, walk } from "./project.js";
import { checkUsages } from "./rules.js";
import type { Usage } from "./sources/usage.js";
import { FachaError, type Severity, type Skipped, type Unresolved, type Violation } from "./types.js";

const SEV_ORDER: Severity[] = ["info", "warning", "error"];

export function atLeast(sev: Severity, min: Severity): boolean {
  return SEV_ORDER.indexOf(sev) >= SEV_ORDER.indexOf(min);
}

function byLocation<T extends { file: string; line: number; column: number; rule?: string }>(a: T, b: T): number {
  return (
    (a.file < b.file ? -1 : a.file > b.file ? 1 : 0) ||
    a.line - b.line ||
    a.column - b.column ||
    ((a.rule ?? "") < (b.rule ?? "") ? -1 : (a.rule ?? "") > (b.rule ?? "") ? 1 : 0)
  );
}

export interface ScanResult {
  files: string[];
  violations: Violation[];
  unresolved: Unresolved[];
  skipped: Skipped[];
  usages: Usage[];
}

export function scanFiles(ctx: Context, absFiles: string[]): ScanResult {
  const result: ScanResult = { files: [], violations: [], unresolved: [], skipped: [], usages: [] };
  for (const abs of absFiles) {
    result.files.push(rel(ctx.project, abs));
    const { usages, skipped } = extractFile(ctx, abs);
    if (skipped) result.skipped.push(skipped);
    const r = checkUsages(ctx, usages);
    result.violations.push(...r.violations);
    result.unresolved.push(...r.unresolved);
    result.usages.push(...usages);
  }
  result.violations.sort(byLocation);
  result.unresolved.sort(byLocation);
  return result;
}

function summarize(violations: Violation[]) {
  const s = { error: 0, warning: 0, info: 0 };
  for (const v of violations) s[v.severity]++;
  return s;
}

export function checkUi(ctx: Context, input: string, opts: { rules?: string[]; minSeverity?: Severity } = {}) {
  const { abs, isDir } = resolveUserPath(ctx.project, input);
  const relPath = rel(ctx.project, abs) || ".";
  let files: string[];
  if (isDir) {
    files = walk(abs);
  } else {
    if (!SOURCE_EXTENSIONS.has(path.extname(abs))) {
      throw new FachaError("UNSUPPORTED_FILE", `Unsupported file type: ${relPath} (supported: ${[...SOURCE_EXTENSIONS].join(", ")})`, { path: input });
    }
    files = [abs];
  }
  const notes: string[] = [];
  const auditable = new Set(listProjectFiles(ctx.project));
  const outsideAudit = files.filter((f) => !auditable.has(f)).length;
  if (outsideAudit > 0) {
    notes.push(
      isInLab(ctx.project, relPath)
        ? "Path is in the lab directory: validated explicitly (the lab is excluded from audit_project)."
        : `${outsideAudit} file(s) are outside include/exclude: validated because the path was requested explicitly.`,
    );
  }
  const scan = scanFiles(ctx, files);
  const min = opts.minSeverity ?? "info";
  const violations = scan.violations.filter((v) => atLeast(v.severity, min) && (!opts.rules || opts.rules.includes(v.rule)));
  return {
    path: relPath,
    configSource: ctx.project.configSource,
    summary: { ...summarize(violations), files: scan.files.length },
    violations,
    unresolved: scan.unresolved,
    skipped: scan.skipped,
    notes,
  };
}

export function auditProject(ctx: Context, opts: { minSeverity?: Severity; top?: number } = {}) {
  const files = listProjectFiles(ctx.project);
  const scan = scanFiles(ctx, files);
  const min = opts.minSeverity ?? "info";
  const violations = scan.violations.filter((v) => atLeast(v.severity, min));
  const totals = { ...summarize(violations), all: violations.length };
  const byRule: Record<string, Partial<Record<Severity, number>>> = {};
  const fileMap = new Map<string, { file: string; error: number; warning: number; info: number; byRule: Record<string, number> }>();
  for (const v of violations) {
    byRule[v.rule] ??= {};
    byRule[v.rule]![v.severity] = (byRule[v.rule]![v.severity] ?? 0) + 1;
    const f = fileMap.get(v.file) ?? { file: v.file, error: 0, warning: 0, info: 0, byRule: {} };
    f[v.severity]++;
    f.byRule[v.rule] = (f.byRule[v.rule] ?? 0) + 1;
    fileMap.set(v.file, f);
  }
  const sortedRules = Object.fromEntries(Object.keys(byRule).sort().map((k) => [k, byRule[k]!]));
  const byFile = [...fileMap.values()]
    .map((f) => ({ ...f, byRule: Object.fromEntries(Object.keys(f.byRule).sort().map((k) => [k, f.byRule[k]!])) }))
    .sort((a, b) => b.error - a.error || b.warning - a.warning || b.info - a.info || (a.file < b.file ? -1 : 1));
  const top = byFile
    .map((f) => ({ file: f.file, all: f.error + f.warning + f.info, error: f.error }))
    .sort((a, b) => b.all - a.all || (a.file < b.file ? -1 : 1))
    .slice(0, opts.top ?? 10);
  return {
    configSource: ctx.project.configSource,
    filesScanned: scan.files.length,
    filesWithViolations: byFile.length,
    totals,
    byRule: sortedRules,
    byFile,
    top,
    unresolved: scan.unresolved.length,
    ignored: 0,
    skipped: scan.skipped,
    scan,
  };
}
