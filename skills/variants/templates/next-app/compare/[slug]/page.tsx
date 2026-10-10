"use client";
// facha-ui lab scaffold · compare variants · removed by /facha-ui:apply when no runs remain
import { useCallback, useEffect, useRef, useState } from "react";
import { THEMES } from "../../lab-theme";

/**
 * /lab/compare/<screen>: the variants of a run side by side, with the same real data, at the
 * same width, theme and state, with optional synced scroll. With live mode on, each person can
 * vote for a variant with a reason; /facha-ui:apply shows the votes in its plan. This page is
 * facha-ui's own UI: its styles are its own, not the project's design system.
 */

/** URL prefix of the lab routes, filled by /facha-ui:variants from project.lab.urlPattern. */
const LAB_BASE = "/lab"; /*__LAB_BASE__*/

const NAME_KEY = "facha-ui-lab-voter";
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

interface Variant {
  id: string;
  hypothesis: string;
  status: string;
  revision: number;
}
interface Vote {
  id: string;
  at: string;
  voter: string;
  variant: string;
  reason: string;
}
interface CompareState {
  active: boolean;
  token?: string;
  slug?: string;
  run?: { slug: string; objective: string; status: string; variants: Variant[] } | null;
  votes?: Vote[];
}

const CSS = `
.fu { box-sizing: border-box; min-height: 100vh; padding: 16px; background: #0e1119; color: #e8eaf2; font: 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
.fu * { box-sizing: border-box; }
.fu h1 { font-size: 20px; margin: 0; }
.fu .muted { color: #9ba2b8; font-size: 13px; margin: 0; }
.fu .bar { display: flex; flex-wrap: wrap; gap: 12px 20px; align-items: center; margin: 12px 0 16px; }
.fu .group { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.fu button, .fu select, .fu input, .fu textarea { font: inherit; color: #e8eaf2; background: #161a25; border: 1px solid #3a4256; border-radius: 9px; padding: 6px 10px; }
.fu button { cursor: pointer; }
.fu button[aria-pressed="true"] { border-color: #ff8a4c; }
.fu button.primary { background: #e8eaf2; color: #0e1119; border-color: #e8eaf2; font-weight: 600; }
.fu button:focus-visible, .fu select:focus-visible, .fu input:focus-visible, .fu textarea:focus-visible { outline: 2px solid #ff8a4c; outline-offset: 2px; }
.fu .cols { display: grid; gap: 14px; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); }
@media (max-width: 900px) { .fu .cols { grid-template-columns: 1fr; } }
.fu .col { display: grid; gap: 8px; min-width: 0; align-content: start; }
.fu .head { display: grid; gap: 2px; }
.fu .head b { font-size: 15px; }
.fu .badge { justify-self: start; font-size: 12px; border-radius: 999px; padding: 1px 8px; border: 1px solid #3a4256; }
.fu .badge.failed { border-color: #ff7b72; color: #ff7b72; }
.fu .frame { position: relative; overflow: hidden; border: 1px solid #3a4256; border-radius: 12px; background: #ffffff; }
.fu .frame iframe { position: absolute; top: 0; left: 0; border: 0; transform-origin: 0 0; }
.fu .count { color: #4fd17f; font-weight: 600; font-size: 13px; }
.fu .votes { display: grid; gap: 10px; margin-top: 20px; max-width: 760px; }
.fu .vote-form { display: grid; gap: 8px; }
.fu .vote-form textarea { min-height: 60px; resize: vertical; }
.fu .vote { border: 1px solid #272d3d; border-radius: 10px; padding: 8px 10px; }
.fu .error { color: #ff7b72; }
.fu a { color: #7ea8ff; }
`;

function slugFromPath(): string | null {
  const rest = window.location.pathname.replace(/\/+$/, "").slice(`${LAB_BASE}/compare/`.length);
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rest) ? rest : null;
}

