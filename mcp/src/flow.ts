import type { Context } from "./context.js";
import { extractFile } from "./context.js";
import { readSource, rel, resolveUserPath } from "./project.js";
import { reviewUi, withoutComments } from "./review.js";
import type { ElementUsage } from "./sources/usage.js";
import { FachaError, type Severity } from "./types.js";

/**
 * review_flow: signals of a journey across screens (create → confirm → done): the same action
 * named differently, destructive actions without a confirmation, forms without a way out,
 * actions without visible feedback, submissions without an error state, and steps without a
 * clear next step. Deterministic heuristics over the code of each step; the critique over the
 * captures belongs to /facha-ui:flow.
 */

export interface FlowFinding {
  heuristic: "wording" | "destructive" | "exit" | "feedback" | "errors" | "next-step";
  severity: Severity;
  steps: number[];
  evidence: string;
  why: string;
  fix: string;
}

/** Synonyms that should not coexist in one product: the first word names the group. */
const SYNONYMS: string[][] = [
  ["guardar", "grabar", "salvar", "save", "store"],
  ["eliminar", "borrar", "quitar", "suprimir", "delete", "remove", "erase"],
  ["crear", "agregar", "añadir", "nuevo", "nueva", "alta", "add", "create", "new"],
  ["editar", "modificar", "cambiar", "edit", "modify", "change"],
  ["enviar", "mandar", "send", "submit"],
  ["cancelar", "descartar", "cancel", "discard"],
  ["volver", "atrás", "regresar", "back", "return"],
  ["confirmar", "aceptar", "confirm", "accept"],
];
const DESTRUCTIVE = /\b(eliminar|borrar|quitar|dar de baja|desactivar|anular|cancelar (el|la|suscripci)|delete|remove|deactivate|revoke)\b/i;
const CONFIRMS = /\bconfirm\s*\(|¿[^?]*(seguro|segura|eliminar|borrar)|are you sure|<\w*(Modal|Dialog|Confirm)\b|role=["']alertdialog["']|deshacer|undo/i;
const FEEDBACK = /guardad|cread[oa]|enviad[oa]|actualizad[oa]|eliminad[oa]|listo|éxito|exito|success|saved|created|toast|notif|role=["']status["']|aria-live/i;
const ERROR_STATE = /\b[eE]rror\b|role=["']alert["']|\bcatch\s*\(/;
const EXIT = /\b(cancelar|volver|atrás|cerrar|descartar|cancel|back|close|discard)\b/i;

const first = (s: string) => (s.toLowerCase().match(/[\p{L}]+/u)?.[0] ?? "");
const isAction = (e: ElementUsage) => e.tag === "button" || (e.tag === "a" && "href" in e.attrs) || e.attrs.role === "button";

export function reviewFlow(ctx: Context, inputs: string[]) {
  if (inputs.length < 2) throw new FachaError("PATH_NOT_FOUND", "A flow needs at least two steps (screen files, in order).", { paths: inputs });
  const steps = inputs.map((input, i) => {
    const { abs, isDir } = resolveUserPath(ctx.project, input);
    if (isDir) throw new FachaError("UNSUPPORTED_FILE", `Step ${i + 1} must be a file, not a directory: ${input}`, { path: input });
    const file = rel(ctx.project, abs);
    const source = withoutComments(readSource(abs) ?? "");
    const { usages } = extractFile(ctx, abs);
    const elements = usages.filter((u): u is ElementUsage => u.kind === "element");
    const actions = elements.filter(isAction).map((e) => ({ label: (e.attrs["aria-label"] && e.attrs["aria-label"] !== "{}" ? e.attrs["aria-label"] : e.text).trim(), line: e.line }));
    const title =
      elements.find((e) => /^h[1-3]$/.test(e.tag) && e.text)?.text ??
      source.match(/<[A-Z][\w.]*[^>]*\btitle=["']([^"']+)["']/)?.[1] ??
      null;
    const submits = /onSubmit=|type=["']submit["']/.test(source);
    const hasForm = submits || elements.some((e) => e.tag === "form" || e.tag === "input" || e.tag === "select" || e.tag === "textarea");
    const review = reviewUi(ctx, file).files[0];
    return {
      step: i + 1,
      file,
      title,
      actions: actions.filter((a) => a.label),
      primaryActions: review?.primaryActions.length ?? 0,
      hasForm,
      submits,
      destructive: actions.filter((a) => DESTRUCTIVE.test(a.label)).map((a) => a.label),
      confirms: CONFIRMS.test(source),
      feedback: FEEDBACK.test(source),
      errorState: ERROR_STATE.test(source),
      exit: actions.some((a) => EXIT.test(a.label)) || /router\.back\(|history\.back\(/.test(source),
    };
  });

  const findings: FlowFinding[] = [];

  // The same action named differently across the flow.
  for (const group of SYNONYMS) {
    const used = new Map<string, number[]>();
    for (const s of steps) for (const a of s.actions) {
      const verb = first(a.label);
      if (group.includes(verb)) used.set(verb, [...new Set([...(used.get(verb) ?? []), s.step])]);
    }
    if (used.size > 1) {
      const list = [...used.entries()].map(([w, st]) => `"${w}" (step ${st.join(", ")})`).join(", ");
      findings.push({
        heuristic: "wording", severity: "warning", steps: [...new Set([...used.values()].flat())].sort((a, b) => a - b),
        evidence: `the same action is named ${list}`,
        why: "Different words for one action make people wonder whether they do different things.",
        fix: `Pick one word for this action in the whole flow (and add it to copy.terms so the guardian keeps it).`,
      });
    }
  }

  for (const s of steps) {
    if (s.destructive.length && !s.confirms) {
      findings.push({
        heuristic: "destructive", severity: "warning", steps: [s.step],
        evidence: `"${s.destructive[0]}" with no confirmation or undo in ${s.file}`,
        why: "A destructive action without confirmation or undo turns a slip into lost data.",
        fix: "Ask for confirmation naming what will be lost (\"¿Eliminar el pedido 1042?\"), or offer undo right after.",
      });
    }
    if (s.submits && !s.exit) {
      findings.push({
        heuristic: "exit", severity: "info", steps: [s.step],
        evidence: `a form with no cancel or back action in ${s.file}`,
        why: "Without a way out, people use the browser's back button and may lose what they typed.",
        fix: "Add a secondary \"Cancelar\" or \"Volver\" next to the primary action.",
      });
    }
    if (s.submits && !s.feedback) {
      findings.push({
        heuristic: "feedback", severity: "info", steps: [s.step],
        evidence: `the form submits with no visible confirmation in ${s.file}`,
        why: "Without feedback, people do not know whether it worked and try again (duplicates).",
        fix: "Confirm the result in place (a status message or toast that says what happened) or move to a screen that shows it.",
      });
    }
    if (s.submits && !s.errorState) {
      findings.push({
        heuristic: "errors", severity: "info", steps: [s.step],
        evidence: `the form submits with no error state in ${s.file}`,
        why: "When it fails, the person is left with nothing to do, or loses what they typed.",
        fix: "Show what failed next to the field or above the form, keep the data, and say how to retry.",
      });
    }
    if (s.actions.length > 0 && s.primaryActions === 0 && s.step < steps.length) {
      findings.push({
        heuristic: "next-step", severity: "info", steps: [s.step],
        evidence: `no primary action in step ${s.step} (${s.file})`,
        why: "Without a primary action, the next step of the flow does not stand out.",
        fix: "Make the action that moves the flow forward the primary one (the project's primary button class).",
      });
    }
  }

  return {
    configSource: ctx.project.configSource,
    steps,
    findings,
    summary: { steps: steps.length, warning: findings.filter((f) => f.severity === "warning").length, info: findings.filter((f) => f.severity === "info").length },
    notes: [
      "Signals from the code of each step, not rules: confirm them on the captures and by walking the flow.",
      "Steps reached only after an action (a modal, a success screen) are not captured automatically: describe them or capture them by hand.",
    ],
  };
}
