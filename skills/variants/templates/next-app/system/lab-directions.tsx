"use client";
// facha-ui lab · direction preview · removed by /facha-ui:init system once the system is written
import { useEffect, useRef, useState } from "react";
import { THEMES } from "../lab-theme";

/**
 * The directions of /facha-ui:init system side by side (B-026, SPEC §2.h): the same page (the
 * specimen or the copy of a real screen) once per direction, at the same real width, in any theme,
 * with synced scroll. The directions and the page come from the URL: ?d=<id>,<id>&page=<page>.
 * facha-ui's own UI: its styles are its own and never part of the project's design.
 */

const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const WIDTHS = [
  { label: "Escritorio", width: 1440 },
  { label: "Tablet", width: 768 },
  { label: "Celular", width: 375 },
] as const;

const STYLES = `
.fd { font: 13px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; color: #e8eaf2; background: #10131b; min-height: 100vh; padding: 16px; box-sizing: border-box; }
.fd header { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 12px; }
.fd h1 { font-size: 16px; margin: 0 12px 0 0; }
.fd select, .fd label { font: inherit; color: inherit; }
.fd select { background: #161a25; border: 1px solid #3a4256; border-radius: 6px; padding: 4px 8px; }
.fd .cols { display: grid; gap: 12px; }
.fd .col { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.fd .frame { overflow: hidden; border: 1px solid #272d3d; border-radius: 8px; background: #fff; }
.fd iframe { border: 0; transform-origin: 0 0; display: block; }
.fd a { color: #7ea8ff; }
.fd .muted { color: #9ba2b8; }
`;

export function LabDirections({ url }: { url: (page: string, direction: string, theme: string) => string }) {
  const [ids, setIds] = useState<string[]>([]);
  const [page, setPage] = useState("specimen");
  const [theme, setTheme] = useState("");
  const [width, setWidth] = useState<(typeof WIDTHS)[number]>(WIDTHS[0]);
  const [colWidth, setColWidth] = useState(400);
  const [sync, setSync] = useState(true);
  const colRef = useRef<HTMLDivElement>(null);
  const frames = useRef<Map<string, HTMLIFrameElement>>(new Map());
  const syncing = useRef(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setIds((q.get("d") ?? "").split(",").filter((d) => NAME.test(d)).slice(0, 5));
    const p = q.get("page") ?? "specimen";
    if (NAME.test(p)) setPage(p);
  }, []);

  useEffect(() => {
    const el = colRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setColWidth(el.getBoundingClientRect().width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ids.length]);

  const scale = Math.min(1, colWidth / width.width);
  const height = 640;

  // Synced scroll: scrolling one direction scrolls the others to the same relative position.
  const onLoad = (id: string) => {
    const win = frames.current.get(id)?.contentWindow;
    if (!win) return;
    win.addEventListener("scroll", () => {
      if (!sync || syncing.current) return;
      const max = win.document.documentElement.scrollHeight - win.innerHeight;
      const ratio = max > 0 ? win.scrollY / max : 0;
      syncing.current = true;
      for (const [other, frame] of frames.current) {
        if (other === id || !frame.contentWindow) continue;
        const w = frame.contentWindow;
        w.scrollTo(0, ratio * (w.document.documentElement.scrollHeight - w.innerHeight));
      }
      window.setTimeout(() => (syncing.current = false), 50);
    });
  };

  return (
    <div className="fd">
      <style>{STYLES}</style>
      <header>
        <h1>Direcciones del sistema</h1>
        <span className="muted">Página: {page === "specimen" ? "muestra" : page}</span>
        <select aria-label="Ancho" value={width.width} onChange={(e) => setWidth(WIDTHS.find((w) => w.width === Number(e.target.value)) ?? WIDTHS[0])}>
          {WIDTHS.map((w) => (
            <option key={w.width} value={w.width}>
              {w.label} ({w.width}px)
            </option>
          ))}
        </select>
        <select aria-label="Tema" value={theme} onChange={(e) => setTheme(e.target.value)}>
          <option value="">Tema por defecto</option>
          {Object.keys(THEMES).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <label>
          <input type="checkbox" checked={sync} onChange={(e) => setSync(e.target.checked)} /> Scroll sincronizado
        </label>
      </header>
      {ids.length === 0 ? (
        <p>No hay direcciones en la URL: abrila desde el enlace que te dio Claude Code (?d=…&amp;page=…).</p>
      ) : (
        <div className="cols" style={{ gridTemplateColumns: `repeat(${ids.length}, minmax(0, 1fr))` }}>
          {ids.map((id, i) => (
            <div key={id} className="col" ref={i === 0 ? colRef : undefined}>
              <b>{id}</b>
              <div className="frame" style={{ height }}>
                <iframe
                  title={`Dirección ${id}`}
                  src={url(page, id, theme)}
                  ref={(el) => {
                    if (el) frames.current.set(id, el);
                    else frames.current.delete(id);
                  }}
                  onLoad={() => onLoad(id)}
                  style={{ width: width.width, height: Math.round(height / scale), transform: `scale(${scale})` }}
                />
              </div>
              <a href={url(page, id, theme)} target="_blank" rel="noreferrer">
                Abrir sola
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
