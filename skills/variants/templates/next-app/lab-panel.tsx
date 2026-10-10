"use client";
// facha-ui lab scaffold · live panel · removed by /facha-ui:apply when no runs remain
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { THEMES } from "./lab-theme";

/**
 * Floating panel of the facha-ui lab. With live mode on (/facha-ui:variants <slug> live in Claude
 * Code), the developer types a change for the variant on screen and Claude Code applies it as a
 * revision; Next reloads the page. "Choose this variant" never applies anything: it asks the
 * developer to confirm with /facha-ui:apply in Claude Code.
 *
 * "Señalar" lets the developer click up to 3 elements of the page and name them [1], [2], [3] in
 * the change, so Claude Code knows exactly what the change is about (tag, text, classes, a CSS
 * path, its position and the React component that renders it).
 *
 * "Paleta" previews the whole app with another palette: it recomputes the brand family and the
 * tinted neutrals of the project's own color tokens (OKLCH, keeping each token's lightness so the
 * contrast structure holds) and overrides them in this browser only. A palette the developer
 * likes can be proposed to Claude Code, which reviews it and changes the tokens only after the
 * developer approves it there (/facha-ui:init palette).
 *
 * It renders in a Shadow DOM with its own styles, so it neither uses nor affects the project's
 * design system. It hides itself in automated browsers (Playwright captures). It can be dragged
 * by its title, resized from its corner, minimized, or hidden (Alt+Shift+F brings it back).
 */

/** URL prefix of the lab routes, filled by /facha-ui:variants from project.lab.urlPattern. */
const LAB_BASE = "/lab"; /*__LAB_BASE__*/

const STORAGE_KEY = "facha-ui-lab-panel";
const PALETTE_KEY = "facha-ui-lab-palette";
const MAX_TARGETS = 3;

/** Sizes the panel previews the variant at, with the lab's responsive check on. */
const VIEWPORTS = [
  { name: "mobile", label: "Móvil", width: 375, height: 812 },
  { name: "tablet", label: "Tablet", width: 768, height: 1024 },
] as const;

/**
 * One-click improvements. Each one is sent as a change request: Claude Code applies it as a
 * revision of this variant, with every rule, and the page reloads.
 */
const QUICK = [
  {
    id: "mobile",
    label: "Arreglar en el celular",
    text: "Hacé que esta variante funcione bien en el celular (375px) y en tablet (768px): sin scroll horizontal, que el contenido principal tenga la pantalla (la navegación lateral se apila o va a un menú), tablas con scroll propio o como tarjetas, objetivos táctiles de 24px o más y textos de 12px o más.",
  },
  {
    id: "a11y",
    label: "Mejorar la accesibilidad",
    text: "Mejorá la accesibilidad de esta variante: foco visible, todo alcanzable con el teclado, etiquetas en los campos, nombres en los botones de ícono, contraste en todos los temas y títulos sin saltos.",
  },
  {
    id: "copy",
    label: "Mejorar los textos",
    text: "Mejorá los textos de esta variante con la voz del producto: botones con verbo y objeto, enlaces que digan adónde van, errores que digan qué pasó y qué hacer, y estados vacíos con el próximo paso.",
  },
  {
    id: "states",
    label: "Completar los estados",
    text: "Asegurá que esta variante tenga bien diseñados sus estados de cargando, vacío, error y datos extremos, con los patrones del proyecto.",
  },
  {
    id: "senior",
    label: "Revisión senior completa",
    text: "Hacé la crítica senior completa de esta variante (C1–C10) mirando sus capturas en cada tema, estado y tamaño, aplicá los arreglos que estén dentro de la variante y dejá lo demás con tu recomendación.",
  },
] as const;

const STATE_OPTIONS = [
  { value: "", label: "Datos reales" },
  { value: "loading", label: "Cargando" },
  { value: "empty", label: "Vacío" },
  { value: "error", label: "Error" },
  { value: "long", label: "Datos extremos" },
];

/** Reloads the lab page with a query parameter set (or removed). */
function setParam(name: string, value: string) {
  const url = new URL(window.location.href);
  if (value) url.searchParams.set(name, value);
  else url.searchParams.delete(name);
  window.location.assign(url.toString());
}

/** The current lab URL with the responsive check on (the theme and state stay). */
function previewUrl(): string {
  const url = new URL(window.location.href);
  url.searchParams.set("check", "responsive");
  return url.toString();
}

interface Status {
  state: "queued" | "working" | "done" | "needs-input" | "failed" | "chosen" | "proposed";
  message?: string;
  revision?: number;
  guardian?: { error: number; warning: number; info: number };
  /** For needs-input: the choices, shown as buttons; the recommended one stands out. */
  options?: { label: string; recommended?: boolean }[];
  /**
   * For needs-input that touches code outside the lab: the exact phrase to write in the Claude
   * Code chat. The panel shows it to copy instead of answer buttons, since it cannot approve it.
   */
  confirmInChat?: string;
}

/** What is sent about a pointed element. The endpoint keeps only these fields. */
interface Target {
  tag: string;
  selector?: string;
  text?: string;
  label?: string;
  role?: string;
  classes?: string;
  owner?: string;
  components?: string[];
  source?: string;
  rect?: { x: number; y: number; width: number; height: number };
}

interface PaletteBase {
  anchor: string;
  themes: { name: string; selector: string }[];
  tokens: { name: string; role?: string; values: Record<string, string> }[];
  /** Hand-written colors of the project (design-system gaps), to warn about conflicts. */
  references?: { where: string; values: string[] }[];
}

/** A palette to preview: a target hue and how much chroma the brand family and neutrals keep. */
interface PaletteChoice {
  id: string;
  name: string;
  hue: number;
  brand: number;
  neutral: number;
  /** The developer's own color, for a custom palette. */
  base?: string;
}

type TokenValues = Record<string, Record<string, string>>;

interface LiveRequest {
  id: string;
  at: string;
  kind: "change" | "choose" | "palette" | "vote";
  variant: string;
  text: string;
  voter?: string;
  targets?: Target[];
  palette?: { name: string };
  status: Status;
}

interface LiveState {
  active: boolean;
  token?: string;
  slug?: string;
  requests?: LiveRequest[];
  palette?: PaletteBase | null;
}

interface Layout {
  /** Top-left corner in px; null keeps the panel at the bottom-right corner. */
  x: number | null;
  y: number | null;
  /** Card size in px, set by the developer with the resize corner; null uses the default. */
  width: number | null;
  height: number | null;
}

interface Picked {
  el: Element;
  info: Target;
}

const DEFAULT_LAYOUT: Layout = { x: null, y: null, width: null, height: null };

const LABEL: Record<Status["state"], string> = {
  queued: "En cola",
  working: "Aplicando…",
  done: "Listo",
  "needs-input": "Necesita tu decisión",
  failed: "No se pudo",
  chosen: "Elegida",
  proposed: "Propuesta lista",
};

/**
 * Palettes common in admin and payment apps. Hues are OKLCH degrees; each token keeps its own
 * lightness, so these change the color family, not the contrast structure of the design.
 */
const PRESETS: (PaletteChoice & { note: string })[] = [
  { id: "azul", name: "Azul confianza", hue: 262, brand: 1, neutral: 1, note: "El más usado en bancos y fintech: transmite seguridad." },
  { id: "indigo", name: "Índigo", hue: 280, brand: 1, neutral: 1, note: "Azul con un toque violeta: moderno y cercano a una marca violeta." },
  { id: "turquesa", name: "Turquesa", hue: 195, brand: 1, neutral: 1, note: "Fresco y calmo; común en pagos y salud." },
  { id: "verde", name: "Verde", hue: 150, brand: 1, neutral: 1, note: "Asociado al dinero. Ojo: puede confundirse con el verde de «pagado»." },
  { id: "grafito", name: "Grafito neutro", hue: 262, brand: 0.12, neutral: 0.25, note: "Sobrio: el color queda para los estados y las alertas." },
];

/** Next.js components that wrap every page: the list of components stops there. */
const FRAMEWORK =
  /^(ClientPageRoot|ClientSegmentRoot|SegmentViewNode|LayoutRouterContext|InnerLayoutRouter|OuterLayoutRouter|RenderFromTemplateContext|RedirectBoundary|RedirectErrorBoundary|HTTPAccessFallbackBoundary|LoadingBoundary|ErrorBoundary)$/;
const COMPONENT = /^[A-Z][\w$]{0,59}$/;

