# facha-ui · variants · quick mode

Read by `SKILL.md` before step 1, when a new run has `--rapido` or `--quick`, or the developer asks
for it in their words ("rápido", "hacelo rápido", "una sola variante"). Follow Steps 1 to 9 of
`SKILL.md` with the changes below; a step not listed here runs as written.

The quick mode skips **exploration** (three variants, more captures) and **quality review** (the
full critique, the independent reviewer). It never skips safety or compliance.

## What never changes

- The 7 hard rules of `SKILL.md`.
- The guardian decides: the variant is valid only with `check_ui` at `summary.error = 0`.
- Every design decision has its source (*Source citations* in `SKILL.md`); visual values cite only
  `token`, `class`, `rule` or `decision`.
- Step 1 stops exactly as written (no design system, another framework, a previous run).
- Nothing is applied: only the developer runs `/facha-ui:apply`.

## What changes, step by step

- **Step 3 · Gaps:** as written, mandatory, before writing anything.
- **Step 3b · Diagnosis:** as written, in 2 or 3 lines: who, their task, and the main cost with its
  evidence and its `ux:*` id.
- **Step 4 · One hypothesis:** think A, B and C in one line each and show them. Build **one
  variant**: the hypothesis that best answers the diagnosis, and say why in one sentence. It keeps
  its letter (`a`, `b` or `c`), so its folder is `<lab.dir>/<slug>/<x>/`.
- **States:** loading, empty, error and stress are designed as in Step 4, with their `?state=`
  preview, even though they are not captured.
- **Step 6 · Guardian:** at most **2 attempts**. With errors after the second, the variant is
  `failed`: keep its files, list the violations and propose the full mode.
- **Step 7 · Screenshots:** read `lab.md` as written, but capture only desktop in the default
  theme. No mobile, tablet, other themes or states.
- **Step 7b · Critique:** only the `review_ui` signals, confirmed on that capture; record each one
  with its principle and fix, and fix it only if a guardian attempt is left.
- **Step 7c · Independent review:** skipped. Say so when presenting.
- **Step 8 · Run:** as in `run-state.md`, with `"mode": "quick"` and one entry in `variants`.
- **Step 9 · Present:** the diagnosis, the three one-line hypotheses and why this one, the guardian
  result, the critique signals, the decisions with sources, the URL and the capture. Close, in the
  developer's language, with:

> Para 3 alternativas con revisión completa, corré sin `--rapido`: `/facha-ui:variants <screen> "<goal>"`.
> Para ajustarla: `/facha-ui:variants <slug> <x> "<cambio>"` (o pedímelo acá).
> Para aplicarla: `/facha-ui:apply <slug> <x>`

A quick run is a normal run: it can be refined (`refine.md`), opened live (`live.md`) or applied.
