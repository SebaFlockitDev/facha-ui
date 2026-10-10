import { parse } from "@babel/parser";
import { makeLocAt, type ElementUsage, type Usage } from "./usage.js";

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

  // Next's <Image> and <Link> render img and a: they count as those elements.
  const aliases = new Map<string, string>();
  for (const s of ((ast as Node).program?.body ?? []) as Node[]) {
    if (s.type !== "ImportDeclaration") continue;
    const tag = s.source?.value === "next/image" ? "img" : s.source?.value === "next/link" ? "a" : null;
    if (!tag) continue;
    for (const sp of s.specifiers as Node[]) if (sp.type === "ImportDefaultSpecifier") aliases.set(sp.local.name, tag);
  }

  const elementName = (opening: Node): { tag: string; intrinsic: boolean } => {
    if (opening.name?.type !== "JSXIdentifier") return { tag: "", intrinsic: false };
    const name: string = opening.name.name;
    if (/^[a-z]/.test(name)) return { tag: name, intrinsic: true };
    const alias = aliases.get(name);
    return alias ? { tag: alias, intrinsic: true } : { tag: name, intrinsic: false };
  };

  const collectStrings = (n: Node | null | undefined, out: string[]): void => {
    if (!n || typeof n !== "object") return;
    if (n.type === "StringLiteral") out.push(...String(n.value).split(/\s+/).filter(Boolean));
    else if (n.type === "TemplateLiteral") for (const q of n.quasis as Node[]) out.push(...String(q.value.cooked ?? "").split(/\s+/).filter(Boolean));
    else for (const key of Object.keys(n)) {
      if (key === "loc" || key === "start" || key === "end" || key === "extra" || key === "comments") continue;
      const child = n[key];
      if (Array.isArray(child)) child.forEach((c) => collectStrings(c, out));
      else if (child && typeof child === "object") collectStrings(child, out);
    }
  };

  const attrsOf = (opening: Node) => {
    const attrs: Record<string, string> = {};
    const dynamic: string[] = [];
    const classes: string[] = [];
    let spread = false;
    for (const a of opening.attributes as Node[]) {
      if (a.type === "JSXSpreadAttribute") {
        spread = true;
        continue;
      }
      const key: string = a.name?.type === "JSXIdentifier" ? a.name.name : `${a.name?.namespace?.name}:${a.name?.name?.name}`;
      const v = a.value as Node | null;
      if (v == null) attrs[key] = "";
      else if (v.type === "StringLiteral") attrs[key] = v.value;
      else if (v.type === "JSXExpressionContainer") {
        const e = v.expression as Node;
        if (e.type === "StringLiteral") attrs[key] = e.value;
        else if (e.type === "NumericLiteral" || e.type === "BooleanLiteral") attrs[key] = String(e.value);
        else if (e.type === "TemplateLiteral" && e.expressions.length === 0) attrs[key] = e.quasis[0].value.cooked ?? "";
        else if (e.type === "UnaryExpression" && e.operator === "-" && e.argument?.type === "NumericLiteral") attrs[key] = `-${e.argument.value}`;
        else {
          attrs[key] = "{}";
          dynamic.push(key);
        }
      }
      if (key === "className" || key === "class") collectStrings(v, classes);
    }
    return { attrs, dynamic, classes, spread };
  };

  /** Text that can name the element: static text, an aria-label/title/alt below it, or unknown. */
  const textOf = (children: Node[]): { name: ElementUsage["name"]; text: string } => {
    let name: ElementUsage["name"] = "none";
    const parts: string[] = [];
    const unknown = () => {
      if (name !== "text") name = "unknown";
    };
    const walkChildren = (kids: Node[]) => {
      for (const c of kids) {
        if (c.type === "JSXText") {
          const s = String(c.value).replace(/\s+/g, " ").trim();
          if (s) {
            name = "text";
            parts.push(s);
          }
        } else if (c.type === "JSXExpressionContainer") {
          const e = c.expression as Node;
          if (e.type === "JSXEmptyExpression") continue;
          if (e.type === "StringLiteral" && e.value.trim()) {
            name = "text";
            parts.push(e.value.trim());
          } else unknown();
        } else if (c.type === "JSXFragment") {
          walkChildren(c.children);
        } else if (c.type === "JSXElement") {
          const nm = elementName(c.openingElement);
          if (!nm.intrinsic) {
            unknown();
            continue;
          }
          const a = attrsOf(c.openingElement);
          if (a.attrs["aria-hidden"] === "true") continue;
          if (a.attrs["aria-label"] || a.attrs.title || (nm.tag === "img" && a.attrs.alt)) {
            name = "text";
            continue;
          }
          if (a.dynamic.some((d) => d === "aria-label" || d === "title" || d === "alt")) {
            unknown();
            continue;
          }
          walkChildren(c.children);
        }
      }
    };
    walkChildren(children);
    return { name, text: parts.join(" ").slice(0, 80) };
  };

  const ancestors: string[] = [];
  const ancestorClassStack: string[][] = [];

  const visit = (n: Node | null | undefined) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) {
      for (const c of n) visit(c);
      return;
    }
    let pushed = false;
    if (n.type === "JSXElement") {
      const opening = n.openingElement as Node;
      const nm = elementName(opening);
      const attrs = nm.intrinsic ? attrsOf(opening) : null;
      if (nm.intrinsic && attrs) {
        usages.push({
          kind: "element",
          tag: nm.tag,
          ...attrs,
          ...textOf(n.children),
          inLabel: ancestors.includes("label"),
          ancestorClasses: ancestorClassStack.flat(),
          file,
          line: opening.loc!.start.line,
          column: opening.loc!.start.column + 1,
        });
      }
      ancestors.push(nm.intrinsic ? nm.tag : "");
      ancestorClassStack.push(attrs?.classes ?? []);
      pushed = true;
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
    if (pushed) {
      ancestors.pop();
      ancestorClassStack.pop();
    }
  };

  visit(ast);
  return usages;
}