const STYLES = `
:host { all: initial; }
[hidden] { display: none !important; }
.wrap { position: fixed; right: 16px; bottom: 16px; z-index: 2147483000; font: 13px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; color: #e8eaf2; }
.pillbox { display: inline-flex; align-items: center; border: 1px solid #3a4256; border-radius: 999px; background: #161a25; box-shadow: 0 6px 20px rgba(0,0,0,.35); }
.pill { display: inline-flex; align-items: center; gap: 8px; border: 0; background: none; color: #e8eaf2; padding: 7px 6px 7px 13px; font: inherit; font-weight: 600; cursor: pointer; border-radius: 999px; }
.pill-x { border: 0; background: none; color: #9ba2b8; font: inherit; font-size: 15px; cursor: pointer; padding: 4px 11px 4px 6px; border-radius: 999px; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: #6d7690; }
.dot.on { background: #4fd17f; }
.card { box-sizing: border-box; width: 360px; min-width: 260px; min-height: 180px; max-width: calc(100vw - 16px); max-height: calc(100vh - 16px); display: flex; flex-direction: column; gap: 10px; background: #161a25; border: 1px solid #3a4256; border-radius: 14px; padding: 12px 14px 14px; box-shadow: 0 12px 36px rgba(0,0,0,.45); resize: both; overflow: hidden; }
.head { display: flex; justify-content: space-between; align-items: center; gap: 8px; cursor: move; user-select: none; touch-action: none; margin: -4px -6px 0; padding: 4px 6px; border-radius: 8px; flex-shrink: 0; }
.head:hover { background: #1f2432; }
.title { font-weight: 700; font-size: 14px; }
.grip { color: #6d7690; font-size: 12px; margin-right: 4px; }
.tools { display: flex; gap: 2px; }
.muted { color: #9ba2b8; font-size: 12px; margin: 0; }
.tabs { display: flex; gap: 4px; border-bottom: 1px solid #272d3d; flex-shrink: 0; }
.tab { border: 0; background: none; color: #9ba2b8; font: inherit; font-weight: 600; padding: 4px 10px 7px; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; }
.tab[aria-selected="true"] { color: #e8eaf2; border-bottom-color: #ff8a4c; }
.body { display: flex; flex-direction: column; gap: 10px; flex: 1; min-height: 0; overflow: auto; }
textarea, input.hex { box-sizing: border-box; border-radius: 9px; border: 1px solid #3a4256; background: #0e1119; color: #e8eaf2; padding: 8px 10px; font: inherit; }
textarea { width: 100%; min-height: 64px; height: 64px; resize: vertical; flex-shrink: 0; }
input.hex { width: 96px; padding: 6px 8px; font-family: ui-monospace, Consolas, monospace; }
input[type="color"] { width: 34px; height: 30px; border: 1px solid #3a4256; border-radius: 8px; background: #0e1119; padding: 2px; cursor: pointer; }
.row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; flex-shrink: 0; }
button.act { border-radius: 9px; border: 1px solid #3a4256; background: #0e1119; color: #e8eaf2; padding: 7px 12px; font: inherit; font-weight: 600; cursor: pointer; }
button.primary { background: #e8eaf2; color: #0e1119; border-color: #e8eaf2; }
button.picking { border-color: #ff8a4c; color: #ff8a4c; }
button.icon { background: none; border: 0; color: #9ba2b8; font: inherit; font-size: 17px; line-height: 1; cursor: pointer; padding: 2px 6px; border-radius: 6px; }
button.icon:hover { background: #272d3d; color: #e8eaf2; }
button:disabled { opacity: .5; cursor: default; }
button:focus-visible, textarea:focus-visible, input:focus-visible, summary:focus-visible { outline: 2px solid #ff8a4c; outline-offset: 2px; }
.chip { display: inline-flex; align-items: center; gap: 4px; max-width: 100%; border: 1px solid #3a4256; border-radius: 999px; padding: 2px 3px 2px 9px; font-size: 12px; }
.chip b { color: #7ea8ff; }
.chip span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chip button { background: none; border: 0; color: #9ba2b8; font: inherit; cursor: pointer; padding: 0 5px; }
.list { flex: 1; min-height: 0; overflow: auto; display: grid; align-content: start; gap: 6px; padding-right: 2px; }
.card:not(.sized) .list { max-height: 34vh; }
.item { border: 1px solid #272d3d; border-radius: 9px; padding: 7px 9px; display: grid; gap: 2px; }
.state { font-size: 11.5px; font-weight: 700; }
.state.done, .state.chosen, .state.proposed { color: #4fd17f; }
.state.working, .state.queued { color: #7ea8ff; }
.state.needs-input { color: #ff8a4c; }
.state.failed { color: #ff7b72; }
details { display: grid; gap: 6px; }
summary { cursor: pointer; color: #9ba2b8; font-size: 12px; }
details[open] summary { margin-bottom: 6px; }
details .item { margin-bottom: 6px; }
.error { color: #ff7b72; font-size: 12px; margin: 0; }
.ok { color: #4fd17f; }
.warn { color: #ff8a4c; }
code { font-family: ui-monospace, Consolas, monospace; font-size: 11.5px; background: #0e1119; padding: 1px 5px; border-radius: 5px; }
.presets { display: grid; gap: 6px; }
.preset { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; align-items: center; text-align: left; border: 1px solid #272d3d; border-radius: 10px; background: #0e1119; color: #e8eaf2; padding: 7px 9px; font: inherit; cursor: pointer; }
.preset[aria-pressed="true"] { border-color: #ff8a4c; }
.preset .note { grid-column: 2; color: #9ba2b8; font-size: 11.5px; }
.swatches { display: inline-flex; grid-row: span 2; }
.swatches i { width: 14px; height: 28px; display: block; }
.swatches i:first-child { border-radius: 6px 0 0 6px; }
.swatches i:last-child { border-radius: 0 6px 6px 0; }
.conflicts { display: grid; gap: 8px; border: 1px solid #272d3d; border-radius: 10px; padding: 8px 10px; font-size: 12px; }
.conflicts.has { border-color: #ff8a4c; }
.conflicts p { margin: 0; }
.views { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; flex-shrink: 0; }
.section { display: grid; gap: 6px; flex-shrink: 0; }
.label { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #9ba2b8; }
.quick { display: flex; flex-wrap: wrap; gap: 6px; }
a.act.link { display: inline-block; text-decoration: none; border-radius: 9px; border: 1px solid #3a4256; background: #0e1119; color: #e8eaf2; padding: 7px 12px; font-weight: 600; }
a.act.link:focus-visible { outline: 2px solid #ff8a4c; outline-offset: 2px; }
select { font: inherit; font-size: 12px; color: #e8eaf2; background: #0e1119; border: 1px solid #3a4256; border-radius: 8px; padding: 3px 6px; }
.liveoff { display: grid; gap: 6px; border: 1px solid #ff8a4c; border-radius: 10px; padding: 8px 10px; font-size: 12px; }
.decision { display: grid; gap: 8px; flex-shrink: 0; max-height: 45vh; overflow: auto; border: 1px solid #ff8a4c; border-radius: 12px; background: #1f1a17; padding: 10px 12px; }
.decision .label { color: #ff8a4c; }
.decision-text { margin: 0; font-size: 12.5px; }
.decision-options { display: grid; gap: 6px; }
.decision-options button { text-align: left; }
input.answer { flex: 1; min-width: 0; box-sizing: border-box; border-radius: 9px; border: 1px solid #3a4256; background: #0e1119; color: #e8eaf2; padding: 7px 10px; font: inherit; }
.liveoff .row { gap: 6px; }
button.view { border-radius: 999px; border: 1px solid #3a4256; background: #0e1119; color: #e8eaf2; padding: 3px 10px; font: inherit; font-size: 12px; cursor: pointer; }
button.view[aria-pressed="true"] { border-color: #ff8a4c; }
.device { position: fixed; inset: 0; z-index: 2147483001; box-sizing: border-box; padding: 16px; display: flex; align-items: center; justify-content: center; background: rgba(8,10,16,.72); font: 13px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; color: #e8eaf2; }
.device-frame { display: flex; gap: 16px; align-items: flex-start; max-width: 100%; max-height: calc(100vh - 32px); }
.device-phone { flex-shrink: 0; }
.device-side { width: 300px; max-height: calc(100vh - 32px); overflow: auto; box-sizing: border-box; display: grid; gap: 10px; align-content: start; background: #161a25; border: 1px solid #3a4256; border-radius: 12px; padding: 12px; font-size: 12.5px; }
.device-side button.primary { justify-self: start; }
.device-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.issue { margin: 0; border-left: 3px solid #ff8a4c; padding-left: 8px; }
.issue.ok { border-left-color: #4fd17f; }
.fix { display: grid; gap: 8px; }
.steps { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; }
.steps li { position: relative; padding-left: 22px; color: #9ba2b8; }
.steps li::before { content: ""; position: absolute; left: 2px; top: 4px; width: 10px; height: 10px; box-sizing: border-box; border-radius: 50%; border: 2px solid #3a4256; }
.steps li.ok, .steps li.now { color: #e8eaf2; }
.steps li.ok::before { background: #4fd17f; border-color: #4fd17f; }
.steps li.now::before { border-color: #ff8a4c; border-top-color: transparent; animation: facha-spin .9s linear infinite; }
.steps li.stop { color: #ff8a4c; }
.steps li.stop::before { background: #ff8a4c; border-color: #ff8a4c; }
.fix .row { flex-wrap: wrap; gap: 6px; }
@keyframes facha-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .steps li.now::before { animation: none; } }
.device iframe { display: block; max-width: calc(100vw - 48px); border: 8px solid #161a25; border-radius: 18px; background: #ffffff; box-shadow: 0 20px 60px rgba(0,0,0,.5); }
@media (max-width: 760px) { .device-frame { flex-direction: column; overflow: auto; } .device-side { width: auto; max-height: none; } }
.layer { position: fixed; inset: 0; pointer-events: none; z-index: 2147482999; }
.box { position: absolute; left: 0; top: 0; box-sizing: border-box; border-radius: 3px; }
.box.hover { border: 2px solid #ff8a4c; background: rgba(255,138,76,.12); }
.box.mark { border: 2px dashed #7ea8ff; box-shadow: 0 0 0 1px rgba(0,0,0,.35); }
.tag { position: absolute; left: -2px; top: -24px; white-space: nowrap; background: #161a25; color: #e8eaf2; border: 1px solid #3a4256; border-radius: 6px; padding: 1px 7px; font: 600 11.5px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; }
.box[data-inside="1"] .tag { left: 2px; top: 2px; }
.mark .tag { color: #7ea8ff; }
`;

