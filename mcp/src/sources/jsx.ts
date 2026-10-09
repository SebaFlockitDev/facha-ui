import { parse } from "@babel/parser";
import { makeLocAt, type Usage } from "./usage.js";

const SVG_COLOR_ATTRS = new Set(["fill", "stroke", "stopColor", "floodColor", "lightingColor", "color"]);

type Node = { type: string; loc?: { start: { line: number; column: number } }; [k: string]: any };

function kebab(prop: string): string {
  if (prop.startsWith("--")) return prop;
  return prop.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase()).replace(/^ms-/, "-ms-");
}

/** Splits a class string into tokens with their offsets. */
function classTokens(text: string): { raw: string; index: number }[] {
  const out: { raw: string; index: number }[] = [];
  for (const m of text.matchAll(/\S+/g)) out.push({ raw: m[0], index: m.index! });
  return out;
}

export function extractJsx(file: string, code: string, ext: string, classHelpers: string[]): Usage[] {
  const plugins: any[] = ext === ".ts" ? ["typescript"] : ext === ".tsx" ? ["typescript", "jsx"] : ["jsx"];
  const ast = parse(code, { sourceType: "module", plugins, errorRecovery: true }) as unknown as Node;
  const usages: Usage[] = [];

  /** loc of the first character inside a string/template literal (1-based column). */
  const inner = (n: Node) => ({ line: n.loc!.start.line, column: n.loc!.start.column + 2 });

  const fromString = (n: Node) => {
    const start = inner(n);
    const value: string = n.value;
    const locAt = makeLocAt(file, start.line, start.column, value);
    for (const t of classTokens(value)) usages.push({ kind: "class", raw: t.raw, ...locAt(t.index) });
  };

  const fromTemplate = (n: Node) => {
    const quasis: Node[] = n.quasis;
    quasis.forEach((q, qi) => {
      const text: string = q.value.cooked ?? q.value.raw;
      const start = { line: q.loc!.start.line, column: q.loc!.start.column + 1 + (qi === 0 ? 1 : 0) };
      // Babel places quasi locations after the backtick / closing brace, so adjust for the first one only.
      const qStart = qi === 0 ? { line: n.loc!.start.line, column: n.loc!.start.column + 2 } : start;
      const locAt = makeLocAt(file, qStart.line, qStart.column, text);
      const tokens = classTokens(text);
      tokens.forEach((t, ti) => {
        const touchesNextExpr = ti === tokens.length - 1 && qi < quasis.length - 1 && t.index + t.raw.length === text.length;
        const touchesPrevExpr = ti === 0 && qi > 0 && t.index === 0;
        if (touchesNextExpr || touchesPrevExpr) {
          const raw = (touchesPrevExpr ? "${…}" : "") + t.raw + (touchesNextExpr ? "${…}" : "");
          usages.push({ kind: "class-dynamic", raw, ...locAt(t.index) });
        } else {
          usages.push({ kind: "class", raw: t.raw, ...locAt(t.index) });
        }
      });
    });
    for (const expr of n.expressions as Node[]) fromClassExpr(expr);
  };

  /** Static class strings reachable from a className expression. */
  const fromClassExpr = (n: Node | null | undefined): void => {
    if (!n) return;
    switch (n.type) {
      case "StringLiteral":
        return fromString(n);
      case "TemplateLiteral":
        return fromTemplate(n);
      case "ConditionalExpression":
        fromClassExpr(n.consequent);
        return fromClassExpr(n.alternate);
      case "LogicalExpression":
        return fromClassExpr(n.right);
      case "ArrayExpression":
        return (n.elements as Node[]).forEach(fromClassExpr);
      case "ObjectExpression":
        for (const p of n.properties as Node[]) {
          if (p.type === "ObjectProperty" && p.key?.type === "StringLiteral") fromString(p.key);
        }
        return;
      case "CallExpression": {
        const callee = n.callee?.type === "Identifier" ? n.callee.name : null;
        if (callee && classHelpers.includes(callee)) (n.arguments as Node[]).forEach(fromClassExpr);
        return;
      }
      case "TSAsExpression":
      case "ParenthesizedExpression":
        return fromClassExpr(n.expression);
      default:
        return;
    }
  };

  const fromStyleObject = (obj: Node) => {
    for (const p of obj.properties as Node[]) {
      if (p.type !== "ObjectProperty") continue;
      const key = p.key?.type === "Identifier" ? p.key.name : p.key?.type === "StringLiteral" ? p.key.value : null;
      if (!key) continue;
      const v = p.value as Node;
      if (v.type === "StringLiteral") {
        const s = inner(v);
        usages.push({
          kind: "decl",
          context: "inline-style",
          property: kebab(key),
          value: v.value,
          selector: null,
          file,
          line: s.line,
          column: s.column,
          locAt: makeLocAt(file, s.line, s.column, v.value),
        });
      } else if (v.type === "TemplateLiteral" && v.quasis.length === 1) {
        const text: string = v.quasis[0].value.cooked ?? "";
        const s = inner(v);
        usages.push({
          kind: "decl",
          context: "inline-style",
          property: kebab(key),
          value: text,
          selector: null,
          file,
          line: s.line,
          column: s.column,
          locAt: makeLocAt(file, s.line, s.column, text),
        });
      }
    }
  };

  const visit = (n: Node | null | undefined) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) {
      for (const c of n) visit(c);
      return;
    }
    if (n.type === "JSXAttribute" && n.name?.type === "JSXIdentifier") {
      const name: string = n.name.name;
      const value = n.value as Node | null;
      const loc = { file, line: n.loc!.start.line, column: n.loc!.start.column + 1 };
      if (name === "className" || name === "class") {
        if (value?.type === "StringLiteral") fromString(value);
        else if (value?.type === "JSXExpressionContainer") fromClassExpr(value.expression);
      } else if (name === "style" && value?.type === "JSXExpressionContainer") {
        usages.push({ kind: "inline-style", raw: code.slice(n.start, n.end).replace(/\s+/g, " "), ...loc });
        if (value.expression?.type === "ObjectExpression") fromStyleObject(value.expression);
      } else if (SVG_COLOR_ATTRS.has(name) && value?.type === "StringLiteral") {
        const s = inner(value);
        usages.push({
          kind: "decl",
          context: "svg-attribute",
          property: kebab(name),
          value: value.value,
          selector: null,
          file,
          line: s.line,
          column: s.column,
          locAt: makeLocAt(file, s.line, s.column, value.value),
        });
      }
    }
    for (const key of Object.keys(n)) {
      if (key === "loc" || key === "start" || key === "end" || key === "extra" || key === "comments") continue;
      const child = n[key];
      if (child && typeof child === "object") visit(child);
    }
  };

  visit(ast);
  return usages;
}
