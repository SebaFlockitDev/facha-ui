# facha-ui · init · design system from scratch

Read by `SKILL.md` when `$ARGUMENTS` is `system`, or when Step 1 offers it and the developer
accepts. Every hard rule of `SKILL.md` still applies. The values come only from
`propose_design_system`, which builds them from published standards (Radix Colors, Carbon,
Material 3, Fluent 2) and proves every contrast pair against WCAG 2.2: you never pick or "improve"
a color, size or radius yourself.

**Writes in this mode:**
- in the lab, without asking (as `/facha-ui:variants` does): the lab scaffold if it does not exist,
  and `<lab.dir>/system/`, the direction preview (S2b). Both are removed in S5;
- the captures, in `<project.screenshotsDir>/system/`; they stay;
- after the approval of S4, and only what S3 showed: the token blocks, at the top of the target file
  (S1), after its `@charset` and `@import` lines; `.facha-ui/proposals/system-<YYYYMMDD-HHMM>.json`,
  the approved direction with its dark values; and the `decisions.md` entry (S6), append only.

Nothing else: not the screens (their hand-written colors stay; redesigning them is
`/facha-ui:variants`), not `tailwind.config`, not `package.json`.

## S1 · Preflight (read-only)

1. Call `get_design_system` (sections `project`, `tokens`, `coverage`, `decisions`, `brief`), and
   `audit_project` and `ux_score` with no arguments (the **before**).
2. `status` must be `missing`. With tokens (`ok` or `partial`), stop: this mode would replace the
   project's colors; recommend `/facha-ui:init colors` (complete it from usage) or a palette from
   the live panel (`/facha-ui:variants <slug> live`).
3. `brief` is null: say the system needs to know the product (density, brand color, contrast
   level) and recommend `/facha-ui:init brief` first. Go on with defaults only if the developer
   says so, and say which defaults (balanced, AA, no brand color).
4. **Target file**, the global stylesheet the whole app loads:
   - Vite: the first of `project.lab.entry.css`, resolved from the entry file
     (`./index.css` in `src/main.tsx` → `src/index.css`);
   - Next.js: the CSS that `app/layout.tsx` (or `src/app/layout.tsx`) imports;
   - none: stop and show the blocks for the developer to add to a stylesheet the app loads
     (adding an import to the app's code is not this mode's job).
5. **Font:** if the brief's `typography` names a family (not the system font), pass it as
   `fontFamily` followed by the system stack (`"Inter", system-ui, sans-serif`).
6. **The screen to preview:** the one where the brief's main task happens (from its routes and
   the brief's `task`). If it is not clear, ask which one. `project.framework` must be `next-app`
   or `vite-react` for the preview; with `unknown`, skip S2b and present the directions as tables.

## S2 · Generate

Call `propose_design_system` with only what S1 found (`fontFamily`, when there is one); the rest
comes from the brief, and `inputs` says the origin of each value. It returns three `directions`:
with a brand color, the brand in three styles (`standard`, `sober`, `soft`); without one, three
Radix seeds, each with a style. Every direction carries its style's sources, its contrast proof,
its adjustments and conflicts, and its CSS (`css.lab` is the one for the preview).

## S2b · Show the directions on the real screen

**Before this step, read `../variants/lab.md`** (sections Scaffold and Direction preview).

1. If `<lab.dir>/main.tsx` (Vite) or `<lab.dir>/layout.tsx` (Next) does not exist, write the lab
   scaffold as `lab.md` says. Note whether you created it: S5 removes it only in that case.
2. Write `<lab.dir>/system/` as `lab.md` says: `directions.css` with the `css.lab` of every
   direction, the specimen and compare files, and the **copy of the screen**: the same structure,
   data and providers, with every hand-written color, size and radius replaced by the token of
   its role (`--color-*`, `--text-*`, `--space-*`, `--radius`, `--shadow-card`). It is today's
   screen dressed in each direction, not a redesign: change nothing else.
3. `check_ui` on `<lab.dir>/system/<slug>`: the only errors allowed now are `unknown-token` for
   names the system will create (they exist once it is written). Fix any other, at most 3 passes.
4. Capture with Playwright, within hard rule 6 of `/facha-ui:variants` (only `preview.baseUrl`,
   only its six capture tools), at desktop width, for each direction: the specimen and the
   screen, in the default theme, and also in dark when the brief says "sí" to dark mode:
   `<project.screenshotsDir>/system/<direction>-<specimen|slug>-desktop-<theme>.png`. If the browser
   cannot open the lab after 2 attempts, list the URLs for the developer instead.

## S2c · Choose a direction

Show, in the developer's language:
- the compare page (`lab.md`): the three directions side by side, on the screen and on the
  specimen, and the captures;
- per direction, a few lines: its seed (`seed.from`) and style (`style.label`: radius, neutral,
  how cards stand out, each with its source from `sources`), how many contrast pairs pass, and its
  `adjustments`, `conflicts` and `notes` in plain words.

