import fs from "node:fs";
import path from "node:path";
import picomatch from "picomatch";
import { ALWAYS_IGNORED_DIRS, DEFAULT_INCLUDE, loadConfig, type LoadedConfig } from "./config.js";
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

/**
 * Root resolution (SPEC §7.4): FACHA_UI_ROOT > --root > CLAUDE_PROJECT_DIR > cwd.
 * FACHA_UI_ROOT may be relative; it is resolved against the next base in the chain.
 */
export function resolveRoot(opts: {
  argRoot?: string;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}): string {
  const env = opts.env ?? process.env;
  const cwd = opts.cwd ?? process.cwd();
  const isUsable = (v?: string) => !!v && !v.includes("${");
  const base = isUsable(opts.argRoot)
    ? path.resolve(cwd, opts.argRoot!)
    : isUsable(env.CLAUDE_PROJECT_DIR)
      ? path.resolve(env.CLAUDE_PROJECT_DIR!)
      : cwd;
  const chosen = isUsable(env.FACHA_UI_ROOT) ? path.resolve(base, env.FACHA_UI_ROOT!) : base;
  if (!fs.existsSync(chosen) || !fs.statSync(chosen).isDirectory()) {
    throw new FachaError("PROJECT_NOT_FOUND", `Project root does not exist or is not a directory: ${chosen}`);
  }
  return fs.realpathSync(chosen);
}

function readPackageJson(root: string): Record<string, any> | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  } catch {
    return null;
  }
}

export function openProject(root: string): Project {
  const loaded = loadConfig(root);
  const pkg = readPackageJson(root);
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
  const hasTailwind = "tailwindcss" in deps || "@tailwindcss/postcss" in deps;
  const frameworkDetected = "next" in deps && fs.existsSync(path.join(root, "app")) ? "next-app" : "unknown";
  const labDir = toPosix(loaded.config.lab.dir).replace(/\/+$/, "");
  const assumptions = [...loaded.assumptions];
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

export function readSource(abs: string): string | null {
  const st = fs.statSync(abs);
  if (st.size > MAX_FILE_BYTES) return null;
  return fs.readFileSync(abs, "utf8");
}
