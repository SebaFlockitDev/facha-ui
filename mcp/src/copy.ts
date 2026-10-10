import type { A11yReport } from "./a11y.js";
import type { ElementUsage, TextUsage, Usage } from "./sources/usage.js";

/**
 * Microcopy rules on the UI text written in the code: labels that do not say what they do,
 * error messages that do not say what happened or what to do, text in all caps, and, when the
 * team declares its voice in the config (copy.voice, copy.terms), words and forms of address
 * that break it. Spanish and English lexicons.
 */

export interface CopyConfig {
  voice?: "vos" | "tú" | "usted";
  terms: { use: string; avoid: string[] }[];
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[¡!¿?.,:;…"'«»()[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const VAGUE_LINKS = new Set([
  "aquí", "aqui", "acá", "aca", "click aquí", "clic aquí", "click acá", "clic acá", "haz clic aquí", "hacé clic acá", "hace clic acá",
  "haga clic aquí", "más", "mas", "leer más", "ver", "link", "enlace", "here", "click here", "more", "read more", "this link",
]);
const VAGUE_BUTTONS = new Set(["ok", "okay", "submit", "click", "click aquí", "clic aquí", "aquí", "acá", "here", "click here", "go", "ir"]);

const GENERIC_ERRORS = new Set([
  "error", "error inesperado", "ocurrió un error", "ha ocurrido un error", "hubo un error", "se produjo un error", "algo salió mal",
  "error desconocido", "something went wrong", "an error occurred", "an error has occurred", "unknown error", "unexpected error",
  "oops", "ups", "uy", "failed", "request failed", "failed to fetch", "internal server error", "bad request", "undefined", "null",
  "nan", "object object",
]);
const TECHNICAL_ERROR = /\berror\s*\d{3}\b|\bexception\b|\bstack ?trace\b|\bstatus code\b|\bstatus \d{3}\b/i;

/** Forms of address: [vos, tú, usted]. Indicative forms are checked anywhere; imperatives at the start of a sentence. */
const INDICATIVE: [string, string, string | null][] = [
  ["podés", "puedes", null], ["tenés", "tienes", null], ["querés", "quieres", null], ["debés", "debes", null],
  ["sabés", "sabes", null], ["sos", "eres", null], ["necesitás", "necesitas", null],
];
const IMPERATIVE: [string, string, string][] = [
  ["hacé", "haz", "haga"], ["ingresá", "ingresa", "ingrese"], ["seleccioná", "selecciona", "seleccione"], ["elegí", "elige", "elija"],
  ["escribí", "escribe", "escriba"], ["completá", "completa", "complete"], ["revisá", "revisa", "revise"], ["confirmá", "confirma", "confirme"],
  ["agregá", "agrega", "agregue"], ["buscá", "busca", "busque"], ["probá", "prueba", "pruebe"], ["intentá", "intenta", "intente"],
  ["volvé", "vuelve", "vuelva"], ["tocá", "toca", "toque"], ["guardá", "guarda", "guarde"], ["iniciá", "inicia", "inicie"],
  ["cerrá", "cierra", "cierre"], ["abrí", "abre", "abra"], ["subí", "sube", "suba"], ["descargá", "descarga", "descargue"],
  ["cargá", "carga", "cargue"], ["editá", "edita", "edite"], ["eliminá", "elimina", "elimine"], ["creá", "crea", "cree"],
  ["usá", "usa", "use"], ["verificá", "verifica", "verifique"], ["contactá", "contacta", "contacte"],
];
const VOICES = ["vos", "tú", "usted"] as const;

const words = (s: string) => s.toLowerCase().match(/[\p{L}]+/gu) ?? [];
/** First word of each sentence. */
const sentenceStarts = (s: string) =>
  s
    .split(/[.!?¡¿\n]+/)
    .map((part) => words(part)[0])
    .filter((w): w is string => !!w);

