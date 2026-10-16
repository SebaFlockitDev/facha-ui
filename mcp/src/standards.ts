/**
 * The published standards the design-system generator takes its values from (B-025, SPEC §2.h).
 * Nothing here is taste: every constant names its source, verified in the published package on
 * 2026-10-15. The numbers measured from Radix Colors are measured again by test/standards.test.ts
 * from the scales in test/fixtures/radix-colors-3.0.0.json, so they cannot drift silently.
 */

export const SOURCES = {
  radix: "Radix Colors 3.0.0 (MIT): 12-step scales, step roles and paired tinted grays · https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale",
  leonardo: "Adobe Leonardo: each color solved for a target contrast against the background · https://github.com/adobe/leonardo",
  carbonType: "Carbon productive type set (@carbon/type 11.69: label-01 12, body-compact-01 14, body-02 16, heading-03 20, heading-04 28, heading-05 32, heading-06 42) · https://carbondesignsystem.com/elements/typography/type-sets/",
  material3Type: "Material 3 type scale (@material/web 2.5.0 md-sys-typescale: body-small 12, body-medium 14, body-large 16, title-large 22, headline-medium 28, display-small 36, display-medium 45) · https://m3.material.io/styles/typography/type-scale-tokens",
  material3Heading: "Material 3 headline-large: 32px on a 40px line, 1.25 · https://m3.material.io/styles/typography/type-scale-tokens",
  carbonSpacing: "Carbon spacing scale (@carbon/layout 11.61: spacing-01…10 = 2, 4, 8, 12, 16, 24, 32, 40, 48, 64px) · https://carbondesignsystem.com/elements/spacing/overview/",
  carbonSize: "Carbon component sizes (@carbon/layout 11.61: sm 32, md 40, lg 48px) · https://carbondesignsystem.com/elements/spacing/overview/",
  material3Shape: "Material 3 corner scale (@material/web 2.5.0 md-sys-shape: 0, 4, 8, 12, 16, 28, full) · https://m3.material.io/styles/shape/corner-radius-scale",
  fluentShadow: "Fluent 2 shadows (@fluentui/tokens 1.0.0-alpha.22 createShadowTokens; ambient 0.12 / key 0.14 light, 0.24 / 0.28 dark) · https://fluent2.microsoft.design/elevation",
  tailwindNames: "Tailwind CSS v4 theme variable namespaces (--color-*, --text-*, --font-*, --radius-*, --shadow-*) · https://tailwindcss.com/docs/theme",
  wcag143: "WCAG 2.2 SC 1.4.3 Contrast (Minimum): text 4.5:1 · https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html",
  wcag146: "WCAG 2.2 SC 1.4.6 Contrast (Enhanced): text 7:1 · https://www.w3.org/WAI/WCAG22/Understanding/contrast-enhanced.html",
  wcag1411: "WCAG 2.2 SC 1.4.11 Non-text Contrast: UI components and focus 3:1 · https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html",
  wcag141: "WCAG 2.2 SC 1.4.1 Use of Color: a state is never told by color alone · https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html",
  wcag148: "WCAG 2.2 SC 1.4.8 Visual Presentation: lines no wider than 80 characters, line spacing at least 1.5 within paragraphs, paragraph spacing at least 1.5 times the line spacing · https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation.html",
  wcag258: "WCAG 2.2 SC 2.5.8 Target Size (Minimum): 24 by 24 CSS pixels · https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html",
  statusDeltaE: "facha-ui status-confusable: two states closer than ΔE OKLab×100 10, also under deuteranopia and protanopia (mcp/src/visual.ts)",
  systemFont: "facha-ui init never installs dependencies (skills/init/SKILL.md, hard rule 4): the system font stack needs none",
  radixGray: "Radix Colors 3.0.0 gray: the untinted gray scale (chroma 0 in all 12 steps) · https://www.radix-ui.com/colors/docs/palette-composition/composing-a-palette",
  carbonStyleStrategies: "Carbon type style strategies: the productive set (14px base) was made for product design, the expressive set (16px base) for editorial pages · https://carbondesignsystem.com/elements/typography/style-strategies/",
  carbonTableRows: "Carbon data table row heights: xs 24, sm 32 (compact interfaces), md 40, lg 48, xl 64 · https://carbondesignsystem.com/components/data-table/usage/",
  wcag255: "WCAG 2.2 SC 2.5.5 Target Size (Enhanced): 44 by 44 CSS pixels, for touch · https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html",
  baymardLineLength: "Baymard Institute, Readability: The Optimal Line Length (2022): 50–75 characters for body text, from e-commerce testing · https://baymard.com/blog/line-length-readability",
  govukTableNumbers: "GOV.UK Design System, Table: when comparing columns of numbers, align the numbers to the right · https://design-system.service.gov.uk/components/table/",
  mdnTabularNums: "MDN, font-variant-numeric: tabular-nums makes figures the same width, so they align as in tables · https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric",
  carbonLayering: "Carbon layering model (@carbon/themes 11.83: layer-01/02/03 alternate #f4f4f4 and #ffffff on a #ffffff background; shadow is a separate token for floating elements) · https://carbondesignsystem.com/elements/color/overview/",
} as const;

