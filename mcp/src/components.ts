import fs from "node:fs";
import path from "node:path";
import type { Context } from "./context.js";
import { readRootFile, rel } from "./project.js";
import type { ElementUsage } from "./sources/usage.js";

/**
 * The project's UI components (B-030): the React components of its UI folder, the native element
 * each one stands for, and how to import it. A native element the system already has as a component
 * is a reimplementation (`ds-component-reuse`, ux:nielsen-4).
 *
 * Where: the folder components.json names (aliases.ui, or aliases.components + "/ui": shadcn/ui's
 * convention), else components/ui or src/components/ui.
 *
 * Which elements: only those with a meaning of their own, by shadcn/ui's component names. Never div
 * or span: a Card that draws a div does not make every div a card.
 */

/** Native element (and input type) → the component names that stand for it. */
const STANDS_FOR: { tag: string; as: string; type?: RegExp; names: string[] }[] = [
  { tag: "button", as: "button", names: ["Button"] },
  { tag: "input", as: "input[type=checkbox]", type: /^checkbox$/, names: ["Checkbox"] },
  { tag: "input", as: "input[type=radio]", type: /^radio$/, names: ["RadioGroupItem", "RadioGroup"] },
  { tag: "input", as: "input[type=range]", type: /^range$/, names: ["Slider"] },
  { tag: "input", as: "input", type: /^(?!checkbox$|radio$|range$|hidden$|file$|submit$|button$|reset$|image$|color$).*/, names: ["Input"] },
  { tag: "textarea", as: "textarea", names: ["Textarea"] },
  { tag: "select", as: "select", names: ["NativeSelect", "Select"] },
  { tag: "label", as: "label", names: ["Label"] },
  { tag: "table", as: "table", names: ["Table"] },
  { tag: "hr", as: "hr", names: ["Separator"] },
  { tag: "dialog", as: "dialog", names: ["Dialog"] },
  { tag: "progress", as: "progress", names: ["Progress"] },
];

export interface UiComponent {
  name: string;
  /** Project-relative file. */
  file: string;
  line: number;
  /** The import specifier with the project's alias, or null when there is none (a relative import). */
  importPath: string | null;
  /** Native elements it stands for: "button", "input[type=checkbox]"… */
  standsFor: string[];
}

export interface Inventory {
  dir: string | null;
  source: "components.json" | "convention" | null;
  components: UiComponent[];
}

const cache = new WeakMap<Context, Inventory>();

function uiDir(ctx: Context): { abs: string; alias: string | null; source: Inventory["source"] } | null {
  const root = ctx.project.root;
  const raw = readRootFile(ctx.project, "components.json");
  if (raw !== null) {
    try {
      const aliases = (JSON.parse(raw) as { aliases?: { ui?: string; components?: string } }).aliases ?? {};
      const alias = aliases.ui ?? (aliases.components ? `${aliases.components}/ui` : null);
      if (alias) {
        const relDir = alias.replace(/^[@~]\//, "");
        for (const base of [path.join(root, relDir), path.join(root, "src", relDir)])
          if (fs.existsSync(base) && fs.statSync(base).isDirectory()) return { abs: base, alias, source: "components.json" };
      }
    } catch {
      /* an unreadable components.json: fall back to the convention */
    }
  }
  for (const relDir of ["components/ui", "src/components/ui"]) {
    const abs = path.join(root, relDir);
    if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) return { abs, alias: null, source: "convention" };
  }
  return null;
}

/** Exported component names of a file, with their line. */
function exportedComponents(code: string): { name: string; line: number }[] {
  const out = new Map<string, number>();
  const lineAt = (i: number) => code.slice(0, i).split("\n").length;
  for (const m of code.matchAll(/export\s+(?:default\s+)?(?:function|const|let)\s+([A-Z]\w*)/g)) out.set(m[1]!, lineAt(m.index!));
  for (const m of code.matchAll(/export\s*\{([^}]*)\}/g))
    for (const part of m[1]!.split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (name && /^[A-Z]\w*$/.test(name) && !out.has(name)) {
        const decl = code.search(new RegExp(`(?:function|const|let)\\s+${part.trim().split(/\s+as\s+/)[0]}\\b`));
        out.set(name, lineAt(decl >= 0 ? decl : m.index!));
      }
    }
  return [...out].map(([name, line]) => ({ name, line }));
}

export function inventory(ctx: Context): Inventory {
  const hit = cache.get(ctx);
  if (hit) return hit;
  const dir = uiDir(ctx);
  const components: UiComponent[] = [];
  if (dir) {
    for (const f of fs.readdirSync(dir.abs).sort()) {
      if (!/\.(tsx|jsx)$/.test(f)) continue;
      const abs = path.join(dir.abs, f);
      const code = fs.readFileSync(abs, "utf8");
      const base = f.replace(/\.(tsx|jsx)$/, "");
      for (const { name, line } of exportedComponents(code)) {
        const standsFor = STANDS_FOR.filter((s) => s.names.includes(name)).map((s) => s.as);
        components.push({ name, file: rel(ctx.project, abs), line, importPath: dir.alias ? `${dir.alias}/${base}` : null, standsFor });
      }
    }
  }
  const out: Inventory = { dir: dir ? rel(ctx.project, dir.abs) : null, source: dir?.source ?? null, components };
  cache.set(ctx, out);
  return out;
}

/** The system component a native element reimplements, if any (first match of STANDS_FOR). */
export function componentFor(ctx: Context, e: ElementUsage): UiComponent | null {
  const inv = inventory(ctx);
  if (!inv.dir || e.file.startsWith(inv.dir + "/")) return null;
  const type = (e.attrs.type ?? "text").toLowerCase();
  if (e.tag === "input" && type === "hidden") return null;
  for (const s of STANDS_FOR) {
    if (s.tag !== e.tag || (s.type && !s.type.test(type))) continue;
    for (const name of s.names) {
      const c = inv.components.find((x) => x.name === name);
      if (c) return c;
    }
  }
  return null;
}

/** The import line for a component, from a file of the project. */
export function importLine(ctx: Context, c: UiComponent, fromFile: string): string {
  let spec = c.importPath;
  if (!spec) {
    const fromDir = path.posix.dirname(fromFile);
    spec = path.posix.relative(fromDir, c.file.replace(/\.(tsx|jsx)$/, ""));
    if (!spec.startsWith(".")) spec = `./${spec}`;
  }
  return `import { ${c.name} } from "${spec}";`;
}

/** Uses of the system's components in a file's source: <Name …> where Name is imported from the UI folder. */
export function componentUses(ctx: Context, code: string): number {
  const inv = inventory(ctx);
  if (!inv.dir) return 0;
  const replaceable = new Set(inv.components.filter((c) => c.standsFor.length).map((c) => c.name));
  const imported = new Set<string>();
  for (const m of code.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)) {
    if (!/(^|\/)ui\//.test(m[2]!) && !m[2]!.includes(inv.dir)) continue;
    for (const part of m[1]!.split(",")) {
      const local = part.trim().split(/\s+as\s+/).pop()?.trim();
      const original = part.trim().split(/\s+as\s+/)[0]?.trim();
      if (local && original && replaceable.has(original)) imported.add(local);
    }
  }
  let n = 0;
  for (const name of imported) n += [...code.matchAll(new RegExp(`<${name}[\\s/>]`, "g"))].length;
  return n;
}