function loadName(): string {
  try {
    return window.localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export default function CompareVariants() {
  const [slug, setSlug] = useState<string | null>(null);
  const [data, setData] = useState<CompareState>({ active: false });
  const [width, setWidth] = useState<(typeof WIDTHS)[number]>(WIDTHS[0]);
  const [theme, setTheme] = useState("");
  const [state, setState] = useState("");
  const [sync, setSync] = useState(true);
  const [colWidth, setColWidth] = useState(400);
  const [voter, setVoter] = useState("");
  const [choice, setChoice] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const colRef = useRef<HTMLDivElement>(null);
  const frames = useRef<Map<string, HTMLIFrameElement>>(new Map());
  const syncing = useRef(false);

  const [frameHeight, setFrameHeight] = useState(560);

  useEffect(() => {
    setSlug(slugFromPath());
    setVoter(loadName());
    setFrameHeight(Math.round(Math.max(420, window.innerHeight * 0.68)));
  }, []);

  const refresh = useCallback(async () => {
    if (!slug) return;
    try {
      const res = await fetch(`${LAB_BASE}/facha-live?run=${slug}`, { cache: "no-store" });
      if (res.ok) setData((await res.json()) as CompareState);
    } catch {
      /* the dev server is restarting */
    }
  }, [slug]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(id);
  }, [refresh]);

  // Scale each frame to its column, so every variant is seen at the same real width.
  useEffect(() => {
    const el = colRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setColWidth(el.getBoundingClientRect().width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [data.run?.variants.length]);

  const variants = data.run?.variants ?? [];
  const scale = Math.min(1, colWidth / width.width);

  const urlOf = (id: string) => {
    const params = new URLSearchParams();
    if (theme) params.set("theme", theme);
    if (state) params.set("state", state);
    const q = params.toString();
    return `${LAB_BASE}/${slug}/${id}${q ? `?${q}` : ""}`;
  };

  // Synced scroll: scrolling one variant scrolls the others to the same relative position.
  const onFrameLoad = (id: string) => {
    const frame = frames.current.get(id);
    const win = frame?.contentWindow;
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

  const vote = async () => {
    if (!slug || !data.token) return;
    setSending(true);
    setError(null);
    try {
      try {
        window.localStorage.setItem(NAME_KEY, voter);
      } catch {
        /* storage blocked: the name is asked again next time */
      }
      const res = await fetch(`${LAB_BASE}/facha-live`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: data.token, kind: "vote", slug, variant: choice, voter, text: reason }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Error ${res.status}`);
        return;
      }
      setReason("");
      await refresh();
    } finally {
      setSending(false);
    }
  };

  const votes = data.votes ?? [];
  const count = (id: string) => votes.filter((v) => v.variant === id).length;
  const canVote = data.active && data.slug === slug;

  return (
    <main className="fu">
      <style>{CSS}</style>
      <h1>Comparar variantes · {slug ?? "…"}</h1>
      {data.run ? (
        <p className="muted">Objetivo: {data.run.objective}</p>
      ) : (
        <p className="muted">No hay un run para esta pantalla. Generá variantes con /facha-ui:variants.</p>
      )}

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
              <span className="muted">{v.hypothesis}</span>
              <span className={`badge ${v.status}`}>{v.status === "failed" ? "No pasó el guardián" : "Válida"}</span>
              {count(v.id) > 0 && <span className="count">{count(v.id)} voto{count(v.id) === 1 ? "" : "s"}</span>}
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

      <section className="votes" aria-labelledby="votes-title">
        <h2 id="votes-title" style={{ fontSize: 16, margin: 0 }}>
          Votos del equipo
        </h2>
        {canVote ? (
          <div className="vote-form">
            <label className="group">
              Tu nombre <input value={voter} maxLength={40} onChange={(e) => setVoter(e.target.value)} />
            </label>
            <div className="group" role="radiogroup" aria-label="Variante">
              {variants
                .filter((v) => v.status !== "failed")
                .map((v) => (
                  <button key={v.id} type="button" aria-pressed={choice === v.id} onClick={() => setChoice(v.id)}>
                    {v.id.toUpperCase()}
                  </button>
                ))}
            </div>
            <label className="vote-form">
              ¿Por qué esa? (lo leen el equipo y Claude Code al aplicar)
              <textarea value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
            </label>
            <div>
              <button className="primary" type="button" disabled={sending || !voter.trim() || !choice || !reason.trim()} onClick={() => void vote()}>
                Votar
              </button>
            </div>
            {error && <p className="error">{error}</p>}
          </div>
        ) : (
          <p className="muted">Para votar, activá el modo en vivo en Claude Code: /facha-ui:variants {slug} live</p>
        )}
        {votes.length > 0 ? (
          [...votes].reverse().map((v) => (
            <div className="vote" key={v.id}>
              <b>{v.voter}</b> votó por la <b>{v.variant.toUpperCase()}</b>: {v.reason}
            </div>
          ))
        ) : (
          <p className="muted">Todavía no hay votos.</p>
        )}
      </section>
    </main>
  );
}
