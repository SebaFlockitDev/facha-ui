import fs from "node:fs";
import type { Color } from "culori";
import { chromaHue, contrast, parseColor, shownRatio, toHex } from "./color.js";
import type { Context } from "./context.js";
import type { Density } from "./generate.js";
import { listProjectFiles, readSource, rel, resolveUserPath } from "./project.js";
import { RADII, type StyleId } from "./standards.js";
import { FachaError } from "./types.js";

/**
 * A reference page read by /facha-ui:init reference (B-028), turned into the generator's inputs. The
 * skill opens the page (with the developer's permission) and runs skills/init/scripts/reference-styles.js;
 * this only reads the JSON it wrote in the project (S2: no network). Every value says where it came from.
 */

interface Box {
  from?: string;
  color?: string;
  "background-color"?: string;
  "border-top-color"?: string;
  "border-top-width"?: string;
  "border-top-left-radius"?: string;
  "font-family"?: string;
  "font-size"?: string;
  "font-weight"?: string;
  height?: number;
}

export interface ReferenceFile {
  version: number;
  url: string;
  capturedAt?: string;
  screenshot?: string;
  styles: {
    body?: Box;
    headings?: Box[];
    button?: Box | null;
    link?: Box | null;
    card?: Box | null;
    input?: Box | null;
    backgrounds?: { color: string; area: number }[];
  };
}

/** Colored is chroma 0.06 or more: ux-gray-on-color's threshold. */
const COLORED = 0.06;
/** Families any browser has: they need no license nor loading. */
const SYSTEM_FONTS = /^(system-ui|-apple-system|blinkmacsystemfont|segoe ui|roboto|helvetica( neue)?|arial|sans-serif|serif|monospace|ui-sans-serif|ui-serif|ui-monospace|georgia|times new roman|verdana|tahoma)$/i;

const px = (v: string | undefined) => {
  const m = v?.trim().match(/^(-?\d+(?:\.\d+)?)px$/);
  return m ? Number(m[1]) : null;
};
const colorOf = (v: string | undefined): Color | null => (v ? parseColor(v.trim()) ?? null : null);
const opaque = (c: Color | null): c is Color => !!c && (c.alpha ?? 1) >= 1;
const firstFamily = (stack: string | undefined) => stack?.split(",")[0]?.trim().replace(/^["']|["']$/g, "") || null;

function read(ctx: Context, input: string): ReferenceFile {
  const { abs, isDir } = resolveUserPath(ctx.project, input);
  if (isDir) throw new FachaError("INVALID_INPUT", `reference must be a file: ${input}`, { field: "reference" });
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(abs, "utf8"));
  } catch {
    throw new FachaError("INVALID_INPUT", `reference is not valid JSON: ${input}`, { field: "reference" });
  }
  const r = raw as ReferenceFile;
  if (!r || typeof r !== "object" || typeof r.url !== "string" || !r.styles || typeof r.styles !== "object")
    throw new FachaError("INVALID_INPUT", "reference has no url and styles (written by /facha-ui:init reference)", { field: "reference" });
  return r;
}

/** Whether the project already loads a font family: its CSS, a @fontsource package or next/font. */
function projectLoads(ctx: Context, family: string): string | null {
  const name = family.toLowerCase();
  const slug = name.replace(/\s+/g, "-");
  const pkgPath = `${ctx.project.root}/package.json`;
  const pkg = fs.existsSync(pkgPath) ? readSource(pkgPath) ?? "" : "";
  if (new RegExp(`"@fontsource(-variable)?/${slug}"`).test(pkg)) return `package.json (@fontsource/${slug})`;
  const ident = family.replace(/\s+/g, "_");
  for (const f of listProjectFiles(ctx.project)) {
    if (!/\.(css|tsx|ts|jsx|js)$/.test(f)) continue;
    const text = readSource(f) ?? "";
    if (/\.css$/.test(f) && text.toLowerCase().includes(name) && /@font-face|font-family/i.test(text)) return rel(ctx.project, f);
    if (/next\/font\/google/.test(text) && new RegExp(`\\b${ident}\\b`).test(text)) return `${rel(ctx.project, f)} (next/font)`;
  }
  return null;
}

