export type Severity = "info" | "warning" | "error";
export type SeverityOrOff = Severity | "off";

export const RULE_IDS = [
  "color-literal",
  "tailwind-arbitrary-value",
  "unknown-token",
  "inline-style",
  "theme-contrast",
  "class-contrast",
  "non-text-contrast",
] as const;
export type RuleId = (typeof RULE_IDS)[number];

export type ColorRole =
  | "surface.base"
  | "surface.raised"
  | "text.primary"
  | "text.secondary"
  | "border.default"
  | "accent.primary"
  | "accent"
  | "on-accent"
  | "status.success"
  | "status.warning"
  | "status.danger"
  | "status.info"
  | "status.other"
  | "generic";

export type TokenType = "color" | "length" | "shadow" | "gradient" | "font" | "other";

export interface Theme {
  name: string;
  selector: string;
  default: boolean;
}

export interface Token {
  name: string;
  type: TokenType;
  role: string;
  /** Raw value as written, per theme (inherits the default theme when not overridden). */
  values: Record<string, string>;
  comment: string | null;
  source: string;
}

/** A location in a project file. Paths are project-relative, POSIX separators. */
export interface Loc {
  file: string;
  line: number;
  column: number;
}

export interface Suggestion {
  match: "exact" | "nearest" | "none";
  kind: "token" | "class" | "scale-value" | "none";
  value: string | null;
  detail: string;
  source: string | null;
}

export interface Violation extends Loc {
  id: string;
  rule: RuleId;
  severity: Severity;
  found: string;
  property: string | null;
  context: "className" | "inline-style" | "css" | "svg-attribute";
  message: string;
  breaksThemes: string[];
  suggestion: Suggestion;
}

export interface Unresolved extends Loc {
  found: string;
  reason: string;
}

export interface Skipped {
  file: string;
  code: "PARSE_ERROR" | "FILE_TOO_LARGE" | "UNSUPPORTED_FILE";
  detail: string;
}

export class FachaError extends Error {
  constructor(
    public code:
      | "CONFIG_INVALID"
      | "PROJECT_NOT_FOUND"
      | "MULTIPLE_PROJECTS"
      | "PATH_OUTSIDE_PROJECT"
      | "PATH_NOT_FOUND"
      | "UNSUPPORTED_FILE",
    message: string,
    public details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}