export type SourceId = keyof typeof SOURCES;

/** WCAG 2.2 minimum ratios. */
export const WCAG = {
  AA: { text: 4.5, nonText: 3, source: "wcag143" as SourceId },
  AAA: { text: 7, nonText: 3, source: "wcag146" as SourceId },
};

type Measured = {
  /** Median WCAG contrast of each accent step against step 1 of its scale. */
  accentContrast: number[];
  /** Median OKLCH chroma of each accent step, as a share of step 9's. */
  accentChroma: number[];
  /** Median OKLCH lightness and chroma of the tinted grays (mauve, slate, sage, olive, sand). */
  grayL: number[];
  grayC: number[];
  /** Median WCAG contrast of each gray step against step 1 (all six grays). */
  grayContrast: number[];
};

/**
 * Measured from Radix Colors 3.0.0. Step 9 of the bright accents (amber, yellow, lime, mint, sky),
 * which Radix pairs with dark text, is left out of the step-9 contrast median.
 */
export const RADIX: { light: Measured; dark: Measured; source: SourceId } = {
  light: {
    accentContrast: [1, 1.034, 1.103, 1.199, 1.32, 1.501, 1.802, 2.302, 3.682, 4.003, 5.173, 12.018],
    accentChroma: [0.022, 0.065, 0.162, 0.259, 0.364, 0.483, 0.626, 0.746, 1, 0.991, 0.903, 0.449],
    grayL: [0.992, 0.983, 0.956, 0.932, 0.91, 0.886, 0.851, 0.792, 0.641, 0.607, 0.501, 0.242],
    grayC: [0.002, 0.003, 0.003, 0.003, 0.005, 0.005, 0.006, 0.008, 0.012, 0.012, 0.011, 0.011],
    grayContrast: [1, 1.027, 1.113, 1.197, 1.283, 1.377, 1.537, 1.875, 3.257, 3.72, 5.809, 15.995],
  },
  dark: {
    accentContrast: [1, 1.048, 1.207, 1.355, 1.559, 1.887, 2.419, 3.507, 4.976, 6.277, 9.657, 14.289],
    accentChroma: [0.092, 0.133, 0.314, 0.458, 0.504, 0.527, 0.59, 0.715, 1, 0.951, 0.818, 0.293],
    grayL: [0.18, 0.213, 0.252, 0.283, 0.312, 0.348, 0.4, 0.489, 0.535, 0.582, 0.767, 0.949],
    grayC: [0.004, 0.004, 0.004, 0.006, 0.006, 0.007, 0.009, 0.013, 0.017, 0.015, 0.01, 0.003],
    grayContrast: [1, 1.073, 1.186, 1.307, 1.443, 1.656, 2.054, 3.007, 3.673, 4.447, 9.015, 16.248],
  },
  source: "radix",
};

/**
 * Radix puts white text on step 9 of every scale but the bright ones (amber, yellow, lime, mint,
 * sky), which take dark text. Measured OKLCH lightness of step 9: the bright scales start at
 * 0.854, all others stay under 0.691; a solid lighter than the midpoint takes dark text.
 */
export const BRIGHT_SOLID = { brightMinL: 0.854, otherMaxL: 0.691, threshold: 0.773, source: "radix" as SourceId };

/**
 * How far Radix moves the hover step (10) from the solid (9): median ΔE OKLab×100 over the 25
 * accents. A hover closer than that is hard to notice.
 */
export const HOVER_DELTA_E = { light: 2.961, dark: 4.074, source: "radix" as SourceId };

