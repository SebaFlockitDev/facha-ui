// facha-ui lab scaffold (Vite) · compare variants · removed by /facha-ui:apply when no runs remain
import { useEffect, useRef, useState } from "react";
import { THEMES } from "./lab-theme";

/**
 * /facha-lab/?compare=<screen>: the variants of a run side by side, with the same real data, at
 * the same width, theme and state, with optional synced scroll. The run (objective, hypotheses,
 * status) is read from .facha-ui/runs/<screen>.json when the lab sits at the project root. Team
 * votes need live mode, which in Vite comes in a later version. This page is facha-ui's own UI:
 * its styles are its own, not the project's design system.
 */

interface Variant {
  id: string;
  hypothesis?: string;
  status?: string;
  revision?: number;
}
interface Run {
  objective?: string;
  variants?: Variant[];
}

const RUNS = import.meta.glob<{ default: Run }>("../.facha-ui/runs/*.json", { eager: true });

const WIDTHS = [
  { name: "desktop", label: "Escritorio", width: 1440 },
  { name: "tablet", label: "Tablet", width: 768 },
  { name: "mobile", label: "Móvil", width: 375 },
] as const;
const STATES = [
  { value: "", label: "Datos reales" },
  { value: "loading", label: "Cargando" },
  { value: "empty", label: "Vacío" },
  { value: "error", label: "Error" },
  { value: "long", label: "Datos extremos" },
];

const STYLES = `
.fu { box-sizing: border-box; min-height: 100vh; padding: 16px; background: #0e1119; color: #e8eaf2; font: 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
.fu * { box-sizing: border-box; }
.fu h1 { font-size: 20px; margin: 0; }
.fu .muted { color: #9ba2b8; font-size: 13px; margin: 0; }
.fu .bar { display: flex; flex-wrap: wrap; gap: 12px 20px; align-items: center; margin: 12px 0 16px; }
.fu .group { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.fu button, .fu select, .fu input { font: inherit; color: #e8eaf2; background: #161a25; border: 1px solid #3a4256; border-radius: 9px; padding: 6px 10px; }
.fu button { cursor: pointer; }
.fu button[aria-pressed="true"] { border-color: #ff8a4c; }
.fu button:focus-visible, .fu select:focus-visible, .fu input:focus-visible { outline: 2px solid #ff8a4c; outline-offset: 2px; }
.fu .cols { display: grid; gap: 14px; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); }
@media (max-width: 900px) { .fu .cols { grid-template-columns: 1fr; } }
.fu .col { display: grid; gap: 8px; min-width: 0; align-content: start; }
.fu .head { display: grid; gap: 2px; }
.fu .head b { font-size: 15px; }
.fu .badge { justify-self: start; font-size: 12px; border-radius: 999px; padding: 1px 8px; border: 1px solid #3a4256; }
.fu .badge.failed { border-color: #ff7b72; color: #ff7b72; }
.fu .frame { position: relative; overflow: hidden; border: 1px solid #3a4256; border-radius: 12px; background: #ffffff; }
.fu .frame iframe { position: absolute; top: 0; left: 0; border: 0; transform-origin: 0 0; }
.fu a { color: #7ea8ff; }
`;

