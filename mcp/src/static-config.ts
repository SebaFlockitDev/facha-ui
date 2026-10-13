import { parse } from "@babel/parser";

/**
 * Static reading of JS/TS config files (tailwind.config, vite.config), SPEC regla S2.
 *
 * Files are only parsed into an AST and walked: never imported, required or evaluated, so nothing
 * in them runs. Only literal object keys and literal values are read; what needs evaluation is
 * reported as not read, with its line.
 */

export type Node = { type: string; loc?: { start: { line: number } }; [k: string]: any };

export interface Unread {
  what: string;
  line: number;
}

export const lineOf = (n: Node | undefined): number => n?.loc?.start.line ?? 0;

/** Parses a config file. Throws on code Babel cannot read even with error recovery. */
export function parseConfig(code: string): Node {
  return parse(code, { sourceType: "unambiguous", plugins: ["typescript"], errorRecovery: true }) as unknown as Node;
}

/** Unwraps `x satisfies Config`, `x as Config`, `<Config>x` and parentheses. */
export function unwrap(n: Node | undefined | null): Node | undefined {
  let cur = n ?? undefined;
  while (cur && ["TSSatisfiesExpression", "TSAsExpression", "TSTypeAssertion", "ParenthesizedExpression", "TSNonNullExpression"].includes(cur.type)) cur = cur.expression;
  return cur;
}

/** The literal name of an object key, or null when it is computed. */
export function keyName(p: Node): string | null {
  if (p.computed) return null;
  const k = p.key as Node;
  if (k.type === "Identifier") return k.name;
  if (k.type === "StringLiteral" || k.type === "NumericLiteral") return String(k.value);
  return null;
}

export function property(obj: Node, name: string): Node | undefined {
  return (obj.properties as Node[]).find((p) => (p.type === "ObjectProperty" || p.type === "Property") && keyName(p) === name);
}

/**
 * The object a config exports: module.exports = {…}, export default {…}, a const that holds it,
 * or the object passed to a helper such as defineConfig({…}) (the helper itself is not run).
 */
export function exportedObject(ast: Node): { obj?: Node; unread?: Unread } {
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
  if (cur?.type === "CallExpression" && cur.arguments?.length === 1) {
    const arg = unwrap(cur.arguments[0]);
    if (arg?.type === "ObjectExpression") cur = arg;
  }
  if (cur?.type === "ObjectExpression") return { obj: cur };
  if (!exported) return { unread: { what: "no exported config object found", line: 0 } };
  const kind = cur?.type === "ArrowFunctionExpression" || cur?.type === "FunctionExpression" || cur?.type === "CallExpression" ? "computed by a function" : "not an object literal";
  return { unread: { what: `the exported config is ${kind}`, line: lineOf(exported) } };
}
