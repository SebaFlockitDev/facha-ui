import fs from "node:fs";
import path from "node:path";
import picomatch from "picomatch";
import { ALWAYS_IGNORED_DIRS, CONFIG_FILE, DEFAULT_INCLUDE, loadConfig, type LoadedConfig } from "./config.js";
import { FachaError } from "./types.js";
import { readViteConfig } from "./vite-config.js";
import { readAppEntry, type AppEntry } from "./app-entry.js";

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
  frameworkDetected: Framework;
  /** The framework in use: the config's when it names one, otherwise the detected one. */
  framework: Framework;
  /** Vite only: whether vite.config registers facha-ui's live plugin (live mode needs it). */
  liveRegistered?: boolean;
  /** Vite only: the app entry read statically (global CSS, providers around <App />). */
  labEntry?: AppEntry | null;
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
  const frameworkDetected = detectFramework(root, deps);
  const framework: Framework = loaded.config.framework === "auto" ? frameworkDetected : loaded.config.framework;
  const assumptions = [...loaded.assumptions];
  let liveRegistered: boolean | undefined;
  let labEntry: AppEntry | null | undefined;
  // The lab's defaults follow the framework (SPEC §2.b.4): Vite serves facha-lab/ as its own
  // dev-only entry, on the dev server's port read statically from vite.config.
  if (framework === "vite-react") {
    const vite = readViteConfig({ root });
    liveRegistered = vite?.liveRegistered ?? false;
    labEntry = readAppEntry({ root });
    if (!loaded.explicit.labDir) loaded.config.lab.dir = "facha-lab";
    if (!loaded.explicit.baseUrl) loaded.config.preview.baseUrl = `http://localhost:${vite?.port ?? 5173}`;
    if (vite?.inputs?.length) {
      const lab = toPosix(loaded.config.lab.dir).replace(/\/+$/, "");
      const inLab = vite.inputs.some((i) => toPosix(i).replace(/^\.?\//, "").startsWith(`${lab}/`));
      assumptions.push(
        inLab
          ? `${vite.file} lists the lab (${lab}/) in build.rollupOptions.input: the lab would be built. Remove it from the inputs.`
          : `${vite.file} declares build entries (${vite.inputs.join(", ")}); the lab (${lab}/) is not one of them, so it stays out of the build.`,
      );
    }
    if (vite?.unread.length) assumptions.push(`Not read in ${vite.file} without running it: ${vite.unread.map((u) => `${u.what}${u.line ? ` (line ${u.line})` : ""}`).join("; ")}.`);
  }
  const labDir = toPosix(loaded.config.lab.dir).replace(/\/+$/, "");
  const workspacePath = ws ? toPosix(path.relative(ws.workspaceRoot, root)) || "." : ".";
  if (ws?.mode === "discovered") {
    assumptions.push(
      `Project discovered at ${workspacePath}/ (the only frontend found below the workspace). Set FACHA_UI_ROOT to choose another folder.`,
    );
  }
  if (loaded.config.framework === "auto") assumptions.push(frameworkAssumption(frameworkDetected, deps));
  return {
    ...loaded,
    assumptions,
    root,
    include: loaded.config.include ?? DEFAULT_INCLUDE,
    exclude: loaded.config.exclude ?? [],
    labDir,
    hasTailwind,
    frameworkDetected,
    framework,
    ...(liveRegistered !== undefined ? { liveRegistered } : {}),
    ...(labEntry !== undefined ? { labEntry } : {}),
    workspacePath,
  };
}

export type Framework = "next-app" | "vite-react" | "unknown";

/**
 * The framework of the lab, from package.json (SPEC §2.0.2): Next.js with an app/ directory, or
 * Vite with React. Anything else (Create React App, Next.js with pages/ only…) has no lab.
 */
function detectFramework(root: string, deps: Record<string, unknown>): Framework {
  if ("next" in deps && fs.existsSync(path.join(root, "app"))) return "next-app";
  if ("vite" in deps && "react" in deps) return "vite-react";
  return "unknown";
}

function frameworkAssumption(f: Framework, deps: Record<string, unknown>): string {
  if (f === "next-app") return "Framework autodetected: next-app (package.json depends on next and an app/ directory exists).";
  if (f === "vite-react") return "Framework autodetected: vite-react (package.json depends on vite and react). The lab is a dev-only entry in facha-lab/.";
  const why =
    "react-scripts" in deps
      ? "Create React App (react-scripts) has no lab: it is deprecated, and variants need Next.js (App Router) or Vite with React"
      : "next" in deps
        ? "Next.js without an app/ directory (Pages Router) has no lab yet: variants need the App Router"
        : "no lab framework detected: variants need Next.js (App Router) or Vite with React";
  return `${why}. Checks, audit, score, start, init and learn work all the same.`;
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

/** Whether a project-relative path is one audit_project scans: include − exclude − lab directory. */
export function auditMatcher(project: Project): (relPath: string) => boolean {
  const inc = picomatch(project.include, { dot: false });
  const exc = picomatch([...project.exclude, `${project.labDir}/**`], { dot: true });
  return (r) => inc(r) && !exc(r);
}

/** Files that audit_project scans: include − exclude − lab directory. */
export function listProjectFiles(project: Project): string[] {
  const audited = auditMatcher(project);
  return walk(project.root).filter((abs) => audited(rel(project, abs)));
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