function variantFromPath(): { slug: string; variant: string } | null {
  const path = window.location.pathname.replace(/\/+$/, "");
  if (!path.startsWith(LAB_BASE + "/")) return null;
  const [slug, variant] = path.slice(LAB_BASE.length + 1).split("/");
  if (!slug || !variant || !/^[a-z][0-9]?$/.test(variant)) return null;
  return { slug, variant };
}

function load<T>(key: string, fallback: T): T {
  try {
    const saved = JSON.parse(window.localStorage.getItem(key) ?? "null") as T | null;
    return saved ?? fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked: the panel still works, it just forgets */
  }
}

/** Keeps the panel inside the viewport, with a small margin. */
function clamp(x: number, y: number, width: number, height: number) {
  const margin = 8;
  return {
    x: Math.min(Math.max(margin, x), Math.max(margin, window.innerWidth - width - margin)),
    y: Math.min(Math.max(margin, y), Math.max(margin, window.innerHeight - height - margin)),
  };
}

// ---- Palette preview (OKLCH) ----------------------------------------------------------------

type Rgb = [number, number, number];
interface Parsed {
  rgb: Rgb;
  alpha: number;
  kind: "hex" | "hex8" | "rgb";
}
interface Lch {
  L: number;
  C: number;
  h: number;
}

const COLOR_RE = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|rgba?\([^)]*\)/g;

function parseColor(text: string): Parsed | null {
  if (text.startsWith("#")) {
    let hex = text.slice(1);
    if (hex.length <= 4) hex = [...hex].map((c) => c + c).join("");
    const n = (i: number) => parseInt(hex.slice(i, i + 2), 16) / 255;
    return { rgb: [n(0), n(2), n(4)], alpha: hex.length === 8 ? n(6) : 1, kind: hex.length === 8 ? "hex8" : "hex" };
  }
  const nums = text.slice(text.indexOf("(") + 1, -1).split(/[\s,/]+/).filter(Boolean);
  if (nums.length < 3) return null;
  const channel = (v: string) => (v.endsWith("%") ? parseFloat(v) / 100 : parseFloat(v) / 255);
  const alpha = nums[3] === undefined ? 1 : nums[3].endsWith("%") ? parseFloat(nums[3]) / 100 : parseFloat(nums[3]);
  const rgb = nums.slice(0, 3).map(channel) as Rgb;
  return rgb.some(Number.isNaN) ? null : { rgb, alpha: Number.isNaN(alpha) ? 1 : alpha, kind: "rgb" };
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLinear = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

function toLch([r, g, b]: Rgb): Lch {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L, C: Math.hypot(A, B), h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
}

/** Linear sRGB of an OKLCH color (may be out of gamut). */
function lchToLinear({ L, C, h }: Lch): Rgb {
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** Back to sRGB, lowering chroma until the color fits the sRGB gamut. */
function fromLch(color: Lch): Rgb {
  const fits = (c: number) => lchToLinear({ ...color, C: c }).every((v) => v >= -1e-4 && v <= 1 + 1e-4);
  let C = color.C;
  if (!fits(C)) {
    let lo = 0;
    let hi = C;
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) lo = mid;
      else hi = mid;
    }
    C = lo;
  }
  return lchToLinear({ ...color, C }).map((v) => fromLinear(Math.min(1, Math.max(0, v)))) as Rgb;
}

function formatColor({ rgb, alpha, kind }: Parsed): string {
  const bytes = rgb.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255));
  if (kind === "rgb") return alpha < 1 ? `rgba(${bytes.join(", ")}, ${+alpha.toFixed(3)})` : `rgb(${bytes.join(", ")})`;
  const hex = bytes.map((v) => v.toString(16).padStart(2, "0")).join("");
  return kind === "hex8" ? `#${hex}${Math.round(alpha * 255).toString(16).padStart(2, "0")}` : `#${hex}`;
}

const hueDistance = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

function firstColor(value: string): Parsed | null {
  const match = value.match(COLOR_RE);
  return match ? parseColor(match[0]) : null;
}

function anchorLch(base: PaletteBase): Lch | null {
  const token = base.tokens.find((t) => t.name === base.anchor);
  const value = token?.values[base.themes[0]?.name] ?? (token ? Object.values(token.values)[0] : undefined);
  const color = value ? firstColor(value) : null;
  return color ? toLch(color.rgb) : null;
}

/**
 * New values for the brand family (colors near the brand hue) and the neutrals tinted with it.
 * Other hues (a secondary accent, status colors), greys, white and black are kept.
 */
function computePalette(base: PaletteBase, choice: PaletteChoice): TokenValues {
  const anchor = anchorLch(base);
  if (!anchor) return {};
  const shift = choice.hue - anchor.h;
  const out: TokenValues = {};
  const defaultTheme = base.themes[0]?.name;
  for (const token of base.tokens) {
    if (token.role?.startsWith("status")) continue;
    for (const [theme, value] of Object.entries(token.values)) {
      let next = value.replace(COLOR_RE, (match) => {
        const color = parseColor(match);
        if (!color) return match;
        const lch = toLch(color.rgb);
        if (lch.C < 0.005 || hueDistance(lch.h, anchor.h) > 40) return match;
        const k = lch.C >= 0.04 ? choice.brand : choice.neutral;
        return formatColor({ ...color, rgb: fromLch({ L: lch.L, C: lch.C * k, h: (lch.h + shift + 360) % 360 }) });
      });
      if (choice.base && token.name === base.anchor && theme === defaultTheme) next = choice.base;
      if (next !== value) (out[token.name] ??= {})[theme] = next;
    }
  }
  return out;
}

function customChoice(base: PaletteBase, hex: string): PaletteChoice | null {
  const color = parseColor(hex);
  const anchor = anchorLch(base);
  if (!color || !anchor) return null;
  const lch = toLch(color.rgb);
  const ratio = anchor.C > 0 ? Math.min(1.5, Math.max(0.05, lch.C / anchor.C)) : 1;
  return { id: "custom", name: `Tu color ${hex}`, hue: lch.h, brand: ratio, neutral: Math.min(1, ratio), base: hex.toLowerCase() };
}

function paletteCss(base: PaletteBase, values: TokenValues): string {
  return base.themes
    .map((theme) => {
      const decls = Object.entries(values)
        .filter(([, perTheme]) => perTheme[theme.name])
        .map(([name, perTheme]) => `${name}: ${perTheme[theme.name]} !important;`)
        .join(" ");
      return decls ? `${theme.selector} { ${decls} }` : "";
    })
    .filter(Boolean)
    .join("\n");
}

