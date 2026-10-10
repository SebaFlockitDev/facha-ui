# facha-ui · variants · the lab

Read by `SKILL.md` before Step 5 (scaffold and conventions) and before Step 7 (screenshots), and by
`refine.md` before R5. Every hard rule of `SKILL.md` still applies.

## Scaffold (once per project)

If `<lab.dir>/layout.tsx` does not exist, copy these files from this skill's
`templates/next-app/` into `<lab.dir>/`, keeping their relative paths, with the Write tool:
`layout.tsx`, `lab-theme.tsx`, `lab-state.ts`, `lab-responsive.tsx`, `lab-panel.tsx`,
`compare/[slug]/page.tsx`, `facha-live/route.ts` and `facha-live/live-core.ts`.

- In `lab-panel.tsx` and in `compare/[slug]/page.tsx`, set `LAB_BASE` to the lab's URL prefix
  (the part of `project.lab.urlPattern` before `/{screen}`, e.g. `"/lab"`).
- In `lab-theme.tsx`, replace `/*__THEMES__*/` with one entry per non-default theme, taken from
  `project.themes`:

| Selector | Entry |
|---|---|
| `html.dark`, `.dark` or `:root.dark` | `dark: { attribute: "class", value: "dark" }` |
| `[data-theme="dark"]` | `dark: { attribute: "data-theme", value: "dark" }` |
| `@media (prefers-color-scheme: dark)` | No entry: the theme cannot be forced from the page, so tell the developer to capture it with browser emulation |

- A lab created by an older version: add `lab-state.ts` and `lab-responsive.tsx` when they are
  missing, and update `layout.tsx` to the template's version.

The layout returns `notFound()` in production, so the lab never ships; the live endpoint
answers 404 in production too. The live panel (`lab-panel.tsx`) is facha-ui's own UI: it renders
in a Shadow DOM with its own styles, is never copied into a variant, and hides itself in
automated browsers and inside its own previews, so captures stay clean.

## Variant files

- `<lab.dir>/<slug>/<a|b|c>/page.tsx`. Keep `"use client"` if the original has it. Code shared
  between variants goes in `<lab.dir>/<slug>/_shared/`.
- A style no class provides goes in a CSS module next to the variant (`variant.module.css`),
  with values from `var(--token)` only.
- First line of every file:
  `// facha-ui lab · run <runId> · variant <x> · removed by /facha-ui:apply`, with
  `runId` = `<slug>-<YYYYMMDD>-<HHMM>`.

## State preview

Each variant reads `useLabState()` from `<lab.dir>/lab-state.ts`, so every state can be shown with
`?state=loading|empty|error|long` on top of the real data. Mark every line that uses it (the
import included) with the comment `// facha-ui lab: state preview`, so `/facha-ui:apply` can
remove exactly those lines; the real state branches stay. For example:

```tsx
const preview = useLabState(); // facha-ui lab: state preview
const rows = preview === "empty" ? [] : preview === "long" ? many(real.rows) : real.rows; // facha-ui lab: state preview
const loading = preview === "loading" || real.loading; // facha-ui lab: state preview
```

The preview only forces the screen's own states with its own data shape: never invent domain
data (`stress()` and `many()` repeat the real values).

## Screenshots

The lab URL of each variant is `preview.baseUrl` + `project.lab.urlPattern`. Add
`?theme=<name>` for every non-default theme.

**Playwright MCP available** (`mcp__plugin_facha-ui_playwright__*`), within hard rule 6 of
`SKILL.md` (only `preview.baseUrl`, only the six capture tools, never credentials):
- if a login page appears and `preview.auth` is `manual`, ask the developer to sign in
  themselves in that window;
- capture desktop screenshots for each theme with `browser_take_screenshot` and an explicit
  `filename`: `<project.screenshotsDir>/<slug>/<x>-desktop-<theme>.png`;
- capture the default theme at **mobile (375×812)** and **tablet (768×1024)** too, with
  `browser_resize`: `<x>-mobile-<theme>.png` and `<x>-tablet-<theme>.png`. Before each one, open
  the URL with `?check=responsive` and read the lab's responsive check with `browser_snapshot`
  (a status box: horizontal overflow, the main content's width and what squeezes it, elements
  wider than the screen or clipped, targets under 24px, text under 12px). Then capture without
  `?check=` so the screenshot stays clean. Record the check's lines in the run (`responsive`);
- capture each state in the default theme, with `?state=<state>`:
  `<project.screenshotsDir>/<slug>/<x>-desktop-<theme>-<state>.png` (loading, empty, error,
  long). Use `browser_wait_for` so the state is rendered before the capture;
- Playwright resolves explicit names against the workspace, and `screenshotsDir` is already
  relative to it, so the files land in the project's `.facha-ui/screenshots/`. Never move
  screenshots afterwards;
- if the browser cannot open or the URL is unreachable, stop after **2 attempts**.

**Otherwise, or after those 2 attempts:** list the URLs so the developer can capture them
manually.

## Compare page and report

- **Compare page:** `preview.baseUrl` + `<LAB_BASE>/compare/<slug>` shows the variants side by
  side with the same real data, at desktop, tablet or mobile width, in any theme and state, with
  synced scroll. With live mode on, each person votes for a variant with a reason (`live.md`, L4b).
- **Report to share:** run `node "<this skill's directory>/scripts/report.mjs" "<project root>" <slug>`
  (add `--workspace "<workspace root>"` when `project.workspacePath` is not `.`) and write its
  output, unchanged, to `.facha-ui/reports/<slug>.html` with the Write tool. It links the
  screenshots relatively, so share the `.facha-ui/reports/` and `.facha-ui/screenshots/` folders
  together.
