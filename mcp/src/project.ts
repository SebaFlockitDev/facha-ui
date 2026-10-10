import fs from "node:fs";
import path from "node:path";
import picomatch from "picomatch";
import { ALWAYS_IGNORED_DIRS, CONFIG_FILE, DEFAULT_INCLUDE, loadConfig, type LoadedConfig } from "./config.js";
import { FachaError } from "./types.js";

export const MAX_FILE_BYTES = 1024 * 1024;
export const MAX_FILES = 5000;
export const SOURCE_EXTENSIONS = new Set([".tsx", ".jsx", ".ts", ".js", ".mjs", ".cjs", ".css"]);

export interface Project extends LoadedConfig {
  /** Absolute, real path of the project root. */
  root: string;
  include: string[];
  exclude: string[];
  labDir: string;
  hasTailwind: boolean;
  frameworkDetected: "next-app" | "unknown";
  /** Project root relative to the workspace (POSIX, "." when they are the same). */
  workspacePath: string;
}

export function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

/** Project-relative POSIX path for an absolute path inside the root. */
export function rel(project: { root: string }, abs: string): string {
  return toPosix(path.relative(project.root, abs));
}

export function isInside(root: string, candidate: string): boolean {
  const r = path.relative(root, candidate);
  return r === "" || (!r.startsWith("..") && !path.isAbsolute(r));
}

export interface Workspace {
  /** Directory Claude Code (or the MCP client) runs in: --root, CLAUDE_PROJECT_DIR or cwd. */
  workspaceRoot: string;
  /** The frontend project facha-ui works on. */
  root: string;
  /**
   * How the project was chosen: `explicit` (FACHA_UI_ROOT), `direct` (the workspace is the project),
   * `discovered` (one candidate below the workspace), `ambiguous` (several), `none` (no candidate).
   */
  mode: "explicit" | "direct" | "discovered" | "ambiguous" | "none";
  /** Workspace-relative POSIX paths of the candidates found (discovered / ambiguous). */
  candidates: string[];
}

const DISCOVERY_DEPTH = 2;

/** A project directory: it has a facha-ui config, or a package.json that depends on React. */
function projectTier(dir: string): 0 | 1 | 2 {
  if (fs.existsSync(path.join(dir, CONFIG_FILE))) return 2;
  const pkg = readPackageJson(dir);
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
  return "react" in deps || "next" in deps ? 1 : 0;
}

/** Project candidates up to DISCOVERY_DEPTH levels below `base`, best tier only, sorted. */
function discoverCandidates(base: string): string[] {
  const found: { dir: string; tier: number }[] = [];
  const visit = (dir: string, depth: number) => {
    if (depth > DISCOVERY_DEPTH) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (!e.isDirectory() || e.isSymbolicLink() || e.name.startsWith(".") || ALWAYS_IGNORED_DIRS.has(e.name)) continue;
      const abs = path.join(dir, e.name);
      const tier = projectTier(abs);
      if (tier > 0) found.push({ dir: abs, tier });
      else visit(abs, depth + 1);
    }
  };
  visit(base, 1);
  const best = Math.max(0, ...found.map((f) => f.tier));
  return found
    .filter((f) => f.tier === best)
    .map((f) => f.dir)
    .sort();
}

/**
 * Workspace and project resolution (SPEC §2.0.2, §7.4). The workspace is --root, else
 * CLAUDE_PROJECT_DIR, else cwd. The project is FACHA_UI_ROOT (relative to the workspace) when set;
 * otherwise the workspace itself when it is a project; otherwise the single project found up to two
 * levels below it. Several candidates leave the choice to the developer (MULTIPLE_PROJECTS on use).
 */
export function resolveWorkspace(opts: { argRoot?: string; env?: NodeJS.ProcessEnv; cwd?: string }): Workspace {
  const env = opts.env ?? process.env;
  const cwd = opts.cwd ?? process.cwd();
  const isUsable = (v?: string) => !!v && !v.includes("${");
  const base = isUsable(opts.argRoot)
    ? path.resolve(cwd, opts.argRoot!)
    : isUsable(env.CLAUDE_PROJECT_DIR)
      ? path.resolve(env.CLAUDE_PROJECT_DIR!)
      : cwd;
  const existingDir = (p: string) => {
    if (!fs.existsSync(p) || !fs.statSync(p).isDirectory()) {
      throw new FachaError("PROJECT_NOT_FOUND", `Project root does not exist or is not a directory: ${p}`);
    }
    return fs.realpathSync(p);
  };
  const workspaceRoot = existingDir(base);
  if (isUsable(env.FACHA_UI_ROOT)) {
    return { workspaceRoot, root: existingDir(path.resolve(base, env.FACHA_UI_ROOT!)), mode: "explicit", candidates: [] };
  }
  if (projectTier(workspaceRoot) > 0) return { workspaceRoot, root: workspaceRoot, mode: "direct", candidates: [] };
  const found = discoverCandidates(workspaceRoot);
  const candidates = found.map((d) => toPosix(path.relative(workspaceRoot, d)));
  if (found.length === 1) return { workspaceRoot, root: fs.realpathSync(found[0]!), mode: "discovered", candidates };
  return { workspaceRoot, root: workspaceRoot, mode: found.length > 1 ? "ambiguous" : "none", candidates };
}

