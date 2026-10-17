"use client";
// facha-ui lab scaffold · the facha-ui center · removed by /facha-ui:apply when no runs remain
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * The facha-ui center (B-042): one page to use facha-ui without remembering commands. It shows how
 * the project is doing, its screens from worst to best with "Proponer variantes" (a goal and a
 * reference image dropped or a URL), the runs in progress and the design system. Claude Code listens
 * behind it (/facha-ui:center). What changes the code (/facha-ui:init, /facha-ui:apply) is never
 * started from here: the center shows the exact command to paste in Claude Code.
 *
 * It renders in a Shadow DOM with its own styles, so it neither uses nor affects the project's design
 * system, like the live panel.
 */

/** URL prefix of the lab routes, filled by /facha-ui:variants from project.lab.urlPattern. */
const LAB_BASE = "/lab"; /*__LAB_BASE__*/

const MAX_UPLOAD = 5 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

interface CenterScreen {
  slug: string;
  file: string;
  route: string | null;
  score: number | null;
  /** The score of the measure before this one (B-044). */
  previous: number | null;
  worst: { rule: string; message: string; at: string } | null;
  variants: string[];
}

interface CenterData {
  at: string | null;
  lab: string | null;
  project: {
    score: number | null;
    designSystem: string | null;
    missing: string[];
    contrast: { pairs: number | null; failing: number | null } | null;
    coverage: { components: number | null; tokens: number | null } | null;
  };
  /** The project's earlier measures, oldest first (B-044). */
  history: { at: string; score: number }[];
  screens: CenterScreen[];
}

interface Request {
  id: string;
  kind: string;
  slug?: string;
  variant?: string;
  text: string;
  status: { state: string; message?: string };
}

interface LiveState {
  active: boolean;
  scope?: "project" | "screen";
  /** Claude Code's watcher is running: its heartbeat is fresh (B-044). */
  listening?: boolean;
  token?: string;
  requests?: Request[];
  center?: CenterData | null;
}

const STATE: Record<string, string> = {
  queued: "En cola",
  working: "Trabajando…",
  done: "Listo",
  "needs-input": "Necesita tu decisión",
  failed: "No se pudo",
  proposed: "Propuesta lista",
  chosen: "Elegida",
};

/** How the lab routes a variant: Vite with ?screen= queries, Next with paths. */
type Routes = "query" | "path";
const variantUrl = (routes: Routes, slug: string, v: string) => (routes === "query" ? `${LAB_BASE}/?screen=${slug}&v=${v}` : `${LAB_BASE}/${slug}/${v}`);
const compareUrl = (routes: Routes, slug: string) => (routes === "query" ? `${LAB_BASE}/?compare=${slug}` : `${LAB_BASE}/compare/${slug}`);

