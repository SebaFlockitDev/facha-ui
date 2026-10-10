import path from "node:path";
import { parse } from "@babel/parser";
import { isInside, readRootFile, toPosix, type Project } from "./project.js";
import { TAILWIND_CONFIG_NAMES } from "./shadcn.js";

/**
 * Tailwind 3 theme mapping, read statically from tailwind.config (SPEC §2.0.2, regla S2).
 *
 * The file is only parsed into an AST and walked: it is never imported, required or evaluated, so
 * nothing in it runs. Only literal object keys are read; what needs evaluation (spreads, imported
 * objects, functions, presets, plugins) is reported as not read, with its line.
 */

export interface TailwindConfigMapping {
  /** Project-relative path of the config that was read. */
  file: string;
  /** The @theme-style variables the config maps: --color-primary, --radius-md… */
  mapped: Set<string>;
  /** What could not be read without evaluating code. */
  unread: { what: string; line: number }[];
}

/** theme keys → the @theme variable prefix of the utilities they define. */
const SECTIONS: Record<string, string> = {
  colors: "--color-",
  borderRadius: "--radius-",
  boxShadow: "--shadow-",
  fontSize: "--text-",
  letterSpacing: "--tracking-",
  lineHeight: "--leading-",
};

type Node = { type: string; loc?: { start: { line: number } }; [k: string]: any };

const lineOf = (n: Node | undefined): number => n?.loc?.start.line ?? 0;

/** Unwraps `x satisfies Config`, `x as Config`, `<Config>x` and parentheses. */
function unwrap(n: Node | undefined | null): Node | undefined {
  let cur = n ?? undefined;
  while (cur && ["TSSatisfiesExpression", "TSAsExpression", "TSTypeAssertion", "ParenthesizedExpression", "TSNonNullExpression"].includes(cur.type)) cur = cur.expression;
  return cur;
}

/** The literal name of an object key, or null when it is computed. */
function keyName(p: Node): string | null {
  if (p.computed) return null;
  const k = p.key as Node;
  if (k.type === "Identifier") return k.name;
  if (k.type === "StringLiteral" || k.type === "NumericLiteral") return String(k.value);
  return null;
}

function property(obj: Node, name: string): Node | undefined {
  return (obj.properties as Node[]).find((p) => (p.type === "ObjectProperty" || p.type === "Property") && keyName(p) === name);
}

/** The object the config exports: module.exports = {…}, export default {…}, or a const that holds it. */
function exportedObject(ast: Node): { obj?: Node; unread?: { what: string; line: number } } {
  const body = ast.program.body as Node[];
  const declared = new Map<string, Node>();
  for (const st of body) {
    const decl = st.type === "ExportNamedDeclaration" ? st.declaration : st;
    if (decl?.type !== "VariableDeclaration") continue;
    for (const d of decl.declarations as Node[]) if (d.id?.type === "Identifier" && d.init) declared.set(d.id.name, d.init);
  }
  let exported: Node | undefined;
  for (const st of body) {
    if (st.type === "ExportDefaultDeclaration") exported = st.declaration;
    const e = st.type === "ExpressionStatement" ? st.expression : undefined;
    if (e?.type === "AssignmentExpression" && e.left?.type === "MemberExpression" && e.left.object?.name === "module" && (e.left.property?.name === "exports" || e.left.property?.value === "exports")) {
      exported = e.right;
    }
  }
  let cur = unwrap(exported);
  if (cur?.type === "Identifier") cur = unwrap(declared.get(cur.name));
  if (cur?.type === "ObjectExpression") return { obj: cur };
  if (!exported) return { unread: { what: "no exported config object found", line: 0 } };
  return { unread: { what: `the exported config is ${cur?.type ?? "not an object"}, not an object literal`, line: lineOf(exported) } };
}

