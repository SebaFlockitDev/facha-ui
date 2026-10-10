"use client";
// facha-ui lab scaffold · responsive check · removed by /facha-ui:apply when no runs remain
import { useEffect, useState } from "react";

/**
 * With ?check=responsive, measures the rendered page and shows the result in a status box that
 * captures and accessibility snapshots can read (Playwright needs no script for it):
 * - horizontal overflow of the page, and the outermost elements wider than the screen (or
 *   clipped by a container with overflow: hidden);
 * - interactive targets smaller than 24×24 px (WCAG 2.5.8; inline links in text are exempt);
 * - text smaller than 12px.
 * The live panel uses it too, inside its mobile and tablet previews.
 */

export interface ResponsiveReport {
  width: number;
  overflow: number;
  /** Width left for the main content, and the side columns that take the rest (when it is under 75%). */
  content: { width: number; squeezedBy: { element: string; width: number }[] } | null;
  offenders: { element: string; width: number; clipped: boolean }[];
  smallTargets: { element: string; width: number; height: number }[];
  tinyText: { element: string; px: number }[];
}

const TARGETS = "a[href], button, [role='button'], input[type='checkbox'], input[type='radio'], select, summary";

function describe(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (el.id) return `${tag}#${el.id}`;
  const cls = Array.from(el.classList).find((c) => !c.includes(":"));
  const text = (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 24);
  return `${tag}${cls ? `.${cls}` : ""}${text ? ` «${text}»` : ""}`;
}

function inScroller(el: Element): boolean {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const s = getComputedStyle(p);
    if (/(auto|scroll)/.test(s.overflowX) && p.scrollWidth > p.clientWidth) return true;
  }
  return false;
}

function clippedBy(el: Element, vw: number): boolean {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    if (/(hidden|clip)/.test(getComputedStyle(p).overflowX) && p.getBoundingClientRect().right <= vw + 1) return true;
  }
  return false;
}

export function measureResponsive(): ResponsiveReport {
  const vw = document.documentElement.clientWidth;
  const overflow = Math.max(0, document.documentElement.scrollWidth - vw);
  const all = Array.from(document.body.querySelectorAll("*")).filter((el) => !el.closest("[data-facha-ui]"));

  const wide = all.filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.right > vw + 1 && !inScroller(el);
  });
  // Keep only the outermost: a child of a reported element adds nothing.
  const outermost = wide.filter((el) => !wide.some((other) => other !== el && other.contains(el)));
  const offenders = outermost.slice(0, 8).map((el) => ({
    element: describe(el),
    width: Math.round(el.getBoundingClientRect().width),
    clipped: clippedBy(el, vw),
  }));

  const smallTargets = Array.from(document.querySelectorAll(TARGETS))
    .filter((el) => !el.closest("[data-facha-ui]"))
    .filter((el) => !(el.tagName === "A" && el.parentElement && /^(P|LI|SPAN|TD)$/.test(el.parentElement.tagName) && (el.parentElement.textContent ?? "").trim().length > (el.textContent ?? "").trim().length + 10))
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ el, r }) => r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden" && (r.width < 24 || r.height < 24))
    .slice(0, 6)
    .map(({ el, r }) => ({ element: describe(el), width: Math.round(r.width), height: Math.round(r.height) }));

  const tinyText = all
    .filter((el) => Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim()))
    .map((el) => ({ el, px: parseFloat(getComputedStyle(el).fontSize) }))
    .filter(({ el, px }) => px < 12 && el.getBoundingClientRect().width > 0)
    .slice(0, 6)
    .map(({ el, px }) => ({ element: describe(el), px: Math.round(px * 10) / 10 }));

  // A side column that never collapses leaves the main content a sliver of the screen.
  const main = document.querySelector("main, [role='main']");
  let content: ResponsiveReport["content"] = null;
  if (main) {
    const width = Math.round(main.getBoundingClientRect().width);
    if (width < vw * 0.75) {
      const squeezedBy = Array.from(document.querySelectorAll("aside, nav, [role='navigation'], [role='complementary']"))
        .filter((el) => !el.closest("[data-facha-ui]") && !main.contains(el))
        .map((el) => ({ element: describe(el), width: Math.round(el.getBoundingClientRect().width) }))
        .filter((s) => s.width > vw * 0.2)
        .slice(0, 3);
      content = { width, squeezedBy };
    }
  }

  return { width: vw, overflow, content, offenders, smallTargets, tinyText };
}

/** One line per finding, the same text for the status box and the run JSON. */
export function summarize(r: ResponsiveReport): string[] {
  const lines = [`facha-ui responsive · ${r.width}px · desborde horizontal: ${r.overflow}px`];
  if (r.content) {
    const by = r.content.squeezedBy.map((s) => `${s.element} (${s.width}px)`).join(", ");
    lines.push(`Contenido principal: ${r.content.width}px de ${r.width}px${by ? `; lo ocupa ${by}` : ""}`);
  }
  lines.push(
    r.offenders.length
      ? `Más anchos que la pantalla: ${r.offenders.map((o) => `${o.element} (${o.width}px${o.clipped ? ", recortado" : ""})`).join(", ")}`
      : "Nada más ancho que la pantalla",
  );
  lines.push(
    r.smallTargets.length
      ? `Objetivos de menos de 24px: ${r.smallTargets.map((t) => `${t.element} (${t.width}×${t.height})`).join(", ")}`
      : "Objetivos táctiles de al menos 24px",
  );
  lines.push(
    r.tinyText.length ? `Texto de menos de 12px: ${r.tinyText.map((t) => `${t.element} (${t.px}px)`).join(", ")}` : "Texto de al menos 12px",
  );
  return lines;
}

export function LabResponsive() {
  const [report, setReport] = useState<ResponsiveReport | null>(null);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("check") !== "responsive") return;
    // Inside the panel's preview, phones' overlay scrollbars take no width: emulate them.
    let noScrollbar: HTMLStyleElement | null = null;
    if (window.self !== window.top) {
      noScrollbar = document.createElement("style");
      noScrollbar.setAttribute("data-facha-ui", "preview-scrollbar");
      noScrollbar.textContent = "html { scrollbar-width: none; } html::-webkit-scrollbar { display: none; }";
      document.head.appendChild(noScrollbar);
    }
    const run = () => setReport(measureResponsive());
    const first = window.setTimeout(run, 800); // after data and fonts settle
    window.addEventListener("resize", run);
    return () => {
      window.clearTimeout(first);
      window.removeEventListener("resize", run);
      noScrollbar?.remove();
    };
  }, []);
  if (!report) return null;
  const ok = report.overflow === 0 && !report.content && report.offenders.length === 0 && report.smallTargets.length === 0 && report.tinyText.length === 0;
  return (
    <div
      role="status"
      aria-label="facha-ui responsive check"
      data-facha-ui="responsive-check"
      style={{
        position: "fixed",
        left: 8,
        bottom: 8,
        maxWidth: "calc(100vw - 16px)",
        zIndex: 2147482998,
        background: "#161a25",
        color: "#e8eaf2",
        border: `2px solid ${ok ? "#4fd17f" : "#ff8a4c"}`,
        borderRadius: 10,
        padding: "8px 10px",
        font: "12px/1.45 system-ui, -apple-system, 'Segoe UI', sans-serif",
      }}
    >
      {summarize(report).map((line, i) => (
        <div key={i} style={i === 0 ? { fontWeight: 700 } : undefined}>
          {line}
        </div>
      ))}
    </div>
  );
}