function voiceBreaks(text: string, voice: CopyConfig["voice"]): { found: string; expected: string } | null {
  if (!voice) return null;
  const want = VOICES.indexOf(voice);
  const all = new Set(words(text));
  const starts = new Set(sentenceStarts(text));
  if (voice !== "usted" && all.has("usted")) return { found: "usted", expected: voice };
  for (const triple of INDICATIVE) {
    for (let v = 0; v < 2; v++) {
      if (v === want || !triple[v]) continue;
      if (all.has(triple[v]!)) return { found: triple[v]!, expected: triple[want] ?? voice };
    }
  }
  for (const triple of IMPERATIVE) {
    for (let v = 0; v < 3; v++) {
      if (v === want) continue;
      if (starts.has(triple[v])) return { found: triple[v], expected: triple[want] };
    }
  }
  return null;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function checkCopy(usages: Usage[], config: CopyConfig | undefined, report: A11yReport): void {
  const terms = (config?.terms ?? []).map((t) => ({
    use: t.use,
    avoid: t.avoid.map((a) => ({ word: a, re: new RegExp(`(^|[^\\p{L}])(${escapeRe(a)})(?=$|[^\\p{L}])`, "iu") })),
  }));

  for (const u of usages) {
    if (u.kind === "element") {
      const e = u as ElementUsage;
      const isLink = e.tag === "a" && "href" in e.attrs;
      const isButton = e.tag === "button" || e.attrs.role === "button";
      if (!isLink && !isButton) continue;
      const label = normalize(e.attrs["aria-label"] && e.attrs["aria-label"] !== "{}" ? e.attrs["aria-label"] : e.text);
      if (!label) continue;
      if (isLink && VAGUE_LINKS.has(label)) {
        report("copy-vague-label", "warning", { file: e.file, line: e.line, column: e.column }, `<a> «${e.text || label}»`,
          "The link text does not say where it goes: out of context (screen readers list links alone) it means nothing (WCAG 2.4.4).",
          "Name the destination or the action: \"Ver el detalle del pago\" instead of \"Click aquí\".");
      } else if (isButton && VAGUE_BUTTONS.has(label)) {
        report("copy-vague-label", "info", { file: e.file, line: e.line, column: e.column }, `<button> «${e.text || label}»`,
          "The button does not say what it does: people hesitate before pressing it.",
          "Use a verb and its object: \"Guardar pedido\", \"Enviar recibo\".");
      }
      continue;
    }
    if (u.kind !== "text") continue;
    const t = u as TextUsage;
    const at = { file: t.file, line: t.line, column: t.column };
    const plain = normalize(t.text);

    if (GENERIC_ERRORS.has(plain) || TECHNICAL_ERROR.test(t.text)) {
      report("copy-error-text", "info", at, t.text.slice(0, 80),
        "The error message does not say what happened or what to do next, or it shows technical details to the person using the app.",
        "Say what failed in plain words and how to fix or retry it: \"No pudimos guardar el pago. Revisá tu conexión y probá de nuevo.\"");
    }

    const letters = t.text.replace(/[^\p{L}]/gu, "");
    if (!t.attr && letters.length >= 8 && words(t.text).length >= 2 && letters === letters.toUpperCase() && letters !== letters.toLowerCase()) {
      report("copy-all-caps", "info", at, t.text.slice(0, 80),
        "Text written in capitals is harder to read and sounds like shouting; screen readers may spell it out.",
        "Write it in sentence case and, if the design wants capitals, apply them with CSS (text-transform: uppercase).");
    }

    for (const term of terms) {
      for (const a of term.avoid) {
        const m = t.text.match(a.re);
        if (!m) continue;
        report("copy-term", "warning", at, m[2]!,
          `"${m[2]}" is not the product's word for this (copy.terms).`,
          `Use "${term.use}", as the team decided, so the same thing has the same name everywhere.`);
      }
    }

    const broken = voiceBreaks(t.text, config?.voice);
    if (broken) {
      report("copy-voice", "warning", at, broken.found,
        `"${broken.found}" breaks the product's form of address (copy.voice = ${config!.voice}).`,
        `Use the ${config!.voice} form${broken.expected !== config!.voice ? `: "${broken.expected}"` : ""}, so the whole product speaks with one voice.`);
    }
  }
}