const STYLES = `
:host { all: initial; }
[hidden] { display: none !important; }
.page { box-sizing: border-box; min-height: 100vh; padding: 32px 24px 48px; background: #0f121a; color: #e8eaf2; font: 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
.wrap { max-width: 1040px; margin: 0 auto; display: grid; gap: 28px; }
h1 { font-size: 24px; margin: 0; }
h2 { font-size: 17px; margin: 0 0 12px; }
p { margin: 0; }
.muted { color: #a7aec2; }
.head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; }
.status { display: inline-flex; align-items: center; gap: 8px; border: 1px solid #3a4256; border-radius: 999px; padding: 6px 12px; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: #6d7690; }
.dot.on { background: #4fd17f; }
.dot.wait { background: #ffb547; }
.notice { border: 1px solid #ffb547; border-radius: 10px; padding: 10px 12px; background: #1f1a12; display: grid; gap: 8px; }
.delta { font-size: 13px; font-weight: 600; }
.delta.up { color: #8af0b0; }
.delta.down { color: #ffb38a; }
.section-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; }
.variant { display: inline-flex; align-items: center; gap: 6px; }
button.small { min-height: 32px; padding: 4px 10px; font-size: 13px; }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
.tile { border: 1px solid #2c3346; border-radius: 12px; padding: 14px 16px; background: #161a25; display: grid; gap: 4px; }
.big { font-size: 26px; font-weight: 700; font-variant-numeric: tabular-nums; }
.screens { display: grid; gap: 10px; }
.screen { border: 1px solid #2c3346; border-radius: 12px; background: #161a25; padding: 14px 16px; display: grid; gap: 10px; }
.row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.grow { flex: 1 1 240px; min-width: 0; }
.name { font-weight: 700; font-size: 15px; }
.score { font-weight: 700; font-variant-numeric: tabular-nums; border-radius: 8px; padding: 2px 8px; border: 1px solid #3a4256; }
.score.low { color: #ffb38a; border-color: #8a4a2a; }
.score.mid { color: #ffe08a; border-color: #7a6a2a; }
.score.high { color: #8af0b0; border-color: #2a6a45; }
a.link { color: #9cc0ff; text-decoration: underline; text-underline-offset: 2px; }
button, .btn { border-radius: 9px; border: 1px solid #3a4256; background: #0e1119; color: #e8eaf2; padding: 8px 14px; font: inherit; font-weight: 600; cursor: pointer; min-height: 40px; }
button.primary { background: #e8eaf2; color: #0e1119; border-color: #e8eaf2; }
button:disabled { opacity: .55; cursor: default; }
button:focus-visible, a:focus-visible, textarea:focus-visible, input:focus-visible, .drop:focus-visible { outline: 2px solid #ff8a4c; outline-offset: 2px; }
label { display: grid; gap: 6px; }
textarea, input[type="url"] { box-sizing: border-box; width: 100%; border-radius: 9px; border: 1px solid #5a6380; background: #0e1119; color: #e8eaf2; padding: 8px 10px; font: inherit; }
textarea { min-height: 64px; resize: vertical; }
.form { display: grid; gap: 12px; border-top: 1px solid #2c3346; padding-top: 12px; }
.drop { display: grid; place-items: center; gap: 4px; text-align: center; border: 2px dashed #5a6380; border-radius: 12px; padding: 18px; cursor: pointer; background: #0e1119; }
.drop.over { border-color: #ff8a4c; background: #1f1a17; }
.thumb { max-width: 220px; max-height: 140px; border-radius: 8px; border: 1px solid #3a4256; }
.check { display: flex; align-items: center; gap: 8px; }
fieldset.count { border: 0; margin: 0; padding: 0; display: grid; gap: 8px; }
fieldset.count legend { padding: 0; margin-bottom: 6px; }
.options { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px; }
.option { display: flex; align-items: flex-start; gap: 10px; border: 1px solid #3a4256; border-radius: 10px; padding: 10px 12px; cursor: pointer; background: #0e1119; }
.option:has(input:checked) { border-color: #ff8a4c; background: #1f1a17; }
.option:has(input:focus-visible) { outline: 2px solid #ff8a4c; outline-offset: 2px; }
.option input { margin-top: 3px; }
.option b { display: block; }
code { font-family: ui-monospace, Consolas, monospace; font-size: 13px; background: #0e1119; border: 1px solid #3a4256; border-radius: 6px; padding: 2px 6px; overflow-wrap: anywhere; }
.command { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; border: 1px solid #ff8a4c; border-radius: 10px; padding: 10px 12px; background: #1f1a17; }
.error { color: #ff9b94; }
.ok { color: #8af0b0; }
.request { font-size: 13px; }
`;

/** The change against the previous measure, in words and with an arrow: never by color alone (ux:wcag-1.4.1). */
function Delta({ now, before, when }: { now: number | null; before: number | null; when?: string | null }) {
  if (now === null || before === null) return null;
  const d = Math.round(now - before);
  const since = when ? ` desde el ${new Date(when).toLocaleDateString()}` : " desde la medición anterior";
  if (d === 0) return <span className="delta muted">= sin cambios{since}</span>;
  const up = d > 0;
  return (
    <span className={`delta ${up ? "up" : "down"}`} aria-label={`${up ? "Subió" : "Bajó"} ${Math.abs(d)} puntos${since}`}>
      {up ? "↑" : "↓"} {Math.abs(d)}
      <span className="muted">{since}</span>
    </span>
  );
}