/** Reads one theme section (colors, borderRadius…) into @theme variable names. */
function readSection(name: string, value: Node | undefined, out: TailwindConfigMapping, where: string) {
  const v = unwrap(value);
  if (!v) return;
  if (v.type !== "ObjectExpression") {
    out.unread.push({ what: `${where}.${name} (${v.type === "ArrowFunctionExpression" || v.type === "FunctionExpression" ? "a function" : "not an object literal"})`, line: lineOf(v) });
    return;
  }
  const prefix = SECTIONS[name]!;
  const walkObject = (obj: Node, keyPath: string[]) => {
    for (const p of obj.properties as Node[]) {
      if (p.type === "SpreadElement") {
        out.unread.push({ what: `a spread in ${where}.${[name, ...keyPath].join(".")}`, line: lineOf(p) });
        continue;
      }
      const k = keyName(p);
      if (k === null) {
        out.unread.push({ what: `a computed key in ${where}.${[name, ...keyPath].join(".")}`, line: lineOf(p) });
        continue;
      }
      const inner = unwrap(p.value);
      // Nested color groups: primary: { DEFAULT: …, foreground: … } → --color-primary, --color-primary-foreground.
      if (name === "colors" && inner?.type === "ObjectExpression") {
        walkObject(inner, [...keyPath, k]);
        continue;
      }
      const parts = k === "DEFAULT" ? keyPath : [...keyPath, k];
      if (parts.length) out.mapped.add(`${prefix}${parts.join("-")}`);
      else if (name !== "colors") out.mapped.add(prefix.replace(/-$/, ""));
    }
  };
  walkObject(v, []);
}

/** The config file to read: tailwind.config.* at the root, or the one a stylesheet names with @config. */
function configFile(project: Project, cssConfigs: string[]): string | null {
  for (const name of TAILWIND_CONFIG_NAMES) if (readRootFile(project, name) !== null) return name;
  for (const c of cssConfigs) {
    const relPath = toPosix(path.relative(project.root, path.resolve(project.root, c)));
    if (isInside(project.root, path.resolve(project.root, c)) && readRootFile(project, relPath) !== null) return relPath;
  }
  return null;
}

/**
 * Reads the Tailwind 3 theme mapping of a project without running its config. `cssConfigs` are the
 * paths named by `@config` in the project CSS, already relative to the project root.
 */
export function readTailwindConfig(project: Project, cssConfigs: string[] = []): TailwindConfigMapping | null {
  const file = configFile(project, cssConfigs);
  if (!file) return null;
  const out: TailwindConfigMapping = { file, mapped: new Set(), unread: [] };
  const code = readRootFile(project, file) ?? "";
  let ast: Node;
  try {
    ast = parse(code, { sourceType: "unambiguous", plugins: ["typescript"], errorRecovery: true }) as unknown as Node;
  } catch (e) {
    out.unread.push({ what: `the file does not parse (${(e as Error).message.slice(0, 120)})`, line: 0 });
    return out;
  }
  const { obj, unread } = exportedObject(ast);
  if (!obj) {
    if (unread) out.unread.push(unread);
    return out;
  }
  for (const key of ["presets", "plugins"]) {
    const p = property(obj, key);
    const v = unwrap(p?.value);
    if (p && !(v?.type === "ArrayExpression" && v.elements.length === 0)) out.unread.push({ what: `${key} (what they add is not known without running them)`, line: lineOf(p) });
  }
  for (const p of obj.properties as Node[]) if (p.type === "SpreadElement") out.unread.push({ what: "a spread in the config", line: lineOf(p) });
  const themeProp = property(obj, "theme");
  const theme = unwrap(themeProp?.value);
  if (!theme) return out;
  if (theme.type !== "ObjectExpression") {
    out.unread.push({ what: "theme (not an object literal)", line: lineOf(theme) });
    return out;
  }
  for (const name of Object.keys(SECTIONS)) readSection(name, property(theme, name)?.value, out, "theme");
  const extendProp = property(theme, "extend");
  const extend = unwrap(extendProp?.value);
  if (extend?.type === "ObjectExpression") {
    for (const name of Object.keys(SECTIONS)) readSection(name, property(extend, name)?.value, out, "theme.extend");
    for (const p of extend.properties as Node[]) if (p.type === "SpreadElement") out.unread.push({ what: "a spread in theme.extend", line: lineOf(p) });
  } else if (extend) {
    out.unread.push({ what: "theme.extend (not an object literal)", line: lineOf(extend) });
  }
  for (const p of theme.properties as Node[]) if (p.type === "SpreadElement") out.unread.push({ what: "a spread in theme", line: lineOf(p) });
  return out;
}