function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Lowest WCAG contrast of text and of the brand color against the surfaces, per theme. */
function contrastReport(base: PaletteBase, values: TokenValues) {
  const valueOf = (name: string, theme: string) => values[name]?.[theme] ?? base.tokens.find((t) => t.name === name)?.values[theme];
  /** Only a plain opaque color counts: gradients and translucent values depend on what is behind. */
  const opaque = (value: string | undefined) => {
    const v = value?.trim();
    const c = v ? firstColor(v) : null;
    return c && c.alpha === 1 && v?.match(COLOR_RE)?.[0] === v ? c.rgb : null;
  };
  const ratio = (a: Rgb, b: Rgb) => {
    const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const byRole = (prefix: string) => base.tokens.filter((t) => t.role?.startsWith(prefix)).map((t) => t.name);
  const surfaces = [...byRole("surface.base"), ...byRole("surface.raised")];
  const texts = byRole("text.primary");
  return base.themes.map((theme) => {
    const grounds = surfaces.map((s) => opaque(valueOf(s, theme.name))).filter((c): c is Rgb => !!c);
    const min = (names: string[]) => {
      let low = Infinity;
      for (const name of names) {
        const fg = opaque(valueOf(name, theme.name));
        if (fg) for (const bg of grounds) low = Math.min(low, ratio(fg, bg));
      }
      return Number.isFinite(low) ? low : null;
    };
    return { theme: theme.name, text: min(texts), brand: min([base.anchor]) };
  });
}

/** Perceptual distance (OKLab × 100), the same scale as the guardian's status-confusable. */
function deltaE(a: Rgb, b: Rgb): number {
  const [p, q] = [toLch(a), toLch(b)];
  const ab = (c: Lch) => [c.C * Math.cos((c.h * Math.PI) / 180), c.C * Math.sin((c.h * Math.PI) / 180)];
  const [[a1, b1], [a2, b2]] = [ab(p), ab(q)];
  return Math.hypot(p.L - q.L, a1 - a2, b1 - b2) * 100;
}

/** A plain opaque color, or null for gradients, shadows and translucent values. */
function plainColor(value: string | undefined): Rgb | null {
  const v = value?.trim();
  const c = v ? firstColor(v) : null;
  return c && c.alpha === 1 && v?.match(COLOR_RE)?.[0] === v ? c.rgb : null;
}

interface Conflict {
  kind: "status" | "literal" | "contrast";
  text: string;
  fix: string;
}

const STATUS_MIN_DELTA_E = 10;

/**
 * What a palette would break, each with a way out: hand-written colors (often status chips) it
 * would be confused with, hand-written brand colors it would leave behind, and contrast it would
 * lose. Only problems the palette introduces are listed, not the ones the project already has.
 */
function paletteConflicts(base: PaletteBase, choice: PaletteChoice | null, safe: string[]): Conflict[] {
  if (!choice) return [];
  const values = computePalette(base, choice);
  const anchor = anchorLch(base);
  const out: Conflict[] = [];
  const brandColors = (vals: TokenValues) =>
    base.tokens
      .filter((t) => t.role?.startsWith("accent"))
      .flatMap((t) => Object.entries(t.values).map(([theme, v]) => ({ token: t.name, rgb: plainColor(vals[t.name]?.[theme] ?? v) })))
      .filter((c): c is { token: string; rgb: Rgb } => !!c.rgb);
  const before = brandColors({});
  const after = brandColors(values);
  const others = safe.filter((name) => name !== choice.name);
  const elsewhere = others.length ? `otra familia sin conflictos (${others.join(", ")})` : "otra familia";
  const behind: string[] = [];
  for (const ref of base.references ?? []) {
    for (const value of ref.values) {
      const rgb = plainColor(value);
      if (!rgb) continue;
      const lch = toLch(rgb);
      if (anchor && lch.C >= 0.01 && hueDistance(lch.h, anchor.h) <= 40) behind.push(`${ref.where} (${value})`);
      const close = after.map((c) => ({ ...c, d: deltaE(rgb, c.rgb) })).sort((x, y) => x.d - y.d)[0];
      const wasClose = before.some((c) => deltaE(rgb, c.rgb) < STATUS_MIN_DELTA_E);
      if (close && close.d < STATUS_MIN_DELTA_E && !wasClose) {
        out.push({
          kind: "status",
          text: `${ref.where} (${value}) se confunde con ${close.token} (ΔE ${close.d.toFixed(1)}; mínimo ${STATUS_MIN_DELTA_E}).`,
          fix: `elegí ${elsewhere}, o si preferís esta, que ese estado no dependa solo del color: ícono y texto (WCAG 1.4.1).`,
        });
        break;
      }
    }
  }
  if (behind.length) {
    out.push({
      kind: "literal",
      text: `${behind.length} colores escritos a mano no siguen la paleta y quedan con el color anterior: ${behind.slice(0, 3).join(", ")}${behind.length > 3 ? ` y ${behind.length - 3} más` : ""}.`,
      fix: "convertirlos en tokens con /facha-ui:init colors (por ejemplo, un --brand-hover derivado de --brand), así siguen cualquier paleta.",
    });
  }
  const [was, now] = [contrastReport(base, {}), contrastReport(base, values)];
  now.forEach((r, i) => {
    if (r.text !== null && r.text < 4.5 && (was[i].text ?? 99) >= 4.5) {
      out.push({ kind: "contrast", text: `En ${r.theme}, el texto baja a ${r.text.toFixed(1)}:1 (mínimo 4.5:1).`, fix: `elegí ${elsewhere}, o probá tu color en un tono más oscuro.` });
    }
    if (r.brand !== null && r.brand < 4.5 && (was[i].brand ?? 99) >= 4.5) {
      out.push({
        kind: "contrast",
        text: `En ${r.theme}, la marca como texto (enlaces) baja a ${r.brand.toFixed(1)}:1.`,
        fix: "un tono más oscuro de la marca para el texto, o enlaces con el color de texto y subrayado.",
      });
    }
  });
  return out;
}

// ---- Pointing at elements -------------------------------------------------------------------

type Fiber = {
  type?: unknown;
  return?: Fiber | null;
  _debugOwner?: (Fiber & { name?: string }) | null;
  _debugStack?: { stack?: string } | null;
};

function nameOf(type: unknown): string | null {
  if (typeof type === "function") {
    const fn = type as { displayName?: string; name?: string };
    return fn.displayName || fn.name || null;
  }
  if (type && typeof type === "object") {
    const obj = type as { displayName?: string; render?: unknown; type?: unknown };
    return obj.displayName || nameOf(obj.render) || nameOf(obj.type);
  }
  return null;
}

/** The React components around an element. Dev builds only, best effort: React internals may change. */
function reactInfo(el: Element): Pick<Target, "owner" | "components" | "source"> {
  const out: Pick<Target, "owner" | "components" | "source"> = {};
  try {
    const key = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
    const fiber = key ? (el as unknown as Record<string, Fiber | undefined>)[key] : undefined;
    if (!fiber) return out;
    const names: string[] = [];
    for (let f = fiber.return; f && names.length < 6; f = f.return) {
      const name = nameOf(f.type);
      if (!name || !COMPONENT.test(name)) continue;
      if (FRAMEWORK.test(name)) break;
      if (names[names.length - 1] !== name) names.push(name);
    }
    if (names.length) out.components = names;
    const owner = fiber._debugOwner;
    const ownerName = owner ? nameOf(owner.type) ?? owner.name ?? null : null;
    if (ownerName && COMPONENT.test(ownerName)) out.owner = ownerName;
    // Webpack dev builds name the source file in the stack; Turbopack does not.
    for (const line of (fiber._debugStack?.stack ?? "").split("\n")) {
      if (line.includes("node_modules")) continue;
      const match = line.match(/\.\/((?:[\w@.()[\]-]+\/)*[\w@.()[\]-]+\.[jt]sx?)/);
      if (match) {
        out.source = match[1];
        break;
      }
    }
  } catch {
    /* not a React element, or a React version with other internals */
  }
  return out;
}

function cssEscape(value: string): string {
  return typeof CSS !== "undefined" && CSS.escape ? CSS.escape(value) : value.replace(/[^\w-]/g, "\\$&");
}

/** A short CSS path to the element (up to 5 levels, or up to an ancestor with an id). */
function cssPath(el: Element): string {
  const parts: string[] = [];
  for (let node: Element | null = el; node && node !== document.body && parts.length < 5; node = node.parentElement) {
    const current: Element = node;
    let part = current.tagName.toLowerCase();
    if (current.id) {
      parts.unshift(`${part}#${cssEscape(current.id)}`);
      break;
    }
    const classes = Array.from(current.classList).filter((c) => !c.includes(":")).slice(0, 2);
    part += classes.map((c) => "." + cssEscape(c)).join("");
    const same = current.parentElement ? Array.from(current.parentElement.children).filter((c) => c.tagName === current.tagName) : [];
    if (same.length > 1) part += `:nth-of-type(${same.indexOf(current) + 1})`;
    parts.unshift(part);
  }
  return parts.join(" > ");
}

function describe(el: Element): Target {
  const box = el.getBoundingClientRect();
  const text = ((el as HTMLElement).innerText ?? el.textContent ?? "").replace(/\s+/g, " ").trim();
  const label =
    el.getAttribute("aria-label") || el.getAttribute("title") || el.getAttribute("alt") || el.getAttribute("placeholder") || "";
  const target: Target = {
    tag: el.tagName.toLowerCase(),
    selector: cssPath(el).slice(0, 300),
    rect: { x: Math.round(box.left), y: Math.round(box.top), width: Math.round(box.width), height: Math.round(box.height) },
  };
  if (text) target.text = text.slice(0, 160);
  if (label) target.label = label.slice(0, 120);
  const role = el.getAttribute("role");
  if (role) target.role = role.slice(0, 40);
  const classes = Array.from(el.classList).slice(0, 8).join(" ");
  if (classes) target.classes = classes.slice(0, 200);
  return { ...target, ...reactInfo(el) };
}

/** "button «Siguiente» · Pagination" */
function shortName(t: Target): string {
  const what = t.text || t.label;
  const quoted = what ? ` «${what.length > 28 ? what.slice(0, 27) + "…" : what}»` : "";
  return `${t.tag}${quoted}${t.owner ? ` · ${t.owner}` : ""}`;
}

/** The element under the pointer, ignoring the panel; a part of an icon counts as the icon. */
function elementAt(x: number, y: number, host: Element): Element | null {
  let el = document.elementFromPoint(x, y);
  if (!el || el === host || el === document.documentElement || el === document.body) return null;
  if (el instanceof SVGElement && !(el instanceof SVGSVGElement)) el = el.ownerSVGElement ?? el;
  return el;
}

// ---- Panel ----------------------------------------------------------------------------------

function RequestItem({ r }: { r: LiveRequest }) {
  const what =
    r.kind === "choose"
      ? "Elegir esta variante"
      : r.kind === "palette"
        ? `Paleta propuesta: ${r.palette?.name ?? ""}`
        : r.kind === "vote"
          ? `Voto de ${r.voter ?? "alguien"}: ${r.text}`
          : r.text;
  return (
    <div className="item">
      <span className={`state ${r.status.state}`}>
        {LABEL[r.status.state] ?? r.status.state}
        {r.status.revision ? ` · r${r.status.revision}` : ""}
        {r.status.guardian ? ` · guardián ${r.status.guardian.error} errores` : ""}
      </span>
      <span>{what}</span>
      {r.targets && r.targets.length > 0 && (
        <span className="muted">Señalado: {r.targets.map((t, i) => `[${i + 1}] ${shortName(t)}`).join(", ")}</span>
      )}
      {r.status.message && <span className="muted">{r.status.message}</span>}
    </div>
  );
}

/** Shown where a button needs live mode: what is missing and the command, ready to copy. */
function LiveOff({ slug }: { slug: string }) {
  const command = `/facha-ui:variants ${slug} live`;
  const [copied, setCopied] = useState(false);
  return (
    <div className="liveoff" role="note">
      <span>
        <b>El modo en vivo está apagado.</b> Para que estos botones funcionen, pegá esto en Claude Code:
      </span>
      <span className="row">
        <code>{command}</code>
        <button
          className="act"
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(command);
              setCopied(true);
            } catch {
              /* clipboard blocked: the command is visible to copy by hand */
            }
          }}
        >
          {copied ? "Copiado" : "Copiar"}
        </button>
      </span>
    </div>
  );
}