/** Step 9 of the Radix scales the states are built from (the same value in light and dark). */
export const STATUS_SEEDS = {
  success: { radix: "green", hex: "#30a46c" },
  warning: { radix: "amber", hex: "#ffc53d" },
  danger: { radix: "red", hex: "#e5484d" },
  info: { radix: "blue", hex: "#0090ff" },
} as const;

/**
 * Candidate brand seeds when the brief has no brand color: step 9 of Radix accents, in this order.
 * The generator keeps those no state can be confused with and spreads them by hue.
 */
export const ACCENT_SEEDS = [
  { radix: "indigo", hex: "#3e63dd" },
  { radix: "teal", hex: "#12a594" },
  { radix: "plum", hex: "#ab4aba" },
  { radix: "violet", hex: "#6e56cf" },
  { radix: "cyan", hex: "#00a2c7" },
  { radix: "crimson", hex: "#e93d82" },
  { radix: "iris", hex: "#5b5bd6" },
  { radix: "jade", hex: "#29a383" },
  { radix: "purple", hex: "#8e4ec6" },
  { radix: "pink", hex: "#d6409f" },
] as const;

/** The two published type scales: Carbon's productive set and Material 3's. */
export const TYPE_SETS = {
  productive: { scale: [12, 14, 16, 20, 28, 32, 42], base: 14, source: "carbonType" as SourceId },
  standard: { scale: [12, 14, 16, 22, 28, 36, 45], base: 16, source: "material3Type" as SourceId },
} as const;
export type TypeSetId = keyof typeof TYPE_SETS;

export const DENSITY = {
  compact: { typeScale: TYPE_SETS.productive.scale, base: 14, control: 32, typeSource: "carbonType" as SourceId, typeSet: "productive" as TypeSetId },
  balanced: { typeScale: TYPE_SETS.standard.scale, base: 16, control: 40, typeSource: "material3Type" as SourceId, typeSet: "standard" as TypeSetId },
  airy: { typeScale: TYPE_SETS.standard.scale, base: 16, control: 48, typeSource: "material3Type" as SourceId, typeSet: "standard" as TypeSetId },
} as const;

/** A value a profile sets, with the sources that justify it. */
type Sourced<T> = { value: T; sources: SourceId[] };

export interface Profile {
  label: string;
  /** The density when the brief does not say one. */
  density?: Sourced<"compact" | "balanced" | "airy">;
  typeSet?: Sourced<TypeSetId>;
  /** A floor for the control height (the larger of this and the density's wins). */
  control?: Sourced<number>;
  tokens: { name: string; value: string; sources: SourceId[] }[];
  guidelines: { text: string; principle?: string; sources: SourceId[] }[];
}

const NUMBERS = {
  text: "Numbers compared in columns (amounts, totals, counts) are right-aligned and use tabular figures (`font-variant-numeric: var(--numerals)`).",
  principle: "ux:numeric-alignment",
  sources: ["govukTableNumbers", "mdnTabularNums"] as SourceId[],
};
const TOUCH = {
  text: "Touch targets are at least 44×44px; `--size-control` already meets it.",
  principle: "ux:wcag-2.5.5",
  sources: ["wcag255"] as SourceId[],
};
const LINES = {
  text: "Running text (descriptions, articles) is 50 to 75 characters per line: `max-width: var(--measure)`.",
  principle: "ux:line-length",
  sources: ["baymardLineLength", "wcag148"] as SourceId[],
};
const PRODUCT_UI = { value: "productive" as TypeSetId, sources: ["carbonStyleStrategies", "carbonType"] as SourceId[] };
const EDITORIAL = { value: "standard" as TypeSetId, sources: ["carbonStyleStrategies", "material3Type"] as SourceId[] };
const TABULAR = { name: "--numerals", value: "tabular-nums", sources: ["mdnTabularNums"] as SourceId[] };
const MEASURE = { name: "--measure", value: "75ch", sources: ["baymardLineLength", "wcag148"] as SourceId[] };
const DENSE: Profile = {
  label: "",
  density: { value: "compact", sources: ["carbonTableRows"] },
  typeSet: PRODUCT_UI,
  control: { value: 32, sources: ["carbonSize", "carbonTableRows"] },
  tokens: [{ name: "--size-row", value: "32px", sources: ["carbonTableRows"] }, TABULAR],
  guidelines: [NUMBERS, { text: "Rows of dense tables are 32px high (`--size-row`).", sources: ["carbonTableRows"] }],
};