All of them pass WCAG and none confuses its states. The choice is a brand decision: relate each to
the brief's personality, but do not present one as better without a source. Ask which one, or a
**mix** (the color of one with the style of another): call the tool again with that seed as
`brandColor` and that `style`, add its `css.lab` to `directions.css`, capture it and show it before
going on.

## S3 · Present the plan and ask for approval

For the chosen direction, one message:

1. **Inputs**, a table: value and origin of each (`inputs`), and the chosen style.
2. **Color**, a table by role: token, light value, dark value. Then the direction's
   `adjustments`, `conflicts` (each with its solution: always text and icon on that state,
   `ux:wcag-1.4.1`) and `notes`.
3. **Accessibility proof:** how many pairs pass (all of them, or say which do not), and the three
   with the smallest margin over their minimum, with ratio and rule.
4. **Type, space, radius and shadow:** the scale with its source (`typography.scaleSource`),
   line heights, the control height, the radii and the shadows, each with its source.
5. **Dark mode**, from the brief: "sí" → the `.dark` block is written, and the developer's theme
   toggle must put `class="dark"` on `<html>`; "más adelante" or "no" → only the default theme is
   written and the dark values stay in the proposal file for later.
6. **Exactly what will be written:** the target file and the blocks (`css.light.text`, and
   `css.dark.text` when dark is written) as they will appear; in Tailwind 4 the default theme goes
   in `@theme`, right after `@import "tailwindcss";`; the proposal file; the decision entry (S6).
   Say that the screens keep their hand-written colors and the guardian will flag them: that is
   expected, and the next step redesigns them.

Ask in one question: write it as shown, or change something (another density, AAA, dark now:
each means calling the tool again and showing the plan again), and **the reason**. Only an explicit
yes counts (hard rule 3).

## S4 · Write

1. Edit the target file: insert the approved blocks at the top, after any `@charset` and
   `@import` lines, preceded by `/* facha-ui system · <decision id> */`. Nothing else in the file
   changes.
2. Write the proposal file with the direction approved: `inputs`, `typography`, `spacing`,
   `radius`, and that direction's `seed`, `style`, `tokens`, `proof`, `adjustments`, `conflicts`
   and `css`.

If anything has to differ from the plan, stop and go back to S3.

## S5 · Validate and clean up

1. `get_design_system` again: `status` is `ok` (every role present), the tokens have the
   expected roles, and `health` has no contrast, status-confusable or theme-missing finding
   between two of the new tokens. Expected, and said in one line: near-duplicates between tokens
   of different roles (the rule's own note says to ignore them), and findings about the screens'
   hand-written colors or classes. Anything else: show it; the developer decides whether to keep
   the change or undo it (`git restore`, only if they say so).
2. `check_ui` on the target file: no violation inside the written block; the ones below it are the
   screens' own colors, the same as before. `check_ui` on `<lab.dir>/system/`: 0 errors now that
   the tokens exist.
3. `audit_project` and `ux_score` with no arguments: the **after**. The literals in the screens
   are now reported against real tokens; say so, it is the expected starting point.
4. Remove `<lab.dir>/system/`, and the lab scaffold if S2b created it and no run of variants uses
   it (the same files `/facha-ui:apply` removes, `lab.md`). The captures stay.

## S6 · Record the decision

Append to `memory.decisionsFile`, id `dec-<YYYY-MM-DD>-system` (`-2`, `-3`… if it exists). The
labels stay as shown:

```markdown
## dec-YYYY-MM-DD-system · Design system desde estándares: <seed or brand>, estilo <style>
- **Fecha:** YYYY-MM-DD
- **Pantalla:** design system (`<target file>`)
- **Objetivo:** un sistema completo y accesible a partir del brief <brief id>
- **Elegida:** <direction id> (<seed.from>, estilo <style.label>), densidad <density>, WCAG 2.2 <level><, con modo oscuro>
- **Motivo (dev):** "<the developer's reason, verbatim>"
- **Descartadas:** <the other directions>
- **Precedentes que deja:**
  - los colores salen de `--color-*`, los tamaños de `--text-*`, los radios de `--radius*` (fuente: `decision`)
  - <each conflict: "el estado <x> siempre con texto e ícono"> (fuente: `ux:wcag-1.4.1`)
- **Brechas abiertas:** <hand-written colors still in the screens, from the audit>
- **Run:** propose_design_system del YYYY-MM-DD · `.facha-ui/proposals/system-<…>.json` · capturas en `<screenshotsDir>/system/`
```

## S7 · Report

Say: the tokens created and where, `status` before and after, the accessibility proof, the
decision id, the captures, and that nothing was committed. Next step, as a request in plain words:
*"mejorá la pantalla `<route>`"* for the screen of the brief's main task, so `/facha-ui:variants`
redesigns it with the new system. End with the progress line of `SKILL.md` step 7.