/** A decision only the Claude Code chat can approve: the phrase to write there, ready to copy. */
function ChatConfirm({ phrase }: { phrase: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="liveoff" role="note">
      <span>
        <b>Se confirma en la conversación de Claude Code, no desde acá:</b> cambia código fuera del laboratorio. Escribí ahí:
      </span>
      <span className="row">
        <code>{phrase}</code>
        <button
          className="act"
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(phrase);
              setCopied(true);
            } catch {
              /* clipboard blocked: the phrase is visible to copy by hand */
            }
          }}
        >
          {copied ? "Copiado" : "Copiar"}
        </button>
      </span>
    </div>
  );
}

/** Where a fix asked from the mobile or tablet preview stands, kept across Next reloads. */
interface DeviceFix {
  id: string;
  viewport: string;
  before: string[];
}
const DEVICE_FIX_KEY = "facha-ui:device-fix";

function loadDeviceFix(): DeviceFix | null {
  try {
    return JSON.parse(window.sessionStorage.getItem(DEVICE_FIX_KEY) ?? "null") as DeviceFix | null;
  } catch {
    return null;
  }
}

function saveDeviceFix(fix: DeviceFix | null) {
  try {
    if (fix) window.sessionStorage.setItem(DEVICE_FIX_KEY, JSON.stringify(fix));
    else window.sessionStorage.removeItem(DEVICE_FIX_KEY);
  } catch {
    /* storage blocked: the progress shows until the page reloads */
  }
}

/** How the "apply" step of a device fix reads: done, in progress, or not reached yet. */
function fixStepClass(state: Status["state"] | undefined): string {
  if (state === "done") return "ok";
  if (state === "working") return "now";
  if (state === "needs-input" || state === "failed") return "stop";
  return "";
}

/** The responsive check's lines as problems in plain words (what passes is left out). */
function issuesOf(lines: string[]): string[] {
  return lines.flatMap((line) => {
    const l = line.replace(/^facha-ui responsive · /, "");
    const over = l.match(/desborde horizontal: (\d+)px/);
    if (over) return Number(over[1]) > 0 ? [`La página se mueve ${over[1]} px de costado (scroll horizontal).`] : [];
    if (/^(Nada más ancho|Objetivos táctiles de al menos|Texto de al menos)/.test(l)) return [];
    return [l];
  });
}

function Swatches({ colors }: { colors: (string | undefined)[] }) {
  return (
    <span className="swatches" aria-hidden="true">
      {colors.map((c, i) => (
        <i key={i} style={{ background: c ?? "transparent" }} />
      ))}
    </span>
  );
}

