import type { Loc } from "../types.js";

/** A class name token written in a className (or class helper call). */
export interface ClassUsage extends Loc {
  kind: "class";
  raw: string;
}

/** A className fragment that depends on runtime values (e.g. `chip-${status}`). */
export interface DynamicClassUsage extends Loc {
  kind: "class-dynamic";
  raw: string;
}

/** A style={{...}} attribute. */
export interface InlineStyleUsage extends Loc {
  kind: "inline-style";
  raw: string;
}

/** A property/value pair: CSS declaration, inline style property or SVG color attribute. */
export interface DeclUsage extends Loc {
  kind: "decl";
  context: "css" | "inline-style" | "svg-attribute";
  property: string;
  value: string;
  /** CSS selector (with at-rule context) for CSS declarations. */
  selector: string | null;
  /** Maps an index inside `value` to a file location. */
  locAt(index: number): Loc;
  /** Background declared in the same CSS rule, when present (for pair contrast). */
  siblingBackground?: string | null;
}

export type Usage = ClassUsage | DynamicClassUsage | InlineStyleUsage | DeclUsage;

/** Maps an offset inside a multi-line string that starts at (line, column) to a location. */
export function makeLocAt(file: string, startLine: number, startColumn: number, text: string) {
  return (index: number): Loc => {
    let line = startLine;
    let column = startColumn;
    for (let i = 0; i < index && i < text.length; i++) {
      if (text[i] === "\n") {
        line++;
        column = 1;
      } else column++;
    }
    return { file, line, column };
  };
}
