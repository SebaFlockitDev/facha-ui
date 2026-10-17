import fs from "node:fs";
import path from "node:path";
import picomatch from "picomatch";
import type { Context } from "./context.js";
import { listProjectFiles, type Project, readSource, rel } from "./project.js";

/**
 * Which files are the project's screens (B-043), for ux_score and review_ui. Read statically, never run.
 * - The config's `screens` globs, when present, decide alone.
 * - Next.js (App Router): every `page.[jt]sx`, with its route from the folders.
 * - Vite and others: the components the router mounts (`<Route element={<X />}>`, `{ element: <X /> }`,
 *   `Component: X`, `lazy(() => import("…"))`), with their path when it is written as an absolute
 *   one, plus the files of the conventional folders (src/pages, src/routes, src/views, src/screens).
 */

const NEXT_PAGE = /(^|\/)page\.[jt]sx$/;
const SCREEN_DIRS = /^src\/(pages|routes|views|screens)\/(.+\/)?[^/]+\.[jt]sx$/;
/** Not screens inside those folders: private files (`_layout`, `__root`), tests and stories. */
const NOT_A_SCREEN = /(^|\/)_[^/]*$|\.(test|spec|stories)\.[jt]sx$/;
const ROUTER = /<Route\b|create(Browser|Hash|Memory)Router\s*\(|\buseRoutes\s*\(/;
const EXTENSIONS = [".tsx", ".jsx", ".ts", ".js"];

export interface Screen {
  /** Project-relative POSIX path. */
  file: string;
  /** The URL path, when it is known; null when it is not written or is relative. */
  route: string | null;
}

const cache = new WeakMap<Project, Map<string, Screen>>();

/** The project's screens, by file (lab excluded, include/exclude respected). */
export function projectScreens(ctx: Context): Map<string, Screen> {
  const hit = cache.get(ctx.project);
  if (hit) return hit;
  const files = listProjectFiles(ctx.project);
  const out = new Map<string, Screen>();
  const add = (file: string, route: string | null) => {
    const prev = out.get(file);
    // The most specific route wins: /orders over /.
    if (!prev || (route !== null && (prev.route === null || (prev.route === "/" && route !== "/")))) out.set(file, { file, route });
  };
  const globs = ctx.project.config.screens;
  if (globs?.length) {
    const match = picomatch(globs, { dot: false });
    for (const abs of files) {
      const r = rel(ctx.project, abs);
      if (match(r)) add(r, NEXT_PAGE.test(r) ? nextRoute(r) : null);
    }
  } else {
    const next = ctx.project.framework === "next-app";
    for (const abs of files) {
      const r = rel(ctx.project, abs);
      if (NEXT_PAGE.test(r) && (next || ctx.project.framework === "unknown")) add(r, nextRoute(r));
    }
    if (!next) {
      for (const abs of files) {
        const r = rel(ctx.project, abs);
        if (!/\.[jt]sx?$/.test(r)) continue;
        const source = readSource(abs);
        if (source && ROUTER.test(source)) for (const s of routedScreens(ctx, abs, source)) add(s.file, s.route);
      }
      for (const abs of files) {
        const r = rel(ctx.project, abs);
        if (SCREEN_DIRS.test(r) && !NOT_A_SCREEN.test(r)) add(r, null);
      }
    }
  }
  cache.set(ctx.project, out);
  return out;
}

/** A screen, or a variant of one in the lab (`<lab.dir>/<slug>/<x>/page.tsx` or `Page.tsx`). */
export function isScreen(ctx: Context, relPath: string): boolean {
  return projectScreens(ctx).has(relPath) || isLabVariant(ctx, relPath);
}

function isLabVariant(ctx: Context, relPath: string): boolean {
  const prefix = ctx.project.labDir + "/";
  return relPath.startsWith(prefix) && /^[^/]+\/[a-z]\/[pP]age\.[jt]sx$/.test(relPath.slice(prefix.length));
}

export function routeOf(ctx: Context, relPath: string): string | null {
  return projectScreens(ctx).get(relPath)?.route ?? null;
}

/** app/(shop)/orders/[id]/page.tsx → /orders/[id]: route groups and parallel slots do not count. */
function nextRoute(relPath: string): string {
  const parts = relPath.split("/");
  const app = parts.lastIndexOf("app");
  const segs = parts.slice(app + 1, -1).filter((s) => !/^\(.*\)$/.test(s) && !s.startsWith("@"));
  return "/" + segs.join("/");
}

/** The files a router mounts, read from its JSX routes and its route objects. */
function routedScreens(ctx: Context, abs: string, source: string): Screen[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
  const imports = importMap(code);
  const found: Screen[] = [];
  const push = (target: string | undefined, route: string | null) => {
    if (!target) return;
    const file = resolveImport(ctx, abs, target);
    if (file) found.push({ file, route });
  };
  const byName = (name: string | undefined) => (name ? imports.get(name) : undefined);

  // <Route path="/orders" element={<Orders />} /> and <Route Component={Orders} />
  for (const m of code.matchAll(/<Route\b/g)) {
    const tag = tagText(code, m.index! + m[0].length);
    if (!tag.trimEnd().endsWith("/")) continue; // a layout route: it wraps other routes
    const route = absolute(tag.match(/\bpath=\s*(?:\{\s*)?["'`]([^"'`]*)["'`]/)?.[1]);
    const element = attrExpr(tag, "element");
    const name = element !== null ? mountedName(element) : tag.match(/\bComponent=\{\s*([A-Z][\w]*)\s*\}/)?.[1];
    push(byName(name), route);
  }
  // { path: "/orders", element: <Orders /> }, { Component: Orders }, { lazy: () => import("./x") }
  for (const m of code.matchAll(/\b(element|Component|lazy)\s*:/g)) {
    const own = objectAround(code, m.index!);
    if (own === null || /\bchildren\s*:/.test(own)) continue; // a layout route
    const route = absolute(own.match(/\bpath\s*:\s*["'`]([^"'`]*)["'`]/)?.[1]);
    const value = readExpr(code, m.index! + m[0].length);
    if (m[1] === "element") push(byName(mountedName(value)), route);
    else if (m[1] === "Component") push(byName(value.trim().match(/^([A-Z]\w*)/)?.[1]), route);
    else push(value.match(/import\(\s*["'`]([^"'`]+)["'`]\s*\)/)?.[1], route);
  }
  return found;
}

/** Local name → module specifier: default and named imports, and `const X = lazy(() => import("…"))`. */
function importMap(code: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of code.matchAll(/import\s+([\w$]+)?\s*,?\s*(?:\{([^}]*)\})?\s*from\s*["']([^"']+)["']/g)) {
    if (m[1]) map.set(m[1], m[3]!);
    for (const part of (m[2] ?? "").split(",")) {
      const local = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (local) map.set(local, m[3]!);
    }
  }
  for (const m of code.matchAll(/(?:const|let)\s+([\w$]+)\s*=\s*(?:React\.)?lazy\(\s*\(\)\s*=>\s*import\(\s*["']([^"']+)["']/g)) map.set(m[1]!, m[2]!);
  return map;
}

/** A relative or "@/" import, resolved to a project file (POSIX, relative to the root). */
function resolveImport(ctx: Context, fromAbs: string, spec: string): string | null {
  const root = ctx.project.root;
  const bases = spec.startsWith(".")
    ? [path.resolve(path.dirname(fromAbs), spec)]
    : spec.startsWith("@/")
      ? [path.join(root, "src", spec.slice(2)), path.join(root, spec.slice(2))]
      : [];
  for (const b of bases) {
    const hit = [b, ...EXTENSIONS.map((e) => b + e), ...EXTENSIONS.map((e) => path.join(b, "index" + e))].find(
      (p) => fs.existsSync(p) && fs.statSync(p).isFile(),
    );
    if (hit && !hit.includes(`${path.sep}node_modules${path.sep}`) && hit.startsWith(root)) return rel(ctx.project, hit);
  }
  return null;
}

/** The screen a JSX expression mounts: its self-closing component (the innermost), else the first one. */
function mountedName(expr: string): string | undefined {
  const self = [...expr.matchAll(/<([A-Z][\w]*)\b[^<>]*\/>/g)].pop()?.[1];
  return self ?? expr.match(/<([A-Z][\w]*)\b/)?.[1];
}

function absolute(route: string | undefined): string | null {
  return route !== undefined && route.startsWith("/") ? route : null;
}

/** The attributes of a JSX tag, from after its name to its closing `>` (braces balanced). */
function tagText(code: string, from: number): string {
  let depth = 0;
  for (let i = from; i < code.length; i++) {
    const c = code[i];
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0) return code.slice(from, i);
  }
  return code.slice(from);
}

/** The expression inside `name={…}` of a tag, or null. */
function attrExpr(tag: string, name: string): string | null {
  const m = new RegExp(`\\b${name}=\\{`).exec(tag);
  if (!m) return null;
  let depth = 1;
  for (let i = m.index + m[0].length; i < tag.length; i++) {
    if (tag[i] === "{") depth++;
    else if (tag[i] === "}" && --depth === 0) return tag.slice(m.index + m[0].length, i);
  }
  return tag.slice(m.index + m[0].length);
}

/** An object-literal value: up to the next `,` or closing bracket at its own depth. */
function readExpr(code: string, from: number): string {
  let depth = 0;
  for (let i = from; i < code.length; i++) {
    const c = code[i]!;
    if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) {
      if (depth === 0) return code.slice(from, i);
      depth--;
    } else if (c === "," && depth === 0) return code.slice(from, i);
  }
  return code.slice(from);
}

/** The object literal that holds position `at`, with its nested objects and arrays blanked out. */
function objectAround(code: string, at: number): string | null {
  let depth = 0;
  let start = -1;
  for (let i = at - 1; i >= 0; i--) {
    const c = code[i];
    if (c === "}" || c === "]" || c === ")") depth++;
    else if (c === "{" || c === "[" || c === "(") {
      if (depth === 0) {
        if (c !== "{") return null;
        start = i;
        break;
      }
      depth--;
    }
  }
  if (start < 0) return null;
  let out = "";
  depth = 0;
  for (let i = start + 1; i < code.length; i++) {
    const c = code[i]!;
    if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) {
      if (depth === 0) return out;
      depth--;
      continue;
    }
    if (depth === 0) out += c;
  }
  return out;
}