/**
 * Product profiles (B-027): what a type of product sets by default, each value with its source,
 * verified in the primary documentation on 2026-10-16. The brief's own values win; a value no
 * source supports is not set ("other" has no profile).
 */
export const PROFILES: Record<string, Profile> = {
  "saas-dashboard": { ...DENSE, label: "SaaS or dashboard" },
  "internal-tool": { ...DENSE, label: "Internal tool" },
  fintech: { label: "Fintech", typeSet: PRODUCT_UI, tokens: [TABULAR], guidelines: [NUMBERS] },
  ecommerce: {
    label: "E-commerce",
    typeSet: EDITORIAL,
    control: { value: 48, sources: ["wcag255", "carbonSize"] },
    tokens: [MEASURE],
    guidelines: [TOUCH, LINES],
  },
  "consumer-app": { label: "Consumer app", control: { value: 48, sources: ["wcag255", "carbonSize"] }, tokens: [], guidelines: [TOUCH] },
  content: {
    label: "Content",
    density: { value: "airy", sources: ["carbonStyleStrategies"] },
    typeSet: EDITORIAL,
    tokens: [MEASURE],
    guidelines: [LINES, { text: "Paragraphs are spaced at least 1.5 times their line spacing.", sources: ["wcag148"] }],
  },
  marketing: {
    label: "Marketing",
    density: { value: "airy", sources: ["carbonStyleStrategies"] },
    typeSet: EDITORIAL,
    tokens: [MEASURE],
    guidelines: [LINES],
  },
};

export const TYPE_NAMES = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl"] as const;
export const LINE_HEIGHT = { body: 1.5, heading: 1.25 };
export const SYSTEM_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export const SPACING = [2, 4, 8, 12, 16, 24, 32, 40, 48, 64];
export const MIN_TARGET = 24;

export const RADII: [string, number][] = [["none", 0], ["xs", 4], ["sm", 8], ["md", 12], ["lg", 16], ["xl", 28], ["full", 9999]];
export const DEFAULT_RADIUS = 8;

export const SHADOWS = {
  levels: [["sm", 2], ["md", 8], ["lg", 16]] as [string, number][],
  alpha: { light: { ambient: 0.12, key: 0.14 }, dark: { ambient: 0.24, key: 0.28 } },
};

/** Fluent 2's createShadowTokens: an ambient blur plus a key shadow, per depth. */
export function fluentShadow(depth: number, mode: "light" | "dark"): string {
  const { ambient, key } = SHADOWS.alpha[mode];
  const ambientBlur = depth >= 28 ? 8 : 2;
  const y = depth === 2 ? 1 : depth / 2;
  return `0 0 ${ambientBlur}px rgba(0, 0, 0, ${ambient}), 0 ${y}px ${depth}px rgba(0, 0, 0, ${key})`;
}

/** OKLCH lightness of step 1 of Radix's untinted gray (#fcfcfc light, #111111 dark). */
export const PURE_GRAY_L1 = { light: 0.991, dark: 0.178, source: "radixGray" as SourceId };

/**
 * Styles (B-026): each direction is a seed (or the brand) plus a style, whose parameters come
 * from published systems: the default radius (Material 3 corner scale), the neutral (Radix's
 * untinted gray or a gray tinted with the seed's hue) and how cards stand out (Carbon's layers
 * with a border, or a Fluent 2 shadow of the given depth).
 */
export const STYLES = {
  standard: { label: "Estándar", radius: 8, neutral: "tinted", card: 2, sources: ["material3Shape", "radix", "fluentShadow"] as SourceId[] },
  sober: { label: "Sobrio", radius: 4, neutral: "pure", card: "layer", sources: ["material3Shape", "radixGray", "carbonLayering"] as SourceId[] },
  soft: { label: "Suave", radius: 16, neutral: "tinted", card: 8, sources: ["material3Shape", "radix", "fluentShadow"] as SourceId[] },
} as const;
export type StyleId = keyof typeof STYLES;
/** The order directions take styles in when there are several. */
export const STYLE_ORDER: StyleId[] = ["standard", "sober", "soft"];

/** Above this ΔE (OKLab×100) two states are told apart (facha-ui's status-confusable default). */
export const STATUS_MIN_DELTA_E = 10;
