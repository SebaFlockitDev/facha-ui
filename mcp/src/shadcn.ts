import path from "node:path";
import { listProjectFiles, readRootFile, readSource, type Project } from "./project.js";

/**
 * Colors written as bare HSL channels ("222.2 47.4% 11.2%", "222 47% 11% / 0.5"), the shadcn/ui
 * convention for Tailwind 3: the token holds the channels and the CSS wraps them in hsl(var(--x)).
 * Hue may carry a unit; alpha may be a number or a percentage.
 */
const HSL_CHANNELS = /^-?\d*\.?\d+(?:deg|rad|grad|turn)?\s+\d*\.?\d+%\s+\d*\.?\d+%(?:\s*\/\s*\d*\.?\d+%?)?$/;

export function isHslChannels(value: string): boolean {
  return HSL_CHANNELS.test(value.trim());
}

/** The CSS color a channel value stands for. */
export function hslFromChannels(value: string): string {
  return `hsl(${value.trim()})`;
}

/** Tailwind configs at the project root, by the names Tailwind looks for. */
export const TAILWIND_CONFIG_NAMES = ["tailwind.config.ts", "tailwind.config.js", "tailwind.config.mjs", "tailwind.config.cjs", "tailwind.config.mts", "tailwind.config.cts"];

/** Pairs a shadcn/ui theme always declares: a surface or accent and the text that goes on it. */
const CANONICAL_PAIRS = ["background", "card", "popover", "primary", "secondary", "muted", "accent", "destructive"];

/**
 * Roles of the canonical shadcn/ui tokens (SPEC §2.0.2). In shadcn, --accent, --secondary and
 * --muted are soft backgrounds (hover, secondary buttons, muted areas), not the brand.
 * --ring has no focus role in facha-ui, so it counts as a border.
 */
const SHADCN_ROLES: Record<string, string> = {
  background: "surface.base",
  card: "surface.raised",
  popover: "surface.raised",
  foreground: "text.primary",
  "card-foreground": "text.primary",
  "popover-foreground": "text.primary",
  muted: "surface.raised",
  secondary: "surface.raised",
  accent: "surface.raised",
  "muted-foreground": "text.secondary",
  "secondary-foreground": "text.primary",
  "accent-foreground": "text.primary",
  primary: "accent.primary",
  "primary-foreground": "on-accent",
  "destructive-foreground": "on-accent",
  destructive: "status.danger",
  border: "border.default",
  input: "border.default",
  ring: "border.default",
};

/** "--color-primary" (a Tailwind 4 @theme alias) and "--primary" are the same shadcn token. */
function bareName(name: string): string {
  return name.replace(/^--/, "").replace(/^color-/, "");
}

/**
 * The shadcn/ui role of a token, or undefined when the name is not canonical. The sidebar set
 * (--sidebar, --sidebar-primary…) follows the same table; --sidebar itself is a raised surface.
 * Chart colors (--chart-1…) have no role.
 */
export function shadcnRole(name: string): string | undefined {
  const n = bareName(name);
  if (n === "sidebar") return "surface.raised";
  const inner = n.startsWith("sidebar-") ? n.slice("sidebar-".length) : n;
  return SHADCN_ROLES[inner];
}

/** Whether a name belongs to the shadcn/ui theme (canonical, sidebar or chart). */
export function isShadcnName(name: string): boolean {
  return shadcnRole(name) !== undefined || /^chart-\d+$/.test(bareName(name));
}

export interface ColorEvidence {
  /** Custom properties the project consumes as hsl(var(--x)) or hsla(var(--x)), in CSS or tailwind.config. */
  hslConsumed: Set<string>;
  /** The project follows shadcn/ui: components.json, or at least 3 canonical --x / --x-foreground pairs. */
  shadcn: boolean;
  /** Why shadcn was detected, for the assumptions. */
  shadcnReason: string | null;
}

const HSL_VAR = /hsla?\(\s*var\(\s*(--[\w-]+)/g;

/**
 * Reads the project's own evidence for colors written as channels: where they are consumed as
 * hsl(var(--x)), and whether the project is a shadcn/ui project. Text only; nothing is loaded.
 */
export function colorEvidence(project: Project, tokenNames: Iterable<string>): ColorEvidence {
  const hslConsumed = new Set<string>();
  const texts: string[] = [];
  for (const abs of listProjectFiles(project)) {
    if (path.extname(abs) !== ".css") continue;
    const text = readSource(abs);
    if (text) texts.push(text);
  }
  for (const name of TAILWIND_CONFIG_NAMES) {
    const text = readRootFile(project, name);
    if (text) texts.push(text);
  }
  for (const text of texts) for (const m of text.matchAll(HSL_VAR)) hslConsumed.add(m[1]!);

  const names = new Set([...tokenNames].map(bareName));
  const pairs = CANONICAL_PAIRS.filter((p) => names.has(p) && names.has(p === "background" ? "foreground" : `${p}-foreground`));
  let shadcnReason: string | null = null;
  if (readRootFile(project, "components.json") !== null) shadcnReason = "components.json";
  else if (pairs.length >= 3) shadcnReason = `canonical token pairs (${pairs.map((p) => `--${p}`).join(", ")})`;
  return { hslConsumed, shadcn: shadcnReason !== null, shadcnReason };
}