export interface FromReference {
  url: string;
  host: string;
  file: string;
  brandColor: { value: string; from: string } | null;
  /** With no colored brand: the primary button's own (neutral) color. */
  neutralButton: string | null;
  style: { value: StyleId; from: string };
  radius: { value: number; from: string } | null;
  density: { value: Density; from: string };
  fontFamily: { value: string | null; family: string | null; from: string };
  /** The reference's own pairs, measured with WCAG 2.2; the generated system replaces the failing ones. */
  pairs: { pair: string; fg: string; bg: string; ratio: number; min: number; pass: boolean; from: string }[];
  notes: string[];
}

export function fromReference(ctx: Context, input: string, level: "AA" | "AAA"): FromReference {
  const r = read(ctx, input);
  const s = r.styles;
  let host = r.url;
  try {
    host = new URL(r.url).host;
  } catch {
    /* not a URL: keep it as written */
  }
  const notes: string[] = [];
  // The page's background: the body's, else (a transparent body, as on many sites) the biggest opaque one.
  const ground =
    [colorOf(s.body?.["background-color"]), ...(s.backgrounds ?? []).map((b) => colorOf(b.color))].find((c): c is Color => opaque(c)) ??
    parseColor("#ffffff")!;

  // Brand: the primary button's own color, else the links', else the most used colored background.
  const colored = (c: Color | null) => opaque(c) && chromaHue(c).c >= COLORED;
  const buttonBg = colorOf(s.button?.["background-color"]);
  const linkColor = colorOf(s.link?.color);
  const usedBg = (s.backgrounds ?? []).map((b) => ({ ...b, c: colorOf(b.color) })).find((b) => colored(b.c));
  // A brand used only as a tint (a translucent highlight, as in many docs sites): its color, without the alpha.
  const tint = (s.backgrounds ?? [])
    .map((b) => colorOf(b.color))
    .find((c) => c && (c.alpha ?? 1) >= 0.1 && (c.alpha ?? 1) < 1 && chromaHue({ ...c, alpha: 1 }).c >= COLORED);
  const brand = colored(buttonBg)
    ? { c: buttonBg, from: `the primary button's background (${s.button?.from ?? "button"})` }
    : colored(linkColor)
      ? { c: linkColor, from: `the links' color (${s.link?.from ?? "a"})` }
      : usedBg
        ? { c: usedBg.c!, from: "the most used colored background" }
        : tint
          ? { c: { ...tint, alpha: 1 }, from: "a translucent colored background (the brand used as a tint), without its alpha" }
          : null;
  const brandColor = brand ? { value: toHex(brand.c!), from: brand.from } : null;
  if (brandColor) notes.push(`${brandColor.value} is the brand color of ${host}: the system takes it as its seed. If the product should not look like ${host}, pass another brandColor or move its hue.`);

  // Radius: the median of the button's and the card's, to Material 3's nearest corner step.
  // An input without a border (a bare search field) says nothing about the corners.
  const inputRadius = (px(s.input?.["border-top-width"]) ?? 0) > 0 ? px(s.input?.["border-top-left-radius"]) : null;
  const radii = [px(s.button?.["border-top-left-radius"]), px(s.card?.["border-top-left-radius"]), inputRadius].filter(
    (v): v is number => v !== null && v < 999,
  );
  const median = radii.length ? radii.sort((a, b) => a - b)[Math.floor(radii.length / 2)]! : null;
  const step = median === null ? null : RADII.filter(([n]) => n !== "full").reduce((best, x) => (Math.abs(x[1] - median) < Math.abs(best[1] - median) ? x : best));
  const radius = step && median !== null ? { value: step[1], from: `${median}px measured on the button and cards → Material 3 "${step[0]}" (${step[1]}px)` } : null;

  // Style: soft with round corners, sober with square corners and a neutral without tint, else standard.
  const groundTint = chromaHue(ground).c;
  const style: { value: StyleId; from: string } =
    radius && radius.value >= 12
      ? { value: "soft", from: `radius ${radius.value}px (12px or more)` }
      : radius && radius.value <= 4 && groundTint < 0.01
        ? { value: "sober", from: `radius ${radius.value}px and a background without tint` }
        : { value: "standard", from: radius ? `radius ${radius.value}px` : "no radius measured" };

  // Density: Carbon's control sizes (32, 40, 48px) and the body text.
  const control = s.button?.height ?? s.input?.height ?? null;
  const bodySize = px(s.body?.["font-size"]);
  const density: { value: Density; from: string } =
    (control !== null && control <= 32) || (bodySize !== null && bodySize <= 14)
      ? { value: "compact", from: `controls ${control ?? "–"}px, text ${bodySize ?? "–"}px (Carbon sm: 32px)` }
      : control !== null && control >= 48
        ? { value: "airy", from: `controls ${control}px (Carbon lg: 48px)` }
        : { value: "balanced", from: `controls ${control ?? "–"}px, text ${bodySize ?? "–"}px` };

  // Type: only a family the project can load. A commercial font needs a license.
  const family = firstFamily(s.body?.["font-family"]);
  let fontFamily: FromReference["fontFamily"] = { value: null, family, from: "none measured: the system font stack" };
  if (family) {
    if (SYSTEM_FONTS.test(family)) fontFamily = { value: s.body!["font-family"]!.trim(), family, from: `${family} is a system font` };
    else {
      const loads = projectLoads(ctx, family);
      fontFamily = loads
        ? { value: `"${family}", system-ui, sans-serif`, family, from: `the project already loads it (${loads})` }
        : { value: null, family, from: `${family} is not loaded by the project and may need a license: the system font stack, unless the developer confirms it (fontFamily)` };
    }
  }

  // The reference's own pairs, with WCAG 2.2: large text (24px, or 18.66px bold) takes 3:1.
  const min = level === "AAA" ? 7 : 4.5;
  const large = level === "AAA" ? 4.5 : 3;
  const isLarge = (b?: Box) => {
    const size = px(b?.["font-size"]) ?? 0;
    return size >= 24 || (size >= 18.66 && Number(b?.["font-weight"] ?? 400) >= 700);
  };
  const pairs: FromReference["pairs"] = [];
  const measure = (pair: string, fgV: string | undefined, bgC: Color | null, box: Box | undefined | null, needs: number) => {
    const fg = colorOf(fgV);
    if (!opaque(fg) || !opaque(bgC)) return;
    const raw = contrast(fg, bgC);
    pairs.push({ pair, fg: toHex(fg), bg: toHex(bgC), ratio: shownRatio(raw), min: needs, pass: raw >= needs, from: box?.from ?? "body" });
  };
  measure("text on the background", s.body?.color, ground, s.body, min);
  for (const h of s.headings ?? []) measure(`${h.from ?? "heading"} on the background`, h.color, ground, h, isLarge(h) ? large : min);
  if (s.button) measure("the button's text on the button", s.button.color, colorOf(s.button["background-color"]), s.button, isLarge(s.button) ? large : min);
  if (s.link) measure("links on the background", s.link.color, ground, s.link, min);

  // A monochrome reference: its button color, for a system that looks like it (the skill offers it).
  const neutralButton = !brandColor && opaque(buttonBg) ? toHex(buttonBg) : null;
  return { url: r.url, host, file: input, brandColor, neutralButton, style, radius, density, fontFamily, pairs, notes };
}

/** What replaces each failing pair of the reference in a generated direction. */
export const REPLACEMENT: Record<string, [string, string]> = {
  "text on the background": ["--color-foreground", "--color-background"],
  "the button's text on the button": ["--color-on-primary", "--color-primary"],
  "links on the background": ["--color-primary-strong", "--color-background"],
};