/** How many variants the developer chose last, in this browser (B-045). 3 when unknown or unavailable. */
const COUNT_KEY = "facha-ui:center:count";
function readCount(): 1 | 3 {
  try {
    return window.localStorage.getItem(COUNT_KEY) === "1" ? 1 : 3;
  } catch {
    return 3;
  }
}
function saveCount(count: 1 | 3) {
  try {
    window.localStorage.setItem(COUNT_KEY, String(count));
  } catch {
    /* storage unavailable: the choice lasts for this page */
  }
}

function scoreClass(score: number | null): string {
  return score === null ? "" : score < 60 ? "low" : score < 80 ? "mid" : "high";
}

function pct(v: number | null | undefined): string {
  return typeof v === "number" ? `${Math.round(v * 100)}%` : "–";
}

/** A command to paste in Claude Code, with a copy button that falls back to selecting the text. */
function Command({ text, why }: { text: string; why: string }) {
  const [copied, setCopied] = useState<"" | "copied" | "selected">("");
  const ref = useRef<HTMLElement>(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied("copied");
    } catch {
      setCopied("selected");
      const sel = window.getSelection();
      const range = document.createRange();
      if (ref.current && sel) {
        range.selectNodeContents(ref.current);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  };
  return (
    <div className="command">
      <span className="grow">
        {why} <code ref={ref}>{text}</code>
      </span>
      <button type="button" onClick={() => void copy()}>
        {copied === "copied" ? "Copiado" : copied === "selected" ? "Seleccionado: Ctrl+C" : "Copiar"}
      </button>
    </div>
  );
}

/** A reference: an image dropped, chosen or pasted, or a URL. Uploads go to .facha-ui/references/. */
function Reference({ id, label, onChange }: { id: string; label: string; onChange: (r: { file: File | null; url: string }) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const take = (f: File | undefined | null) => {
    if (!f) return;
    if (!IMAGE_TYPES.includes(f.type)) return setError("Solo imágenes PNG, JPEG o WebP.");
    if (f.size > MAX_UPLOAD) return setError("La imagen pesa más de 5 MB.");
    setError(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
    onChange({ file: f, url });
  };
  return (
    <div className="form-part" onPaste={(e) => take(e.clipboardData.files[0])}>
      <span className="muted">{label}</span>
      <div
        className={`drop${over ? " over" : ""}`}
        role="button"
        tabIndex={0}
        aria-describedby={`${id}-hint`}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            input.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          take(e.dataTransfer.files[0]);
        }}
      >
        {preview ? <img className="thumb" src={preview} alt="La captura elegida" /> : <b>Arrastrá una captura acá, o tocá para elegirla</b>}
        <span id={`${id}-hint`} className="muted">
          PNG, JPEG o WebP, hasta 5 MB. También podés pegarla con Ctrl+V.
        </span>
      </div>
      <input ref={input} type="file" accept={IMAGE_TYPES.join(",")} hidden onChange={(e) => take(e.target.files?.[0])} />
      {file && (
        <button
          type="button"
          onClick={() => {
            setFile(null);
            setPreview(null);
            onChange({ file: null, url });
          }}
        >
          Quitar la captura
        </button>
      )}
      <label>
        <span className="muted">…o la dirección de la página</span>
        <input
          type="url"
          placeholder="https://"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value.trim());
            onChange({ file, url: e.target.value.trim() });
          }}
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function asDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function ScreenCard({ screen, live, post, upload, routes }: { screen: CenterScreen; live: LiveState; routes: Routes; post: (b: Record<string, unknown>) => Promise<boolean>; upload: (f: File) => Promise<string | null> }) {
  const [open, setOpen] = useState(false);
  const [goal, setGoal] = useState("");
  // 3 to compare unless this browser chose 1 last (B-045): comparing is what facha-ui is for.
  const [count, setCount] = useState<1 | 3>(() => readCount());
  const quick = count === 1;
  const [ref, setRef] = useState<{ file: File | null; url: string }>({ file: null, url: "" });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runs = (live.requests ?? []).filter((r) => r.kind === "run" && r.slug === screen.slug);
  const last = runs[runs.length - 1];
  // The variant chosen last, from this page or a variant's panel (live.md, L4).
  const chosen = [...(live.requests ?? [])].reverse().find((r) => r.kind === "choose" && r.slug === screen.slug)?.variant ?? null;
  const [picked, setPicked] = useState<string | null>(null);
  const choice = picked ?? chosen;
  const choose = async (v: string) => {
    setPicked(v);
    await post({ kind: "choose", slug: screen.slug, variant: v });
  };

  const submit = async () => {
    setSending(true);
    setError(null);
    let reference: string | undefined;
    if (ref.file) {
      const saved = await upload(ref.file);
      if (!saved) {
        setSending(false);
        return setError("No se pudo subir la captura. Probá con otra imagen.");
      }
      reference = saved;
    } else if (ref.url) {
      if (!/^https?:\/\//.test(ref.url)) {
        setSending(false);
        return setError("La dirección tiene que empezar con http:// o https://.");
      }
      reference = ref.url;
    }
    const ok = await post({ kind: "run", slug: screen.slug, text: goal.trim(), quick, ...(reference ? { reference } : {}) });
    setSending(false);
    if (ok) setOpen(false);
    else setError("No se pudo enviar. ¿Está abierto el centro en Claude Code?");
  };

  return (
    <article className="screen" aria-labelledby={`s-${screen.slug}`}>
      <div className="row">
        <div className="grow">
          <p id={`s-${screen.slug}`} className="name">
            {screen.route ?? screen.slug}
          </p>
          <p className="muted">{screen.worst ? `Lo más grave: ${screen.worst.message}` : "Sin problemas graves."}</p>
        </div>
        <span className={`score ${scoreClass(screen.score)}`} aria-label={`Puntaje de UX: ${screen.score ?? "sin medir"}`}>
          {screen.score ?? "–"}
        </span>
        <Delta now={screen.score} before={screen.previous} />
        <button type="button" className="primary" aria-expanded={open} onClick={() => setOpen((o) => !o)} disabled={!live.active}>
          Proponer variantes
        </button>
      </div>
      {screen.variants.length > 0 && (
        <p className="row">
          <span className="muted">Variantes:</span>
          {screen.variants.map((v) => (
            <span key={v} className="variant">
              <a className="link" href={variantUrl(routes, screen.slug, v)}>
                {v.toUpperCase()}
              </a>
              <button type="button" className="small" aria-pressed={choice === v} disabled={!live.active} onClick={() => void choose(v)}>
                {choice === v ? "Elegida" : "Elegir esta"}
              </button>
            </span>
          ))}
          {screen.variants.length > 1 && (
            <a className="link" href={compareUrl(routes, screen.slug)}>
              Comparar
            </a>
          )}
        </p>
      )}
      {choice && screen.variants.includes(choice) && (
        <Command why={`Elegiste la ${choice.toUpperCase()}. Para aplicarla vas a ver el plan exacto y confirmarlo; pegá en Claude Code:`} text={`/facha-ui:apply ${screen.slug} ${choice}`} />
      )}
      {last && (
        <p className="request" aria-live="polite">
          <b>{STATE[last.status.state] ?? last.status.state}</b>
          {last.status.message ? ` · ${last.status.message}` : ""}
        </p>
      )}
      {open && (
        <div className="form">
          <label>
            <span>¿Qué querés lograr en esta pantalla? (opcional)</span>
            <textarea value={goal} maxLength={2000} placeholder="Por ejemplo: que se vean primero los pedidos pendientes" onChange={(e) => setGoal(e.target.value)} />
          </label>
          <fieldset className="count">
            <legend>¿Cuántas querés?</legend>
            <div className="options">
              <label className="option">
                <input type="radio" name={`count-${screen.slug}`} checked={count === 3} onChange={() => (setCount(3), saveCount(3))} />
                <span>
                  <b>3 para comparar</b>
                  <span className="muted">Tres direcciones distintas, capturas en todos los temas y tamaños, y la revisión del crítico. Tarda más.</span>
                </span>
              </label>
              <label className="option">
                <input type="radio" name={`count-${screen.slug}`} checked={count === 1} onChange={() => (setCount(1), saveCount(1))} />
                <span>
                  <b>1 rápida</b>
                  <span className="muted">La que mejor responde al diagnóstico, con el guardián y sin el crítico. Tarda menos.</span>
                </span>
              </label>
            </div>
          </fieldset>
          <Reference id={`ref-${screen.slug}`} label="Referencia de estructura (opcional): una captura de una pantalla que te guste." onChange={setRef} />
          <div className="row">
            <button type="button" className="primary" disabled={sending} onClick={() => void submit()}>
              {sending ? "Enviando…" : count === 3 ? "Proponer 3 variantes" : "Proponer 1 variante"}
            </button>
            <button type="button" onClick={() => setOpen(false)}>
              Cancelar
            </button>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

function DesignSystem({ center, upload }: { center: CenterData; upload: (f: File) => Promise<string | null> }) {
  const status = center.project.designSystem;
  const [ref, setRef] = useState<{ file: File | null; url: string }>({ file: null, url: "" });
  const [command, setCommand] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const prepare = async () => {
    setError(null);
    if (ref.file) {
      const saved = await upload(ref.file);
      if (!saved) return setError("No se pudo subir la captura.");
      setCommand(`/facha-ui:init reference ${saved}`);
    } else if (/^https?:\/\//.test(ref.url)) setCommand(`/facha-ui:init reference ${ref.url}`);
    else setError("Elegí una captura o escribí la dirección de la página.");
  };
  return (
    <section aria-labelledby="ds">
      <h2 id="ds">Design system</h2>
      <div className="screen">
        <p>
          {status === "missing"
            ? "Tu proyecto todavía no tiene un design system (tokens de color, tipografía y espacios)."
            : status === "partial"
              ? `Tu design system está incompleto: faltan ${center.project.missing.slice(0, 4).join(", ") || "algunos roles"}${center.project.missing.length > 4 ? ` y ${center.project.missing.length - 4} más` : ""}.`
              : "Tu design system está completo."}
        </p>
        {status === "missing" ? (
          <Command why="Para crear uno desde cero, con estándares publicados, pegá en Claude Code:" text="/facha-ui:init system" />
        ) : status === "partial" ? (
          <Command why="Para proponer los tokens que faltan a partir de lo que ya usás, pegá en Claude Code:" text="/facha-ui:init" />
        ) : null}
        <div className="form">
          <b>Como esta página</b>
          <span className="muted">Un design system con los colores, la tipografía y los radios de una página que te guste, con el contraste corregido.</span>
          <Reference id="ref-ds" label="La página de referencia: una captura de una página cuyos colores y tipografía te gusten." onChange={setRef} />
          <div className="row">
            <button type="button" onClick={() => void prepare()}>
              Preparar el comando
            </button>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {command && <Command why="Crear o cambiar tokens lo arrancás vos. Pegá en Claude Code:" text={command} />}
        </div>
      </div>
    </section>
  );
}

function Center({ routes }: { routes: Routes }) {
  const [live, setLive] = useState<LiveState>({ active: false });
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${LAB_BASE}/facha-live`, { cache: "no-store" });
      if (res.ok) setLive((await res.json()) as LiveState);
    } catch {
      /* the dev server is restarting */
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 3000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const post = async (body: Record<string, unknown>) => {
    try {
      const res = await fetch(`${LAB_BASE}/facha-live`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: live.token, ...body }) });
      void refresh();
      return res.ok;
    } catch {
      return false;
    }
  };
  const upload = async (file: File) => {
    try {
      const res = await fetch(`${LAB_BASE}/facha-live`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: live.token, kind: "upload", data: await asDataUrl(file) }),
      });
      return res.ok ? ((await res.json()) as { path: string }).path : null;
    } catch {
      return null;
    }
  };

  const center = live.center ?? null;
  const session = live.active && live.scope === "project";
  const listening = session && live.listening === true;
  const measures = (live.requests ?? []).filter((r) => r.kind === "measure");
  const measure = measures[measures.length - 1];
  const measuring = !!measure && (measure.status.state === "queued" || measure.status.state === "working");
  const before = center?.history?.length ? center.history[center.history.length - 1] : null;
  const screens = [...(center?.screens ?? [])].sort((a, b) => (a.score ?? 101) - (b.score ?? 101));

  return (
    <main className="page">
      <div className="wrap">
        <header className="head">
          <div>
            <h1>facha-ui</h1>
            <p className="muted">Tu UI, con tu design system. Nada cambia en tu código sin que lo confirmes en Claude Code.</p>
          </div>
          <span className="status" role="status">
            <span className={`dot${listening ? " on" : session ? " wait" : ""}`} aria-hidden="true" />
            {listening ? "Claude Code está escuchando" : session ? "Claude Code no está escuchando" : "Sin conexión con Claude Code"}
          </span>
        </header>

        {!session && loaded && <Command why="Para usar el centro, pedile a Claude Code «abrí facha-ui», o pegá:" text="/facha-ui:center" />}
        {session && !listening && loaded && (
          <div className="notice" role="note">
            <span>
              <b>Claude Code no está escuchando.</b> Lo que pidas queda en cola y se hace cuando vuelva. Volvé a la conversación de Claude Code
              y decí «abrí facha-ui», o pegá:
            </span>
            <Command why="" text="/facha-ui:center" />
          </div>
        )}

        {center && (
          <section aria-labelledby="project">
            <div className="section-head">
              <h2 id="project">Cómo está tu proyecto</h2>
              <button type="button" disabled={!session || measuring} onClick={() => void post({ kind: "measure" })}>
                {measuring ? (measure!.status.state === "working" ? "Midiendo…" : "En cola…") : "Volver a medir"}
              </button>
            </div>
            {measure && measure.status.state === "failed" && <p className="error">{measure.status.message ?? "No se pudo medir."}</p>}
            <div className="tiles">
              <div className="tile">
                <span className="muted">Puntaje de UX</span>
                <span className="big">{center.project.score ?? "–"}</span>
                <Delta now={center.project.score} before={before?.score ?? null} when={before?.at} />
                <span className="muted">Consistencia, accesibilidad, responsive, textos y jerarquía. Sirve para comparar con vos mismo.</span>
              </div>
              <div className="tile">
                <span className="muted">Design system</span>
                <span className="big">{center.project.designSystem === "ok" ? "Completo" : center.project.designSystem === "partial" ? "Incompleto" : "Sin tokens"}</span>
              </div>
              <div className="tile">
                <span className="muted">Contraste</span>
                <span className="big">{center.project.contrast?.failing ?? "–"}</span>
                <span className="muted">pares de texto y fondo que no pasan WCAG, de {center.project.contrast?.pairs ?? "–"}</span>
              </div>
              <div className="tile">
                <span className="muted">Usa tu sistema</span>
                <span className="big">{pct(center.project.coverage?.tokens)}</span>
                <span className="muted">
                  {center.project.coverage?.tokens == null && center.project.coverage?.components == null
                    ? "Todavía no hay colores ni botones para contar."
                    : `de los colores salen de tokens; ${pct(center.project.coverage?.components)} de botones e inputs usan tus componentes`}
                </span>
              </div>
            </div>
          </section>
        )}

        {center && (
          <section aria-labelledby="screens">
            <h2 id="screens">Tus pantallas, de la que más necesita a la que menos</h2>
            {screens.length === 0 ? (
              <p className="muted">No encontré pantallas en tu proyecto.</p>
            ) : (
              <div className="screens">
                {screens.map((s) => (
                  <ScreenCard key={s.slug} screen={s} live={live} post={post} upload={upload} routes={routes} />
                ))}
              </div>
            )}
          </section>
        )}

        {center && session && <DesignSystem center={center} upload={upload} />}

        {center?.at && <p className="muted">Estado medido: {new Date(center.at).toLocaleString()}</p>}
      </div>
    </main>
  );
}

/** The center, in its own Shadow DOM. */
export function LabCenter({ routes }: { routes: Routes }) {
  const [root, setRoot] = useState<ShadowRoot | null>(null);
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (host.current && !host.current.shadowRoot) setRoot(host.current.attachShadow({ mode: "open" }));
    else if (host.current?.shadowRoot) setRoot(host.current.shadowRoot);
  }, []);
  return (
    <div ref={host} data-facha-ui="center">
      {root &&
        createPortal(
          <>
            <style>{STYLES}</style>
            <Center routes={routes} />
          </>,
          root,
        )}
    </div>
  );
}