export function CompareVariants({ slug, variants: ids }: { slug: string; variants: string[] }) {
  const run = Object.entries(RUNS).find(([k]) => k.endsWith(`/${slug}.json`))?.[1].default;
  const variants: Variant[] = ids.map((id) => run?.variants?.find((v) => v.id === id) ?? { id });
  const [width, setWidth] = useState<(typeof WIDTHS)[number]>(WIDTHS[0]);
  const [theme, setTheme] = useState("");
  const [state, setState] = useState("");
  const [sync, setSync] = useState(true);
  const [colWidth, setColWidth] = useState(400);
  const [frameHeight] = useState(() => Math.round(Math.max(420, window.innerHeight * 0.68)));
  const colRef = useRef<HTMLDivElement>(null);
  const frames = useRef<Map<string, HTMLIFrameElement>>(new Map());
  const syncing = useRef(false);

  // Scale each frame to its column, so every variant is seen at the same real width.
  useEffect(() => {
    const el = colRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setColWidth(el.getBoundingClientRect().width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [variants.length]);

  const scale = Math.min(1, colWidth / width.width);
  const urlOf = (id: string) => {
    const params = new URLSearchParams({ screen: slug, v: id });
    if (theme) params.set("theme", theme);
    if (state) params.set("state", state);
    return `?${params.toString()}`;
  };

  // Synced scroll: scrolling one variant scrolls the others to the same relative position.
  const onFrameLoad = (id: string) => {
    const win = frames.current.get(id)?.contentWindow;
    if (!win) return;
    win.addEventListener("scroll", () => {
      if (!sync || syncing.current) return;
      const doc = win.document.documentElement;
      const ratio = doc.scrollHeight > win.innerHeight ? win.scrollY / (doc.scrollHeight - win.innerHeight) : 0;
      syncing.current = true;
      for (const [other, f] of frames.current) {
        if (other === id || !f.contentWindow) continue;
        const d = f.contentWindow.document.documentElement;
        f.contentWindow.scrollTo(0, ratio * Math.max(0, d.scrollHeight - f.contentWindow.innerHeight));
      }
      window.requestAnimationFrame(() => (syncing.current = false));
    });
  };

  return (
    <main className="fu">
      <style>{STYLES}</style>
      <h1>Comparar variantes · {slug}</h1>
      {run?.objective ? <p className="muted">Objetivo: {run.objective}</p> : null}
      {variants.length === 0 && <p className="muted">No hay variantes de esta pantalla en el laboratorio.</p>}

      <div className="bar">
        <div className="group" role="group" aria-label="Ancho">
          {WIDTHS.map((w) => (
            <button key={w.name} type="button" aria-pressed={width.name === w.name} onClick={() => setWidth(w)}>
              {w.label} {w.width}
            </button>
          ))}
        </div>
        <label className="group">
          Tema
          <select value={theme} onChange={(e) => setTheme(e.target.value)}>
            <option value="">Por defecto</option>
            {Object.keys(THEMES).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="group">
          Estado
          <select value={state} onChange={(e) => setState(e.target.value)}>
            {STATES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="group">
          <input type="checkbox" checked={sync} onChange={(e) => setSync(e.target.checked)} /> Scroll sincronizado
        </label>
      </div>

      <div className="cols" style={{ ["--n" as string]: Math.max(1, variants.length) }}>
        {variants.map((v, i) => (
          <div className="col" key={v.id} ref={i === 0 ? colRef : undefined}>
            <div className="head">
              <b>
                Variante {v.id.toUpperCase()}
                {v.revision ? ` · r${v.revision}` : ""}
              </b>
              {v.hypothesis && <span className="muted">{v.hypothesis}</span>}
              {v.status && <span className={`badge ${v.status}`}>{v.status === "failed" ? "No pasó el guardián" : "Válida"}</span>}
            </div>
            <div className="frame" style={{ height: frameHeight }}>
              <iframe
                title={`Variante ${v.id.toUpperCase()}`}
                src={urlOf(v.id)}
                ref={(el) => {
                  if (el) frames.current.set(v.id, el);
                  else frames.current.delete(v.id);
                }}
                onLoad={() => onFrameLoad(v.id)}
                style={{ width: width.width, height: Math.round(frameHeight / scale), transform: `scale(${scale})` }}
              />
            </div>
            <a href={urlOf(v.id)} target="_blank" rel="noreferrer">
              Abrir sola
            </a>
          </div>
        ))}
      </div>
      <p className="muted" style={{ marginTop: 16 }}>Los votos del equipo usan el modo en vivo, que en Vite llega en una próxima versión.</p>
    </main>
  );
}
