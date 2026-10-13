import { readRootFile } from "./project.js";
import { exportedObject, lineOf, type Node, parseConfig, property, type Unread, unwrap } from "./static-config.js";

/**
 * What the lab needs from vite.config, read statically (SPEC §2.b.4, regla S2): the dev server port
 * (for preview.baseUrl) and the build entries (the lab must never be one). Never run.
 */

export const VITE_CONFIG_NAMES = ["vite.config.ts", "vite.config.js", "vite.config.mjs", "vite.config.mts", "vite.config.cjs", "vite.config.cts"];

export interface ViteConfig {
  file: string;
  /** server.port, when it is a number literal. */
  port: number | null;
  /** build.rollupOptions.input as written (literal paths), or null when not set. */
  inputs: string[] | null;
  /** Whether the config registers facha-ui's live plugin (it imports facha-live-plugin). */
  liveRegistered: boolean;
  unread: Unread[];
}

function literalStrings(n: Node | undefined, unread: Unread[], where: string): string[] {
  const v = unwrap(n);
  if (!v) return [];
  if (v.type === "StringLiteral") return [v.value];
  if (v.type === "ArrayExpression") return (v.elements as Node[]).flatMap((e) => literalStrings(e, unread, where));
  if (v.type === "ObjectExpression") {
    return (v.properties as Node[]).flatMap((p) => (p.type === "SpreadElement" ? (unread.push({ what: `a spread in ${where}`, line: lineOf(p) }), []) : literalStrings(p.value, unread, where)));
  }
  unread.push({ what: `${where} (not a literal path)`, line: lineOf(v) });
  return [];
}

export function readViteConfig(project: { root: string }): ViteConfig | null {
  const file = VITE_CONFIG_NAMES.find((n) => readRootFile(project, n) !== null);
  if (!file) return null;
  const code = readRootFile(project, file) ?? "";
  // The registration is an import of the lab's plugin file; a text match is enough and never runs it.
  const out: ViteConfig = { file, port: null, inputs: null, liveRegistered: /facha-live-plugin/.test(code), unread: [] };
  let ast: Node;
  try {
    ast = parseConfig(code);
  } catch (e) {
    out.unread.push({ what: `the file does not parse (${(e as Error).message.slice(0, 120)})`, line: 0 });
    return out;
  }
  const { obj, unread } = exportedObject(ast);
  if (!obj) {
    if (unread) out.unread.push(unread);
    return out;
  }
  const server = unwrap(property(obj, "server")?.value);
  const port = server?.type === "ObjectExpression" ? unwrap(property(server, "port")?.value) : undefined;
  if (port?.type === "NumericLiteral") out.port = port.value;
  else if (port) out.unread.push({ what: "server.port (not a number literal)", line: lineOf(port) });
  const build = unwrap(property(obj, "build")?.value);
  const rollup = build?.type === "ObjectExpression" ? unwrap(property(build, "rollupOptions")?.value) : undefined;
  const input = rollup?.type === "ObjectExpression" ? property(rollup, "input") : undefined;
  if (input) out.inputs = literalStrings(input.value, out.unread, "build.rollupOptions.input");
  return out;
}
