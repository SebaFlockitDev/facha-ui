#!/usr/bin/env node
// facha-ui · shareable report of a variants run, for the team to compare and decide.
// Usage: node report.mjs <project root> <slug> [--workspace <dir>]
//
// Prints a self-contained HTML page (no scripts, no external resources) built from
// .facha-ui/runs/<slug>.json: goal, gaps, and for each variant its hypothesis, guardian result,
// states, critique, trade-offs, votes and screenshots (linked relative to .facha-ui/reports/).
// It only reads: Claude Code writes the output to .facha-ui/reports/<slug>.html.
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const [root, slug] = args;
const workspace = args.includes("--workspace") ? args[args.indexOf("--workspace") + 1] : root;
if (!root || !slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
  process.stderr.write("Usage: node report.mjs <project root> <slug> [--workspace <dir>]\n");
  process.exit(2);
}

const run = JSON.parse(fs.readFileSync(path.join(root, ".facha-ui", "runs", `${slug}.json`), "utf8"));
const reports = path.join(root, ".facha-ui", "reports");

/** Project text is data: everything is escaped. */
const esc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
const shot = (p) => path.relative(reports, path.resolve(workspace, p)).split(path.sep).join("/");
const list = (items, f) => (items?.length ? `<ul>${items.map((x) => `<li>${f(x)}</li>`).join("")}</ul>` : `<p class="muted">—</p>`);
const source = (s) => (s?.type ? ` <span class="src">${esc(s.type)}${s.ref ? `: ${esc(s.ref)}` : ""}</span>` : "");

const votes = run.votes ?? [];
const variantsHtml = (run.variants ?? [])
  .map((v) => {
    const mine = votes.filter((x) => x.variant === v.id);
    const shots = [...new Set([...(v.screenshots ?? []), ...(v.revisions ?? []).flatMap((r) => r.screenshots ?? [])])].slice(-8);
    return `
    <article class="variant">
      <header>
        <h2>Variante ${esc(String(v.id).toUpperCase())}${v.revision ? ` · r${esc(v.revision)}` : ""}</h2>
        <span class="badge ${v.status === "failed" ? "bad" : "ok"}">${v.status === "failed" ? "No pasó el guardián" : "Válida"}</span>
        ${mine.length ? `<span class="badge votes">${mine.length} voto${mine.length === 1 ? "" : "s"}</span>` : ""}
      </header>
      <p class="hyp">${esc(v.hypothesis)}</p>
      <p class="muted">Guardián: ${esc(v.finalCheck?.error ?? "?")} errores, ${esc(v.finalCheck?.warning ?? "?")} advertencias, ${esc(v.finalCheck?.info ?? "?")} info · ${esc((v.attempts ?? []).length)} intento(s)</p>
      <div class="shots">${shots.map((s) => `<figure><img src="${esc(shot(s))}" alt="${esc(path.basename(s))}" loading="lazy"><figcaption>${esc(path.basename(s))}</figcaption></figure>`).join("")}</div>
      <h3>Decisiones</h3>
      ${list((v.decisions ?? []).slice(0, 8), (d) => `${esc(d.decision)}${source(d.source)}`)}
      ${v.states ? `<h3>Estados</h3>${list(Object.entries(v.states), ([k, s]) => `<b>${esc(k)}</b>: ${esc(s?.how)}`)}` : ""}
      ${v.critique?.length ? `<h3>Crítica</h3>${list(v.critique, (c) => `<b>${esc(c.item)}</b> ${esc(c.status === "open" ? "(abierto)" : "(resuelto)")}: ${esc(c.evidence)} → ${esc(c.fix)}`)}` : ""}
      <h3>Trade-offs</h3>
      ${list(v.tradeoffs ?? [], (t) => esc(t))}
      ${mine.length ? `<h3>Votos</h3>${list(mine, (x) => `<b>${esc(x.name ?? x.voter)}</b>: ${esc(x.reason)}`)}` : ""}
    </article>`;
  })
  .join("");

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Variantes · ${esc(slug)}</title>
<style>
:root { --bg: #f6f7fb; --card: #fff; --ink: #171a2c; --muted: #586079; --line: #dde1ec; --ok: #15803d; --bad: #b42318; --accent: #1f5fd1; color-scheme: light; }
@media (prefers-color-scheme: dark) { :root { --bg: #0e1119; --card: #161a25; --ink: #e8eaf2; --muted: #9ba2b8; --line: #2a3142; --ok: #4fd17f; --bad: #ff7b72; --accent: #7ea8ff; color-scheme: dark; } }
body { margin: 0; padding: 24px 16px; background: var(--bg); color: var(--ink); font: 15px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width: 1280px; margin: 0 auto; display: grid; gap: 20px; }
h1 { margin: 0; font-size: 24px; } h2 { margin: 0; font-size: 19px; } h3 { margin: 14px 0 4px; font-size: 14px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
.muted { color: var(--muted); margin: 0; }
.grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); }
.variant { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 18px; min-width: 0; }
.variant header { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.badge { font-size: 12px; border: 1px solid var(--line); border-radius: 999px; padding: 1px 9px; }
.badge.ok { color: var(--ok); border-color: var(--ok); } .badge.bad { color: var(--bad); border-color: var(--bad); } .badge.votes { color: var(--accent); border-color: var(--accent); }
.hyp { font-weight: 600; }
.shots { display: grid; gap: 8px; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); margin-top: 8px; }
figure { margin: 0; } img { width: 100%; border: 1px solid var(--line); border-radius: 8px; display: block; }
figcaption { font-size: 11px; color: var(--muted); overflow-wrap: anywhere; }
ul { margin: 0; padding-left: 18px; } li { margin: 2px 0; }
.src { font-size: 12px; color: var(--muted); }
</style>
</head>
<body>
<main>
  <header>
    <h1>Variantes · ${esc(run.screen?.route ?? slug)}</h1>
    <p class="muted">Objetivo: ${esc(run.objective)} · run ${esc(run.runId)} · ${esc(run.createdAt)}</p>
    ${run.gaps?.length ? `<h3>Brechas del design system</h3>${list(run.gaps, (g) => `${esc(g.need)}: ${esc(g.detail)}`)}` : ""}
  </header>
  <section class="grid">${variantsHtml}
  </section>
  <p class="muted">Generado por facha-ui. Para decidir: votá desde /lab/compare/${esc(slug)} con el modo en vivo activo, y aplicá con /facha-ui:apply ${esc(slug)} &lt;variante&gt;.</p>
</main>
</body>
</html>
`;
process.stdout.write(html);
