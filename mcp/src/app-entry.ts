import { readRootFile } from "./project.js";
import { lineOf, type Node, parseModule, type Unread, unwrap } from "./static-config.js";

/**
 * What the Vite lab needs from the app's entry (src/main.tsx), read statically (SPEC §2.b.4, S2):
 * the global stylesheets it imports and the providers that wrap <App />, in order, with where each
 * instance they receive comes from. The file is parsed, never run. It lets the lab's providers.tsx
 * be written from facts instead of a reading by eye.
 */

export type ProviderKind = "router" | "query-cache" | "strict" | "provider";

export interface PropOrigin {
  /** The value as written, e.g. `queryClient` or `{ staleTime: 30_000 }`. */
  text: string;
  /** For an identifier: declared in the entry, imported, or neither. */
  origin?: "local" | "import" | "unknown";
  /** Where an imported identifier comes from. */
  module?: string;
  /** Whether a local identifier is exported from the entry. */
  exported?: boolean;
  /** The local declaration's initializer, as written (truncated). */
  init?: string;
}

export interface EntryProvider {
  /** The JSX name, e.g. `QueryClientProvider` or `React.StrictMode`. */
  name: string;
  kind: ProviderKind;
  /** The module it is imported from, or "local" when the entry declares it. */
  module: string | null;
  props: Record<string, PropOrigin>;
  line: number;
}

export interface AppEntry {
  /** Project-relative path of the entry. */
  file: string;
  /** Side-effect stylesheet imports, in order, as written (relative to the entry). */
  css: string[];
  /** Providers around the app, outermost first. */
  providers: EntryProvider[];
  /** The innermost element (the app, or a RouterProvider that is the app). */
  app: { name: string; module: string | null } | null;
  unread: Unread[];
}

const ENTRY_CANDIDATES = ["src/main.tsx", "src/main.jsx", "src/main.ts", "src/main.js", "src/index.tsx", "src/index.jsx"];
const ROUTERS = new Set(["BrowserRouter", "HashRouter", "MemoryRouter", "RouterProvider", "Router"]);
const QUERY_CACHES: Record<string, RegExp> = { QueryClientProvider: /^(@tanstack\/react-query|react-query)$/, SWRConfig: /^swr$/ };
const MAX_INIT = 300;

