# facha-ui · variants · edit a screen

Read by `SKILL.md` and by the `center` skill before step E1, when the developer wants to edit a screen as
it is, without asking for variants ("Editar esta pantalla" in the center, an `edit` request, or in their
words: "quiero editar la pantalla de pedidos"). Every hard rule of `SKILL.md` still applies: the screen's
file never changes here, and nothing is applied.

The edit is a variant like any other, with a fixed letter: **E**. It starts as a faithful copy of the
screen, and each change the developer asks for in the panel refines it (`refine.md`). Its folder is
`<lab.dir>/<slug>/e/`.

## E1 · Open or create E

1. Call `get_design_system` (all sections), as in Step 1 of `SKILL.md`, and resolve the screen to
   `{ file, route, slug }` as *Inputs* says. Stop as Step 1 says when there is no design system or the
   framework is another one; **a previous run does not stop the edit**: E does not touch A, B or C.
2. If `<lab.dir>/<slug>/e/` has files, **reopen it**: do not copy again. Go to E4.
3. Otherwise copy the screen into `<lab.dir>/<slug>/e/Page.tsx` (Vite) or `page.tsx` (Next), with the
   Write tool:
   - the first line of the lab contract (`lab.md`, *Variant files*), with the run's `runId`;
   - every relative import rewritten for the new folder, so it points at the **same** files (the
     screen's components, hooks and data); `@/` imports stay as they are;
   - **nothing else changes**: no design decision, no state preview, no fix. It is the developer's screen.
     The fixes come when they ask for them.

## E2 · The guardian's baseline

Run `check_ui` on `<lab.dir>/<slug>/e`. Its errors are the screen's own, inherited by the copy: record them
as E's `baseline`. They do not make the copy fail.

## E3 · The run

In `.facha-ui/runs/<slug>.json` (shape in `run-state.md`):
- if the run exists with `status: "generated"`, add E to its `variants`; never change A, B or C;
- otherwise create the run with `"mode": "edit"` and E as its only variant.

E's entry: `"id": "e"`, `"hypothesis": "Edición de la pantalla original"`, its files, its URLs, its
`baseline` and `status`: **`valid`** with 0 errors, **`draft`** with the errors it inherited. `apply` accepts
only `valid`.

## E4 · Tell the developer

Set the request's status (center or panel) to
`{ "state": "done", "message": "La edición está lista: es una copia de tu pantalla.", "url": "<E's URL>" }`
and, here, give the URL. In `draft`, add how many errors it inherited and that "Arreglá lo que marca el
guardián" (a one-click improvement in the panel) fixes them. Then update `screens[].variants` in
`.facha-ui/live/center.json` when the center is open.

## E5 · Each change to E

A change to E follows `refine.md` R1 to R7. While E is `draft`, the guardian loop (R4) passes when the change
adds **no new error** over the baseline; E turns `valid` when it reaches 0 errors, and the status message says
so. Never touch the screen's file: applying E is `/facha-ui:apply <slug> e`, started by the developer.
