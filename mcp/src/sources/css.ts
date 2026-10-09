import postcss, { type AtRule, type Root, type Rule } from "postcss";
import { selectorContext, themeForSelector } from "../tokens.js";
import { makeLocAt, type Usage } from "./usage.js";

/**
 * Extracts declarations from a CSS file. Custom-property definitions inside theme blocks of
 * token source files are token definitions and are skipped.
 */
export function extractCss(
  file: string,
  code: string,
  opts: { isTokenSource: boolean; themes?: Record<string, string>; parsed?: Root },
): Usage[] {
  const root = opts.parsed ?? postcss.parse(code, { from: file });
  const usages: Usage[] = [];
  root.walkDecls((decl) => {
    const parent = decl.parent as Rule | AtRule | undefined;
    const ctx = parent && (parent.type === "rule" || parent.type === "atrule") ? selectorContext(parent) : "";
    if (opts.isTokenSource && decl.prop.startsWith("--") && themeForSelector(ctx, opts.themes) !== null) return;
    const start = decl.source?.start;
    if (!start) return;
    const between = decl.raws.between ?? ":";
    const valueRaw = (decl.raws as any).value?.raw ?? decl.value;
    const offset = decl.prop.length + between.length;
    const valueStart = makeLocAt(file, start.line, start.column, decl.prop + between)(offset);
    const siblingBackground =
      parent && "nodes" in parent
        ? ((parent.nodes ?? []).find(
            (n: any) => n.type === "decl" && (n.prop === "background" || n.prop === "background-color"),
          ) as any)?.value ?? null
        : null;
    usages.push({
      kind: "decl",
      context: "css",
      property: decl.prop,
      value: valueRaw,
      selector: ctx || null,
      file,
      line: start.line,
      column: start.column,
      locAt: makeLocAt(file, valueStart.line, valueStart.column, valueRaw),
      siblingBackground,
    });
  });
  return usages;
}