/** The entry Vite loads: the module script of the root index.html, or a usual name. */
function entryFile(project: { root: string }): string | null {
  const html = readRootFile(project, "index.html") ?? "";
  const src = html.match(/<script[^>]*type=["']module["'][^>]*src=["']\/?([^"']+)["']/)?.[1];
  for (const f of [src, ...ENTRY_CANDIDATES]) if (f && readRootFile(project, f) !== null) return f;
  return null;
}

function jsxName(n: Node): string {
  if (n.type === "JSXIdentifier") return n.name;
  if (n.type === "JSXMemberExpression") return `${jsxName(n.object)}.${jsxName(n.property)}`;
  return "?";
}

/** JSX element children, ignoring whitespace text and comments. */
function elementChildren(el: Node): Node[] {
  return (el.children as Node[]).filter((c) => c.type === "JSXElement");
}

function hasOtherContent(el: Node): boolean {
  return (el.children as Node[]).some((c) => (c.type === "JSXText" ? c.value.trim() !== "" : c.type !== "JSXElement"));
}

export function readAppEntry(project: { root: string }): AppEntry | null {
  const file = entryFile(project);
  if (!file) return null;
  const code = readRootFile(project, file) ?? "";
  const out: AppEntry = { file, css: [], providers: [], app: null, unread: [] };
  let ast: Node;
  try {
    ast = parseModule(code);
  } catch (e) {
    out.unread.push({ what: `the file does not parse (${(e as Error).message.slice(0, 120)})`, line: 0 });
    return out;
  }
  const body = ast.program.body as Node[];
  const imports = new Map<string, string>();
  const locals = new Map<string, Node>();
  const exported = new Set<string>();
  for (const st of body) {
    if (st.type === "ImportDeclaration") {
      const from = st.source.value as string;
      if (st.specifiers.length === 0 && /\.(css|scss|sass|less)$/.test(from)) out.css.push(from);
      for (const s of st.specifiers as Node[]) imports.set(s.local.name, from);
    }
    const decl = st.type === "ExportNamedDeclaration" ? st.declaration : st;
    if (decl?.type === "VariableDeclaration") {
      for (const d of decl.declarations as Node[]) {
        if (d.id?.type !== "Identifier") continue;
        locals.set(d.id.name, d.init);
        if (st.type === "ExportNamedDeclaration") exported.add(d.id.name);
      }
    }
    if ((decl?.type === "FunctionDeclaration" || decl?.type === "ClassDeclaration") && decl.id) {
      locals.set(decl.id.name, decl);
      if (st.type === "ExportNamedDeclaration") exported.add(decl.id.name);
    }
    if (st.type === "ExportNamedDeclaration" && !st.declaration) for (const s of st.specifiers as Node[]) exported.add(s.local.name);
  }

  // The tree passed to render(): createRoot(...).render(<…/>) or ReactDOM.render(<…/>, el).
  let root: Node | undefined;
  const visit = (n: unknown) => {
    if (root || !n || typeof n !== "object") return;
    const node = n as Node;
    if (node.type === "CallExpression" && node.callee?.type === "MemberExpression" && node.callee.property?.name === "render") {
      const arg = unwrap(node.arguments?.[0]);
      if (arg?.type === "JSXElement") {
        root = arg;
        return;
      }
    }
    for (const [k, v] of Object.entries(node)) {
      if (k === "loc" || k === "start" || k === "end") continue;
      if (Array.isArray(v)) v.forEach(visit);
      else if (v && typeof v === "object") visit(v);
    }
  };
  visit(ast.program);
  if (!root) {
    out.unread.push({ what: "no render(<…/>) call with JSX found in the entry", line: 0 });
    return out;
  }

  const origin = (expr: Node): PropOrigin => {
    const text = code.slice(expr.start, expr.end).slice(0, MAX_INIT);
    if (expr.type !== "Identifier") return { text };
    if (imports.has(expr.name)) return { text, origin: "import", module: imports.get(expr.name) };
    if (locals.has(expr.name)) {
      const init = locals.get(expr.name);
      return { text, origin: "local", exported: exported.has(expr.name), ...(init ? { init: code.slice(init.start, init.end).slice(0, MAX_INIT) } : {}) };
    }
    return { text, origin: "unknown" };
  };

  let el: Node = root;
  for (;;) {
    const name = jsxName(el.openingElement.name);
    const module = imports.get(name.split(".")[0]!) ?? (locals.has(name) ? "local" : null);
    const children = elementChildren(el);
    if (children.length === 0) {
      out.app = { name, module };
      break;
    }
    const props: Record<string, PropOrigin> = {};
    for (const a of el.openingElement.attributes as Node[]) {
      if (a.type !== "JSXAttribute") {
        out.unread.push({ what: `a spread of props on <${name}>`, line: lineOf(a) });
        continue;
      }
      const v = a.value?.type === "JSXExpressionContainer" ? a.value.expression : a.value;
      props[a.name.name] = v ? origin(v) : { text: "true" };
    }
    const base = name.split(".").pop()!;
    const kind: ProviderKind = /StrictMode$/.test(name)
      ? "strict"
      : ROUTERS.has(base) && /^react-router(-dom)?$/.test(module ?? "")
        ? "router"
        : QUERY_CACHES[base]?.test(module ?? "")
          ? "query-cache"
          : "provider";
    out.providers.push({ name, kind, module, props, line: lineOf(el) });
    if (children.length > 1 || hasOtherContent(el)) {
      out.unread.push({ what: `<${name}> wraps more than the app; only its first element is followed`, line: lineOf(el) });
    }
    el = children[0]!;
  }
  return out;
}