/** Project root only (see resolveWorkspace). */
export function resolveRoot(opts: { argRoot?: string; env?: NodeJS.ProcessEnv; cwd?: string }): string {
  return resolveWorkspace(opts).root;
}

function readPackageJson(root: string): Record<string, any> | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  } catch {
    return null;
  }
}

export function openProject(root: string, ws?: Workspace): Project {
  const loaded = loadConfig(root);
  const pkg = readPackageJson(root);
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
  const hasTailwind = "tailwindcss" in deps || "@tailwindcss/postcss" in deps;
  const frameworkDetected = "next" in deps && fs.existsSync(path.join(root, "app")) ? "next-app" : "unknown";
  const labDir = toPosix(loaded.config.lab.dir).replace(/\/+$/, "");
  const assumptions = [...loaded.assumptions];
  const workspacePath = ws ? toPosix(path.relative(ws.workspaceRoot, root)) || "." : ".";
  if (ws?.mode === "discovered") {
    assumptions.push(
      `Project discovered at ${workspacePath}/ (the only frontend found below the workspace). Set FACHA_UI_ROOT to choose another folder.`,
    );
  }
  if (loaded.config.framework === "auto") {
    assumptions.push(
      frameworkDetected === "next-app"
        ? "Framework autodetected: next-app (package.json depends on next and an app/ directory exists)."
        : "Framework not detected as next-app; the lab route may not work.",
    );
  }
  return {
    ...loaded,
    assumptions,
    root,
    include: loaded.config.include ?? DEFAULT_INCLUDE,
    exclude: loaded.config.exclude ?? [],
    labDir,
    hasTailwind,
    frameworkDetected,
    workspacePath,
  };
}

/** Walks a directory (deterministic order), skipping always-ignored directories and symlinks. */
export function walk(dir: string, out: string[] = []): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const e of entries) {
    if (out.length >= MAX_FILES) break;
    const abs = path.join(dir, e.name);
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) {
      if (!ALWAYS_IGNORED_DIRS.has(e.name)) walk(abs, out);
    } else if (e.isFile() && SOURCE_EXTENSIONS.has(path.extname(e.name))) {
      out.push(abs);
    }
  }
  return out;
}

/** Files that audit_project scans: include − exclude − lab directory. */
export function listProjectFiles(project: Project): string[] {
  const inc = picomatch(project.include, { dot: false });
  const exc = picomatch([...project.exclude, `${project.labDir}/**`], { dot: true });
  return walk(project.root).filter((abs) => {
    const r = rel(project, abs);
    return inc(r) && !exc(r);
  });
}

export function isInLab(project: Project, relPath: string): boolean {
  return relPath === project.labDir || relPath.startsWith(project.labDir + "/");
}

/**
 * Resolves a user-supplied path. Relative paths are tried against the project root first and
 * then against its parent (so "frontend/app/x.tsx" works when the root is ".../frontend").
 * The real path must stay inside the project root.
 */
export function resolveUserPath(project: Project, input: string): { abs: string; isDir: boolean } {
  const cleaned = input.trim().replace(/^["']|["']$/g, "");
  const candidates = path.isAbsolute(cleaned)
    ? [cleaned]
    : [path.resolve(project.root, cleaned), path.resolve(path.dirname(project.root), cleaned)];
  for (const c of candidates) {
    if (!fs.existsSync(c)) continue;
    const real = fs.realpathSync(c);
    if (!isInside(project.root, real)) {
      throw new FachaError("PATH_OUTSIDE_PROJECT", `Path is outside the project root: ${input}`, { path: input });
    }
    return { abs: real, isDir: fs.statSync(real).isDirectory() };
  }
  // A non-existent path that points outside is still reported as outside.
  const first = candidates[0]!;
  if (!isInside(project.root, path.resolve(first))) {
    throw new FachaError("PATH_OUTSIDE_PROJECT", `Path is outside the project root: ${input}`, { path: input });
  }
  throw new FachaError("PATH_NOT_FOUND", `Path not found in the project: ${input}`, { path: input });
}

/**
 * Reads a file at a fixed name in the project root (components.json, tailwind.config.ts…) as text.
 * Null when it does not exist, is a symlink, resolves outside the root or is too large. Never loads it.
 */
export function readRootFile(project: { root: string }, name: string): string | null {
  const abs = path.join(project.root, name);
  try {
    if (!fs.existsSync(abs) || fs.lstatSync(abs).isSymbolicLink()) return null;
    if (!isInside(project.root, fs.realpathSync(abs)) || !fs.statSync(abs).isFile()) return null;
    return readSource(abs);
  } catch {
    return null;
  }
}

export function readSource(abs: string): string | null {
  const st = fs.statSync(abs);
  if (st.size > MAX_FILE_BYTES) return null;
  return fs.readFileSync(abs, "utf8");
}