export function LabPanel() {
  const [root, setRoot] = useState<ShadowRoot | null>(null);
  const [here, setHere] = useState<{ slug: string; variant: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [hiddenPanel, setHiddenPanel] = useState(false);
  const [tab, setTab] = useState<"improve" | "changes" | "palette">("improve");
  /** What the responsive check measured inside the mobile or tablet preview. */
  const [deviceReport, setDeviceReport] = useState<string[] | null>(null);
  const deviceFrame = useRef<HTMLIFrameElement | null>(null);
  const [live, setLive] = useState<LiveState>({ active: false });
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [layout, setLayout] = useState<Layout>(DEFAULT_LAYOUT);
  const [picking, setPicking] = useState(false);
  const [targets, setTargets] = useState<Picked[]>([]);
  const [choice, setChoice] = useState<PaletteChoice | null>(null);
  const [customHex, setCustomHex] = useState("#2563eb");
  const [viewport, setViewport] = useState<(typeof VIEWPORTS)[number] | null>(null);
  const [ownAnswer, setOwnAnswer] = useState("");
  const [deviceFix, setDeviceFix] = useState<DeviceFix | null>(null);
  /** Bumped to reload the preview once a fix lands. */
  const [frameKey, setFrameKey] = useState(0);
  const reloadedFor = useRef<string | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const resizeStart = useRef<{ w: number; h: number } | null>(null);
  /** While pointing: the element under the pointer, and the one selected with ↑ / ↓. */
  const under = useRef<Element | null>(null);
  const hover = useRef<Element | null>(null);
  /** Repaints the outlines now, without waiting for the next frame. */
  const paintNow = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Keep automated captures clean, and stay out of the panel's own mobile and tablet previews.
    if (navigator.webdriver || window.self !== window.top) return;
    setHere(variantFromPath());
    setLayout({ ...DEFAULT_LAYOUT, ...load<Partial<Layout>>(STORAGE_KEY, {}) });
    // A fix asked from the preview survives the reload: reopen the same size to show how it went.
    const fix = loadDeviceFix();
    const size = fix && VIEWPORTS.find((v) => v.name === fix.viewport);
    if (fix && size) {
      setDeviceFix(fix);
      setViewport(size);
    }
    setChoice(load<PaletteChoice | null>(PALETTE_KEY, null));
    const host = document.createElement("div");
    host.setAttribute("data-facha-ui", "lab-panel");
    document.body.appendChild(host);
    hostRef.current = host;
    setRoot(host.attachShadow({ mode: "open" }));
    return () => {
      host.remove();
      document.querySelector('style[data-facha-ui="palette"]')?.remove();
    };
  }, []);

  // Alt+Shift+F shows or hides the whole panel.
  useEffect(() => {
    if (!root) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && e.code === "KeyF") {
        e.preventDefault();
        setPicking(false);
        setHiddenPanel((h) => !h);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [root]);

  // Keep a moved panel inside the window when it opens or the window shrinks.
  useEffect(() => {
    if (!root) return;
    const fit = () =>
      setLayout((current) => {
        if (!open || current.x === null || current.y === null || !wrapRef.current) return current;
        const box = wrapRef.current.getBoundingClientRect();
        const p = clamp(current.x, current.y, box.width, box.height);
        return p.x === current.x && p.y === current.y ? current : { ...current, ...p };
      });
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [root, open, hiddenPanel]);

  // Remember the size only when the developer changes it with the resize corner.
  useEffect(() => {
    if (!open) return;
    const end = () => {
      const card = cardRef.current;
      const start = resizeStart.current;
      resizeStart.current = null;
      if (!card || !start) return;
      const width = card.offsetWidth;
      const height = card.offsetHeight;
      if (Math.abs(width - start.w) < 2 && Math.abs(height - start.h) < 2) return;
      setLayout((current) => {
        const next = { ...current, width, height };
        save(STORAGE_KEY, next);
        return next;
      });
    };
    window.addEventListener("pointerup", end, true);
    window.addEventListener("mouseup", end, true);
    return () => {
      window.removeEventListener("pointerup", end, true);
      window.removeEventListener("mouseup", end, true);
    };
  }, [open]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${LAB_BASE}/facha-live`, { cache: "no-store" });
      if (res.ok) setLive((await res.json()) as LiveState);
    } catch {
      /* the dev server is restarting */
    }
  }, []);

  const mine = (live.requests ?? []).filter((r) => r.variant === here?.variant);
  const pending = mine.some((r) => r.status.state === "queued" || r.status.state === "working");
  const fixReq = deviceFix ? mine.find((r) => r.id === deviceFix.id) : undefined;

  // Once the fix lands, reload the preview so the lab measures the new revision.
  useEffect(() => {
    if (!fixReq || fixReq.status.state !== "done") return;
    const mark = `${fixReq.id}:${fixReq.status.revision ?? ""}`;
    if (reloadedFor.current === mark) return;
    reloadedFor.current = mark;
    setFrameKey((k) => k + 1);
  }, [fixReq?.id, fixReq?.status.state, fixReq?.status.revision]);

  useEffect(() => {
    if (!here) return;
    void refresh();
    const id = window.setInterval(() => void refresh(), open || pending ? 2000 : 8000);
    return () => window.clearInterval(id);
  }, [here, open, pending, refresh]);

  // Palette preview: override the tokens in this browser only.
  const paletteBase = live.palette ?? null;
  const previewValues = paletteBase && choice ? computePalette(paletteBase, choice) : null;
  const previewCss = paletteBase && previewValues ? paletteCss(paletteBase, previewValues) : "";
  useEffect(() => {
    if (!root) return;
    let style = document.querySelector<HTMLStyleElement>('style[data-facha-ui="palette"]');
    if (!previewCss) {
      style?.remove();
      return;
    }
    if (!style) {
      style = document.createElement("style");
      style.setAttribute("data-facha-ui", "palette");
      document.head.appendChild(style);
    }
    if (style.textContent !== previewCss) style.textContent = previewCss;
  }, [root, previewCss]);

  const pickPalette = (next: PaletteChoice | null) => {
    setChoice(next);
    save(PALETTE_KEY, next);
    setNotice(null);
  };

  const addTarget = useCallback((el: Element) => {
    setTargets((current) =>
      current.length >= MAX_TARGETS || current.some((t) => t.el === el) ? current : [...current, { el, info: describe(el) }],
    );
  }, []);

  // Pointing mode: the page does not react to clicks; the element under the pointer is outlined.
  useEffect(() => {
    const host = hostRef.current;
    if (!picking || !host) return;
    const inPanel = (e: Event) => e.composedPath().includes(host);
    const onMove = (e: PointerEvent) => {
      const el = inPanel(e) ? null : elementAt(e.clientX, e.clientY, host);
      if (el !== under.current) {
        under.current = el;
        hover.current = el;
        paintNow.current?.();
      }
    };
    const block = (e: Event) => {
      if (inPanel(e)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    const onClick = (e: MouseEvent) => {
      if (inPanel(e)) return;
      e.preventDefault();
      e.stopPropagation();
      const el = hover.current ?? elementAt(e.clientX, e.clientY, host);
      if (el) addTarget(el);
      setPicking(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setPicking(false);
        return;
      }
      if (inPanel(e) || !hover.current) return;
      if (e.key === "ArrowUp") {
        e.preventDefault();
        const parent = hover.current.parentElement;
        if (parent && parent !== document.body && parent !== document.documentElement) hover.current = parent;
      } else if (e.key === "ArrowDown" && under.current && hover.current !== under.current) {
        e.preventDefault();
        let child: Element = under.current;
        while (child.parentElement && child.parentElement !== hover.current) child = child.parentElement;
        hover.current = child;
      } else if (e.key === "Enter") {
        e.preventDefault();
        addTarget(hover.current);
        setPicking(false);
      }
      paintNow.current?.();
    };
    const cursor = document.createElement("style");
    cursor.setAttribute("data-facha-ui", "pointing");
    cursor.textContent = "* { cursor: crosshair !important; }";
    document.head.appendChild(cursor);
    const blocked = ["pointerdown", "mousedown", "pointerup", "mouseup", "dblclick", "contextmenu", "submit"];
    document.addEventListener("pointermove", onMove, true);
    for (const type of blocked) document.addEventListener(type, block, true);
    document.addEventListener("click", onClick, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      cursor.remove();
      document.removeEventListener("pointermove", onMove, true);
      for (const type of blocked) document.removeEventListener(type, block, true);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("keydown", onKey, true);
      under.current = null;
      hover.current = null;
    };
  }, [picking, addTarget]);

  // Outline the element under the pointer and the pointed ones, following scroll and reloads.
  useEffect(() => {
    if (!open || hiddenPanel || (!picking && targets.length === 0)) return;
    let frame = 0;
    let labelled: Element | null = null;
    const place = (box: HTMLElement | null, el: Element | null) => {
      if (!box) return;
      if (!el || !el.isConnected) {
        box.hidden = true;
        return;
      }
      const r = el.getBoundingClientRect();
      box.hidden = false;
      box.style.transform = `translate(${r.left}px, ${r.top}px)`;
      box.style.width = `${r.width}px`;
      box.style.height = `${r.height}px`;
      box.dataset.inside = r.top < 26 ? "1" : "";
    };
    const resolve = (t: Picked): Element | null => {
      if (t.el.isConnected) return t.el;
      try {
        const again = t.info.selector ? document.querySelector(t.info.selector) : null;
        if (again) t.el = again; // Next replaced the node after a reload
        return again;
      } catch {
        return null;
      }
    };
    const paint = () => {
      const layer = layerRef.current;
      if (!layer) return;
      const hoverBox = layer.querySelector<HTMLElement>(".hover");
      place(hoverBox, picking ? hover.current : null);
      if (hoverBox && hover.current && hover.current !== labelled) {
        labelled = hover.current;
        const tag = hoverBox.querySelector(".tag");
        const r = labelled.getBoundingClientRect();
        const owner = reactInfo(labelled).owner;
        if (tag) tag.textContent = `${labelled.tagName.toLowerCase()}${owner ? ` · ${owner}` : ""} · ${Math.round(r.width)}×${Math.round(r.height)}`;
      }
      targets.forEach((t, i) => place(layer.querySelector<HTMLElement>(`[data-mark="${i}"]`), resolve(t)));
    };
    // Painted at once on every pointer move or key, and each frame to follow scroll and layout.
    const tick = () => {
      paint();
      frame = requestAnimationFrame(tick);
    };
    paintNow.current = paint;
    paint();
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      paintNow.current = null;
    };
  }, [open, hiddenPanel, picking, targets]);

  const post = async (body: Record<string, unknown>) => {
    if (!here || !live.token) return null;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`${LAB_BASE}/facha-live`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: live.token, slug: here.slug, variant: here.variant, ...body }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? `Error ${res.status}`);
        return null;
      }
      const { id } = (await res.json().catch(() => ({}))) as { id?: string };
      await refresh();
      return id ?? "sent";
    } finally {
      setSending(false);
    }
  };

  /** A one-click improvement, sent as a change; the status shows in the Cambios tab. */
  /** Answers a question from Claude Code: the answer is a new request that names the question. */
  const answer = async (question: LiveRequest, choice: string) => {
    const ok = await post({ kind: "change", text: `Respuesta a ${question.id}: ${choice}` });
    if (ok) {
      setOwnAnswer("");
      setNotice(`Respuesta enviada: ${choice}`);
    }
  };

  const quick = async (label: string, request: string) => {
    const ok = await post({ kind: "change", text: request });
    if (ok) {
      setNotice(`Pedido enviado: ${label}. Claude Code lo aplica como revisión y la página se recarga sola.`);
      setTab("changes");
    }
  };

  // Reads the responsive check inside the preview once the page has settled.
  const readDeviceReport = () => {
    setDeviceReport(null);
    let tries = 0;
    const id = window.setInterval(() => {
      const box = deviceFrame.current?.contentDocument?.querySelector('[data-facha-ui="responsive-check"]');
      if (box || ++tries > 20) {
        window.clearInterval(id);
        if (box) setDeviceReport(Array.from(box.children).map((c) => c.textContent ?? ""));
      }
    }, 300);
  };

  const fixDevice = async () => {
    if (!viewport || !deviceReport) return;
    const request = `${QUICK[0].text}\n\nMedición del laboratorio a ${viewport.width}px:\n${deviceReport.join("\n")}`;
    const id = await post({ kind: "change", text: request.slice(0, 2000) });
    if (id) {
      // The preview stays open and follows the request: queued, working, then measured again.
      const fix = { id, viewport: viewport.name, before: issuesOf(deviceReport) };
      reloadedFor.current = null;
      setDeviceFix(fix);
      saveDeviceFix(fix);
      setNotice(`Pedido enviado: arreglar lo que falla a ${viewport.width}px, con la medición.`);
    }
  };

  const closeDeviceFix = () => {
    setDeviceFix(null);
    saveDeviceFix(null);
  };

  const send = async (kind: "change" | "choose") => {
    const ok = await post({
      kind,
      text: kind === "change" ? text : "",
      ...(kind === "change" && targets.length ? { targets: targets.map((t) => t.info) } : {}),
    });
    if (ok && kind === "change") {
      setText("");
      setTargets([]);
    }
    setConfirming(false);
  };

  const proposePalette = async () => {
    if (!choice || !previewValues) return;
    const note = conflicts.length ? `Conflictos vistos en el panel: ${conflicts.map((c) => c.text).join(" ")}` : "";
    const ok = await post({ kind: "palette", text: note.slice(0, 2000), palette: { name: choice.name, ...(choice.base ? { base: choice.base } : {}), tokens: previewValues } });
    if (ok) setNotice("Enviada. Claude Code la revisa (contraste incluido) y te la muestra ahí; nada cambia hasta que la apruebes.");
  };

  // Drag by the title. The position is kept inside the window and remembered.
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const box = wrapRef.current?.getBoundingClientRect();
    if (!box) return;
    drag.current = { dx: e.clientX - box.left, dy: e.clientY - box.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current || !wrapRef.current) return;
    const box = wrapRef.current.getBoundingClientRect();
    const p = clamp(e.clientX - drag.current.dx, e.clientY - drag.current.dy, box.width, box.height);
    setLayout((current) => ({ ...current, x: p.x, y: p.y }));
  };
  const onPointerUp = () => {
    if (!drag.current) return;
    drag.current = null;
    setLayout((current) => {
      save(STORAGE_KEY, current);
      return current;
    });
  };
  const resetLayout = () => {
    cardRef.current?.style.removeProperty("width");
    cardRef.current?.style.removeProperty("height");
    setLayout(DEFAULT_LAYOUT);
    save(STORAGE_KEY, DEFAULT_LAYOUT);
  };
  // The resize corner belongs to the card itself, not to its children.
  const onCardPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (card && e.target === card) resizeStart.current = { w: card.offsetWidth, h: card.offsetHeight };
  };
  const minimize = () => {
    setPicking(false);
    setOpen(false);
  };
  // Esc closes the mobile or tablet preview.
  useEffect(() => {
    if (!viewport) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setViewport(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewport]);

  const hide = () => {
    setPicking(false);
    setHiddenPanel(true);
  };

  if (!root || !here) return null;
  if (hiddenPanel) return createPortal(<style>{STYLES}</style>, root);

  const letter = here.variant.toUpperCase();
  const [latest, ...older] = [...mine].reverse();
  // Only the open card goes where it was dragged; minimized, the pill always docks at the corner.
  const placed = open && layout.x !== null && layout.y !== null;
  const sized = layout.width !== null && layout.height !== null;
  const wrapStyle: React.CSSProperties = placed ? { left: layout.x ?? 0, top: layout.y ?? 0, right: "auto", bottom: "auto" } : {};
  const cardStyle: React.CSSProperties = sized ? { width: layout.width ?? undefined, height: layout.height ?? undefined } : {};
  const liveHere = live.active && live.slug === here.slug;
  const showTab = tab === "palette" && !paletteBase ? "improve" : tab;
  const deviceIssues = issuesOf(deviceReport ?? []);
  // The newest question still waiting for an answer, unless a later request already answers it.
  // A chat-only confirmation stays until Claude Code resolves it: a panel answer cannot.
  const decision = [...mine].reverse().find(
    (r) =>
      r.status.state === "needs-input" &&
      (r.status.confirmInChat || !mine.some((m) => m.text.startsWith(`Respuesta a ${r.id}`))),
  );
  const params = new URLSearchParams(window.location.search);
  const currentTheme = params.get("theme") ?? "";
  const currentState = params.get("state") ?? "";

  const improveTab = (
    <>
      <div className="section">
        <span className="label">Ver</span>
        <div className="views" role="group" aria-label="Tamaño">
          <button className="view" type="button" aria-pressed={!viewport} onClick={() => setViewport(null)}>
            Escritorio
          </button>
          {VIEWPORTS.map((v) => (
            <button
              key={v.name}
              className="view"
              type="button"
              aria-pressed={viewport?.name === v.name}
              title={`${v.width} × ${v.height}, con el medidor de responsive`}
              onClick={() => setViewport(v)}
            >
              {v.label} {v.width}
            </button>
          ))}
        </div>
        <div className="views">
          {Object.keys(THEMES).length > 0 && (
            <label className="muted">
              Tema{" "}
              <select value={currentTheme} onChange={(e) => setParam("theme", e.target.value)}>
                <option value="">Por defecto</option>
                {Object.keys(THEMES).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="muted">
            Estado{" "}
            <select value={currentState} onChange={(e) => setParam("state", e.target.value)}>
              {STATE_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="section">
        <span className="label">Mejorar con un clic</span>
        {!liveHere && <LiveOff slug={here.slug} />}
        <div className="quick">
          {QUICK.map((q) => (
            <button key={q.id} className="act" type="button" disabled={sending || !liveHere} title={q.text} onClick={() => void quick(q.label, q.text)}>
              {q.label}
            </button>
          ))}
        </div>
        <p className="muted">Claude Code aplica cada mejora como una revisión de esta variante, con todas las reglas. Para algo puntual, usá la pestaña Cambios.</p>
      </div>
      <div className="section">
        <span className="label">Decidir</span>
        <div className="quick">
          <a className="act link" href={`${LAB_BASE}/compare/${here.slug}`} target="_blank" rel="noreferrer">
            Comparar las variantes
          </a>
          {liveHere && (
            <button
              className="act"
              type="button"
              onClick={() => {
                setTab("changes");
                setConfirming(true);
              }}
            >
              Elegir esta variante
            </button>
          )}
        </div>
      </div>
      {notice && <p className="muted">{notice}</p>}
      {error && <p className="error">{error}</p>}
    </>
  );

  const swatchesOf = (c: PaletteChoice | null) => {
    if (!paletteBase) return [];
    const values = c ? computePalette(paletteBase, c) : {};
    const [light, dark] = [paletteBase.themes[0]?.name, paletteBase.themes[1]?.name];
    const valueOf = (name: string | undefined, theme: string | undefined) =>
      name && theme ? values[name]?.[theme] ?? paletteBase.tokens.find((t) => t.name === name)?.values[theme] : undefined;
    const text = paletteBase.tokens.find((t) => t.role?.startsWith("text.primary"))?.name;
    const surface = paletteBase.tokens.find((t) => t.role?.startsWith("surface.base") && t.name !== paletteBase.tokens[0]?.name)?.name;
    return [valueOf(paletteBase.anchor, light), valueOf(paletteBase.anchor, dark), valueOf(text, light), valueOf(surface, light)];
  };
  const report = paletteBase ? contrastReport(paletteBase, previewValues ?? {}) : [];
  // Presets that introduce no status or contrast conflict, offered as the way out of one.
  const safePresets = paletteBase
    ? PRESETS.filter((p) => paletteConflicts(paletteBase, p, []).every((c) => c.kind === "literal")).map((p) => p.name)
    : [];
  const conflicts = paletteBase ? paletteConflicts(paletteBase, choice, safePresets) : [];
  const blocking = conflicts.some((c) => c.kind !== "literal");

  const changesTab = !live.active ? (
    <p className="muted">
      El modo en vivo está apagado. Para pedir cambios desde acá, pedí en Claude Code: <code>/facha-ui:variants {here.slug} live</code>
    </p>
  ) : !liveHere ? (
    <p className="muted">El modo en vivo está activo para otra pantalla ({live.slug}).</p>
  ) : (
    <>
      <label className="muted" htmlFor="facha-change">¿Qué querés cambiarle a esta variante?</label>
      <textarea
        id="facha-change"
        value={text}
        maxLength={2000}
        placeholder={targets.length ? "Por ejemplo: mové [1] arriba de la tabla" : "Por ejemplo: agregá un contador de pendientes al lado del título"}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && text.trim()) void send("change");
        }}
      />
      <div className="row">
        <button
          className={`act${picking ? " picking" : ""}`}
          type="button"
          disabled={!picking && targets.length >= MAX_TARGETS}
          title="Hacé clic en un elemento de la variante para decir a qué te referís"
          onClick={() => setPicking((p) => !p)}
        >
          {picking ? "Cancelar (Esc)" : "⌖ Señalar"}
        </button>
        {targets.map((t, i) => (
          <span className="chip" key={i} title={t.info.selector}>
            <b>[{i + 1}]</b>
            <span>{shortName(t.info)}</span>
            <button type="button" aria-label={`Quitar [${i + 1}]`} onClick={() => setTargets((current) => current.filter((_, j) => j !== i))}>
              ×
            </button>
          </span>
        ))}
      </div>
      {picking ? (
        <p className="muted">Hacé clic en un elemento. Con ↑ elegís el contenedor que lo envuelve, con ↓ volvés, Enter confirma y Esc cancela.</p>
      ) : targets.length > 0 ? (
        <p className="muted">Nombralos en el texto como [1], [2]… Se envían junto con el cambio.</p>
      ) : null}
      <div className="row">
        <button className="act primary" type="button" disabled={sending || !text.trim()} onClick={() => void send("change")}>
          Pedir cambio
        </button>
        {!confirming ? (
          <button className="act" type="button" disabled={sending} onClick={() => setConfirming(true)}>
            Elegir esta variante
          </button>
        ) : (
          <button className="act" type="button" disabled={sending} onClick={() => void send("choose")}>
            Confirmar: preparar el plan en Claude Code
          </button>
        )}
      </div>
      {confirming && <p className="muted">Nada se aplica desde acá: Claude Code te muestra el plan y lo confirmás ahí, con el motivo.</p>}
      {notice && <p className="muted">{notice}</p>}
      {error && <p className="error">{error}</p>}
      <div className="list" aria-live="polite">
        {latest && <RequestItem r={latest} />}
        {older.length > 0 && (
          <details>
            <summary>Historial ({older.length})</summary>
            {older.map((r) => (
              <RequestItem key={r.id} r={r} />
            ))}
          </details>
        )}
      </div>
    </>
  );

  const paletteTab = paletteBase && (
    <>
      <p className="muted">
        Probá otra paleta sobre toda la app. Es una vista previa en este navegador: no cambia ningún archivo. Se recalculan los
        tokens de la marca y los grises teñidos; el acento y los colores de estado no cambian.
      </p>
      <div className="presets">
        <button className="preset" type="button" aria-pressed={choice === null} onClick={() => pickPalette(null)}>
          <Swatches colors={swatchesOf(null)} />
          <b>Original</b>
          <span className="note">La paleta actual del proyecto.</span>
        </button>
        {PRESETS.map((p) => (
          <button key={p.id} className="preset" type="button" aria-pressed={choice?.id === p.id} onClick={() => pickPalette(p)}>
            <Swatches colors={swatchesOf(p)} />
            <b>{p.name}</b>
            <span className="note">{p.note}</span>
          </button>
        ))}
      </div>
      <div className="row">
        <input type="color" aria-label="Elegí tu color" value={/^#[0-9a-f]{6}$/i.test(customHex) ? customHex : "#000000"} onChange={(e) => setCustomHex(e.target.value)} />
        <input className="hex" aria-label="Color en hexadecimal" value={customHex} maxLength={7} onChange={(e) => setCustomHex(e.target.value.trim())} />
        <button
          className="act"
          type="button"
          aria-pressed={choice?.id === "custom"}
          disabled={!/^#[0-9a-f]{6}$/i.test(customHex)}
          onClick={() => pickPalette(customChoice(paletteBase, customHex))}
        >
          Probar mi color
        </button>
      </div>
      <p className="muted">
        Contraste mínimo (WCAG, texto normal 4.5:1):{" "}
        {report.map((r, i) => (
          <span key={r.theme}>
            {i > 0 ? " · " : ""}
            {r.theme}: texto{" "}
            <span className={r.text !== null && r.text < 4.5 ? "warn" : "ok"}>{r.text?.toFixed(1) ?? "–"}:1</span>, marca{" "}
            <span className={r.brand !== null && r.brand < 4.5 ? "warn" : "ok"}>{r.brand?.toFixed(1) ?? "–"}:1</span>
          </span>
        ))}
      </p>
      {choice && (
        <div className={`conflicts${blocking ? " has" : ""}`} aria-live="polite">
          {conflicts.length === 0 ? (
            <p className="ok">✓ Sin conflictos con los estados ni con el contraste.</p>
          ) : (
            conflicts.map((c, i) => (
              <p key={i}>
                <span className={c.kind === "literal" ? "muted" : "warn"}>{c.kind === "literal" ? "•" : "⚠"} {c.text}</span>
                <br />
                <span className="muted">Solución: {c.fix}</span>
              </p>
            ))
          )}
        </div>
      )}
      <div className="row">
        <button className="act primary" type="button" disabled={!choice || !liveHere || sending} onClick={() => void proposePalette()}>
          Proponer esta paleta
        </button>
      </div>
      {!liveHere && choice && <p className="muted">Para proponerla, activá el modo en vivo: <code>/facha-ui:variants {here.slug} live</code></p>}
      {notice && <p className="muted">{notice}</p>}
      {error && <p className="error">{error}</p>}
      <p className="muted">
        Los colores escritos a mano (sin token) no cambian en la vista previa: <code>/facha-ui:init</code> te propone tokens para ellos.
      </p>
    </>
  );

  return createPortal(
    <>
      <style>{STYLES}</style>
      {open && liveHere && (picking || targets.length > 0) && (
        <div className="layer" ref={layerRef} aria-hidden="true">
          <div className="box hover" hidden>
            <span className="tag" />
          </div>
          {targets.map((t, i) => (
            <div className="box mark" data-mark={i} key={i} hidden>
              <span className="tag">[{i + 1}]</span>
            </div>
          ))}
        </div>
      )}
      <div className="wrap" ref={wrapRef} style={wrapStyle}>
        {!open ? (
          <span className="pillbox">
            <button className="pill" type="button" onClick={() => setOpen(true)} aria-expanded="false" title="Abrir el panel">
              <span className={`dot ${live.active ? "on" : ""}`} />
              facha-ui · variante {letter}
              {choice ? ` · ${choice.name}` : ""}
            </button>
            <button className="pill-x" type="button" onClick={hide} aria-label="Ocultar el panel" title="Ocultar (vuelve al recargar o con Alt+Shift+F)">
              ×
            </button>
          </span>
        ) : (
          <div
            className={`card${sized ? " sized" : ""}`}
            ref={cardRef}
            style={cardStyle}
            role="dialog"
            aria-label={`Ajustar la variante ${letter}`}
            onPointerDown={onCardPointerDown}
          >
            <div
              className="head"
              title="Arrastrá para mover · doble clic para volver a la esquina · el tamaño se ajusta desde la esquina inferior derecha"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onDoubleClick={resetLayout}
            >
              <span className="title">
                <span className="grip" aria-hidden="true">⋮⋮</span>
                Variante {letter} · {here.slug}
              </span>
              <span className="tools">
                <button className="icon" type="button" onClick={minimize} aria-label="Minimizar" title="Minimizar">–</button>
                <button className="icon" type="button" onClick={hide} aria-label="Ocultar el panel" title="Ocultar (vuelve al recargar o con Alt+Shift+F)">×</button>
              </span>
            </div>
            <div className="tabs" role="tablist">
              <button
                className="tab"
                type="button"
                role="tab"
                aria-selected={showTab === "improve"}
                onClick={() => {
                  setPicking(false);
                  setTab("improve");
                }}
              >
                Mejorar
              </button>
              <button className="tab" type="button" role="tab" aria-selected={showTab === "changes"} onClick={() => setTab("changes")}>
                Cambios
              </button>
              {paletteBase && (
                <button
                  className="tab"
                  type="button"
                  role="tab"
                  aria-selected={showTab === "palette"}
                  onClick={() => {
                    setPicking(false);
                    setTab("palette");
                  }}
                >
                  Paleta
                </button>
              )}
            </div>
            {decision && (
              <div className="decision" role="alert">
                <span className="label">Necesita tu decisión</span>
                <p className="decision-text">{decision.status.message}</p>
                {decision.status.confirmInChat ? (
                  <ChatConfirm phrase={decision.status.confirmInChat} />
                ) : (
                  <>
                    {(decision.status.options ?? []).length > 0 && (
                      <div className="decision-options">
                        {(decision.status.options ?? []).map((o) => (
                          <button
                            key={o.label}
                            className={`act${o.recommended ? " primary" : ""}`}
                            type="button"
                            disabled={sending || !liveHere}
                            onClick={() => void answer(decision, o.label)}
                          >
                            {o.label}
                            {o.recommended ? " · recomendada" : ""}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="row">
                      <input
                        className="answer"
                        value={ownAnswer}
                        maxLength={500}
                        placeholder="O escribí tu respuesta"
                        aria-label="Tu respuesta"
                        onChange={(e) => setOwnAnswer(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && ownAnswer.trim()) void answer(decision, ownAnswer.trim());
                        }}
                      />
                      <button className="act" type="button" disabled={sending || !liveHere || !ownAnswer.trim()} onClick={() => void answer(decision, ownAnswer.trim())}>
                        Responder
                      </button>
                    </div>
                    {!liveHere && <LiveOff slug={here.slug} />}
                  </>
                )}
              </div>
            )}
            <div className="body">{showTab === "palette" ? paletteTab : showTab === "improve" ? improveTab : changesTab}</div>
          </div>
        )}
      </div>
      {viewport && (
        <div
          className="device"
          role="dialog"
          aria-label={`Vista ${viewport.label}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewport(null);
          }}
        >
          <div className="device-frame">
            <div className="device-phone">
              <iframe
                key={frameKey}
                ref={deviceFrame}
                title={`Variante ${letter} en ${viewport.label}`}
                src={previewUrl()}
                onLoad={readDeviceReport}
                style={{ width: viewport.width, height: `min(${viewport.height}px, calc(100vh - 48px))` }}
              />
            </div>
            <aside className="device-side" aria-label="Lo que midió el laboratorio">
              <div className="device-head">
                <b>
                  {viewport.label} · {viewport.width} px
                </b>
                <button className="icon" type="button" onClick={() => setViewport(null)} aria-label="Cerrar la vista (Esc)">
                  ×
                </button>
              </div>
              <div className="views">
                {VIEWPORTS.map((v) => (
                  <button key={v.name} className="view" type="button" aria-pressed={viewport.name === v.name} onClick={() => setViewport(v)}>
                    {v.label} {v.width}
                  </button>
                ))}
              </div>
              {deviceFix && deviceFix.viewport === viewport.name ? (
                <div className="fix" aria-live="polite">
                  <span className="label">Tu pedido</span>
                  <ol className="steps">
                    <li className="ok">Enviado a Claude Code</li>
                    <li className={fixReq && fixReq.status.state !== "queued" ? "ok" : "now"}>
                      {fixReq?.status.state === "queued" || !fixReq ? "En cola: Claude Code lo toma en segundos" : "Tomado por Claude Code"}
                    </li>
                    <li className={fixStepClass(fixReq?.status.state)}>
                      {fixReq?.status.state === "working"
                        ? "Aplicando el arreglo…"
                        : fixReq?.status.state === "done"
                          ? `Aplicado${fixReq.status.revision ? ` · revisión ${fixReq.status.revision}` : ""}${fixReq.status.guardian ? ` · guardián ${fixReq.status.guardian.error} errores` : ""}`
                          : fixReq?.status.state === "needs-input"
                            ? "Necesita tu decisión"
                            : fixReq?.status.state === "failed"
                              ? "No se pudo aplicar"
                              : "Aplicar el arreglo"}
                    </li>
                    <li className={fixReq?.status.state === "done" ? (deviceReport ? "ok" : "now") : ""}>
                      {fixReq?.status.state === "done" && deviceReport
                        ? `Medido de nuevo: ${deviceFix.before.length} ${deviceFix.before.length === 1 ? "problema" : "problemas"} antes, ${deviceIssues.length} ahora`
                        : "Medir de nuevo en este tamaño"}
                    </li>
                  </ol>
                  {fixReq?.status.message && <p className={`issue${fixReq.status.state === "done" ? " ok" : ""}`}>{fixReq.status.message}</p>}
                  {fixReq?.status.state === "needs-input" &&
                    (fixReq.status.confirmInChat ? (
                      <ChatConfirm phrase={fixReq.status.confirmInChat} />
                    ) : (
                      <p className="muted">Respondé en el aviso «Necesita tu decisión» del panel.</p>
                    ))}
                  {fixReq?.status.state === "done" && deviceReport && deviceIssues.length > 0 && (
                    <>
                      <span className="label">Lo que sigue fallando</span>
                      {deviceIssues.map((issue, i) => (
                        <p className="issue" key={i}>
                          {issue}
                        </p>
                      ))}
                    </>
                  )}
                  <div className="row">
                    {(fixReq?.status.state === "done" || fixReq?.status.state === "failed") && deviceIssues.length > 0 && deviceReport && (
                      <button className="act primary" type="button" disabled={sending || !liveHere} onClick={() => void fixDevice()}>
                        Pedir otra vuelta
                      </button>
                    )}
                    <button className="act" type="button" onClick={() => setFrameKey((k) => k + 1)}>
                      Volver a medir
                    </button>
                    {fixReq?.status.state === "queued" || fixReq?.status.state === "working" || !fixReq ? (
                      <button
                        className="act"
                        type="button"
                        onClick={() => {
                          closeDeviceFix();
                          setViewport(null);
                          setOpen(true);
                          setTab("changes");
                        }}
                      >
                        Seguir en Cambios
                      </button>
                    ) : (
                      <button className="act" type="button" onClick={closeDeviceFix}>
                        Listo
                      </button>
                    )}
                  </div>
                </div>
              ) : !deviceReport ? (
                <p className="muted">Midiendo la página…</p>
              ) : deviceIssues.length === 0 ? (
                <p className="issue ok">Se ve bien en este tamaño: nada se sale de la pantalla, el contenido tiene el ancho, los objetivos y los textos alcanzan el mínimo.</p>
              ) : (
                <>
                  <span className="label">Lo que falla en {viewport.width} px</span>
                  {deviceIssues.map((issue, i) => (
                    <p className="issue" key={i}>
                      {issue}
                    </p>
                  ))}
                  <button className="act primary" type="button" disabled={sending || !liveHere} onClick={() => void fixDevice()}>
                    Pedir que lo arregle
                  </button>
                  {!liveHere && <LiveOff slug={here.slug} />}
                </>
              )}
              {choice && <p className="muted">La vista previa no aplica la paleta de prueba.</p>}
            </aside>
          </div>
        </div>
      )}
    </>,
    root,
  );
}
