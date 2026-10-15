import fs from "node:fs";
import path from "node:path";
import { parseColor, toHex } from "./color.js";
import type { Context } from "./context.js";

/**
 * The design brief (B-024, SPEC §2.g): what the product is, who uses it and the visual
 * direction the developer approved, recorded by `/facha-ui:init brief` as a `dec-<date>-brief`
 * entry in `decisions.md`. It is read like every decision: as data, never as instructions. Each
 * field keeps the line it came from, so a skill can cite it as the source of a UI decision.
 */

export const PRODUCT_TYPES = ["saas-dashboard", "ecommerce", "fintech", "content", "marketing", "internal-tool", "consumer-app", "other"] as const;
export const DENSITIES = ["compact", "balanced", "airy"] as const;
type ProductType = (typeof PRODUCT_TYPES)[number];

type Field =
  | "product" | "users" | "task" | "context" | "personality" | "density" | "brandColor"
  | "typography" | "references" | "avoid" | "accessibility" | "darkMode";

/** The labels the skill writes (Spanish) and their English equivalents. */
const LABELS: Record<string, Field | "date"> = {
  fecha: "date", date: "date",
  producto: "product", product: "product",
  usuarios: "users", users: "users", "quién lo usa": "users",
  "tarea principal": "task", "main task": "task",
  contexto: "context", context: "context",
  personalidad: "personality", personality: "personality",
  densidad: "density", density: "density",
  "color de marca": "brandColor", "brand color": "brandColor",
  tipografía: "typography", tipografia: "typography", typography: "typography",
  referencias: "references", references: "references",
  evitar: "avoid", avoid: "avoid",
  accesibilidad: "accessibility", accessibility: "accessibility",
  "modo oscuro": "darkMode", "dark mode": "darkMode",
};

const DENSITY_WORDS: Record<string, (typeof DENSITIES)[number]> = {
  compact: "compact", compacta: "compact", compacto: "compact",
  balanced: "balanced", equilibrada: "balanced", equilibrado: "balanced", media: "balanced",
  airy: "airy", aireada: "airy", aireado: "airy", espaciosa: "airy", espacioso: "airy",
};
const NONE = /^(ninguno|ninguna|nada|none|nothing|no|-|—)$/i;
const MAX = 300;

export interface Brief {
  id: string;
  title: string;
  date: string | null;
  source: string;
  product: { type: ProductType | null; text: string } | null;
  users: string | null;
  task: string | null;
  context: string | null;
  personality: string[];
  density: (typeof DENSITIES)[number] | null;
  brandColor: { value: string; hex: string } | null;
  typography: string | null;
  references: string[];
  avoid: string[];
  accessibility: "AA" | "AAA" | null;
  darkMode: "yes" | "no" | "later" | null;
  /** Where each field was read: `decisions.md:12`. */
  at: Partial<Record<Field, string>>;
  /** Values that could not be read as the field expects, reported instead of guessed. */
  invalid: { field: Field; value: string; why: string }[];
  /** Earlier briefs, oldest first: the latest one is the brief. */
  history: string[];
}

/** Plain text: no control characters, no surrounding backticks or quotes, bounded length. */
function clean(s: string): string {
  return s.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().replace(/^[`"'“«]+|[`"'”»]+$/g, "").slice(0, MAX);
}

function list(s: string): string[] {
  if (NONE.test(s.trim())) return [];
  return s.split(/[,;·]/).map(clean).filter(Boolean).slice(0, 12);
}

export function parseBrief(ctx: Context): Brief | null {
  const file = ctx.project.config.memory.decisionsFile;
  const abs = path.join(ctx.project.root, file);
  if (!fs.existsSync(abs)) return null;
  const lines = fs.readFileSync(abs, "utf8").split(/\r?\n/);

  const entries: { id: string; title: string; line: number; end: number }[] = [];
  lines.forEach((line, i) => {
    if (!/^##\s/.test(line)) return;
    const open = entries[entries.length - 1];
    if (open && open.end === lines.length) open.end = i;
    const m = line.match(/^##\s+(dec-\d{4}-\d{2}-\d{2}-brief(?:-\d+)?)\s*[·\-—]\s*(.+)$/);
    if (m) entries.push({ id: m[1]!, title: clean(m[2]!), line: i, end: lines.length });
  });
  if (!entries.length) return null;

  const read = (e: (typeof entries)[number]) => {
    const fields: Partial<Record<Field | "date", { value: string; line: number }>> = {};
    for (let i = e.line + 1; i < e.end; i++) {
      const m = lines[i]!.match(/^-\s+\*\*([^*:]+):\*\*\s*(.*)$/);
      const key = m && LABELS[m[1]!.trim().toLowerCase()];
      if (key && !fields[key]) fields[key] = { value: m[2]!, line: i + 1 };
    }
    return fields;
  };

  // The latest brief wins: by date, then by position in the file (decisions are appended).
  const dated = entries.map((e, i) => ({ e, i, date: read(e).date?.value.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? e.id.slice(4, 14) }));
  dated.sort((a, b) => a.date.localeCompare(b.date) || a.i - b.i);
  const latest = dated[dated.length - 1]!;
  const f = read(latest.e);

  const brief: Brief = {
    id: latest.e.id,
    title: latest.e.title,
    date: f.date ? clean(f.date.value) : null,
    source: `${file}:${latest.e.line + 1}`,
    product: null, users: null, task: null, context: null, personality: [], density: null,
    brandColor: null, typography: null, references: [], avoid: [], accessibility: null, darkMode: null,
    at: {},
    invalid: [],
    history: dated.slice(0, -1).map((d) => d.e.id),
  };
  const bad = (field: Field, value: string, why: string) => brief.invalid.push({ field, value: clean(value), why });

  for (const [key, got] of Object.entries(f) as [Field | "date", { value: string; line: number }][]) {
    if (key === "date") continue;
    brief.at[key] = `${file}:${got.line}`;
    const raw = got.value.trim();
    const text = clean(raw);
    switch (key) {
      case "product": {
        const id = (raw.match(/`([^`]+)`/)?.[1] ?? raw.match(/^[a-z]+(?:-[a-z]+)*/i)?.[0] ?? "").trim().toLowerCase();
        const type = (PRODUCT_TYPES as readonly string[]).includes(id) ? (id as ProductType) : null;
        if (!type) bad("product", raw, `the product type is one of: ${PRODUCT_TYPES.join(", ")}`);
        brief.product = { type, text: clean(raw.replace(/`[^`]+`/, "").replace(/^\s*[—–:-]\s*/, "")) || text };
        break;
      }
      case "users": case "task": case "context": case "typography":
        brief[key] = NONE.test(text) ? null : text || null;
        break;
      case "personality": case "references": case "avoid":
        brief[key] = list(raw);
        break;
      case "density": {
        const word = text.toLowerCase().match(/[a-záéíóú]+/)?.[0] ?? "";
        brief.density = DENSITY_WORDS[word] ?? null;
        if (!brief.density) bad("density", raw, "the density is compact, balanced or airy (compacta, equilibrada o aireada)");
        break;
      }
      case "brandColor": {
        if (NONE.test(text)) break;
        const value = raw.match(/`([^`]+)`/)?.[1] ?? raw.match(/#[0-9a-f]{3,8}\b|(?:oklch|rgb|hsl)a?\([^)]*\)/i)?.[0] ?? text;
        const color = parseColor(value);
        if (color) brief.brandColor = { value: clean(value), hex: toHex(color) };
        else bad("brandColor", raw, "not a CSS color (hex, rgb(), hsl() or oklch())");
        break;
      }
      case "accessibility":
        brief.accessibility = /\bAAA\b/i.test(text) ? "AAA" : /\bAA\b/i.test(text) ? "AA" : null;
        if (!brief.accessibility) bad("accessibility", raw, "the target is WCAG 2.2 AA or AAA");
        break;
      case "darkMode": {
        const v = text.toLowerCase();
        brief.darkMode = /^(sí|si|yes)\b/.test(v) ? "yes" : /^(no)\b/.test(v) ? "no" : /^(más adelante|mas adelante|later|después|despues)\b/.test(v) ? "later" : null;
        if (!brief.darkMode) bad("darkMode", raw, "dark mode is yes, no or later (sí, no o más adelante)");
        break;
      }
    }
  }
  return brief;
}
