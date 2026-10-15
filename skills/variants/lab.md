# facha-ui · variants · the lab

Read by `SKILL.md` before Step 5 (scaffold and conventions) and before Step 7 (screenshots), and by
`refine.md` before R5. Every hard rule of `SKILL.md` still applies.

## Scaffold (once per project)

Follow the section of `project.framework`. Write every file with the Write tool, keeping the
relative paths. In both, `lab-theme.tsx`, `lab-state.ts` and `lab-responsive.tsx` come from
`templates/next-app/` (they do not depend on Next.js).

### Next.js App Router (`next-app`)

If `<lab.dir>/layout.tsx` does not exist, copy from this skill's `templates/next-app/` into
`<lab.dir>/`: `layout.tsx`, `lab-theme.tsx`, `lab-state.ts`, `lab-responsive.tsx`, `lab-panel.tsx`,
`compare/[slug]/page.tsx`, `facha-live/route.ts` and `facha-live/live-core.ts`.

- In `lab-panel.tsx` and in `compare/[slug]/page.tsx`, set `LAB_BASE` to the lab's URL prefix
  (the part of `project.lab.urlPattern` before `/{screen}`, e.g. `"/lab"`).
- The layout returns `notFound()` in production, so the lab never ships; the live endpoint
  answers 404 in production too.

### React + Vite (`vite-react`)

The lab is its own dev-only entry, so no file of the app changes. If `<lab.dir>/main.tsx` does not
exist, copy `index.html`, `main.tsx`, `providers.tsx` and `compare.tsx` from
`templates/vite-react/`, and `lab-theme.tsx`, `lab-state.ts`, `lab-responsive.tsx` and
`lab-panel.tsx` from `templates/next-app/`, into `<lab.dir>/` (`facha-lab/` by default). `main.tsx`
imports every one of them: a missing one breaks the whole lab (Vite answers 500). An existing lab
whose `main.tsx` imports a file that is not there gets it copied from the same template. Then:

- In `lab-panel.tsx` and `compare.tsx`, set `LAB_BASE` to `/<lab.dir>` (`"/facha-lab"`). Without
  live mode the panel shows that it is off and the command to start it.

- `get_design_system` → `project.lab.entry` has the app's entry read statically: `file`, `css`
  (its global stylesheet imports, in order) and `providers` (what wraps `<App />`, outermost
  first: `name`, `kind`, `module` and, for each prop, where its value comes from). Work from it,
  not from a reading by eye; if `entry` is `null` or has `unread` items, read the entry file too.
- In `main.tsx`, replace `/*__GLOBAL_CSS__*/` with `entry.css`, in order, with paths relative to
  `<lab.dir>/` (`./index.css` in `src/main.tsx` → `import "../src/index.css";`).
- Write `providers.tsx` with the same providers in the same order, by `kind`, never copying the
  app's code:
  - `strict`: leave it out (`main.tsx` already renders `StrictMode`).
  - `router` (`BrowserRouter`, `HashRouter`): a `MemoryRouter` with
    `initialEntries={[ROUTES[screen] ?? "/"]}`, and `ROUTES` gets the screen's route
    (`{ orders: "/orders" }`, one entry per run). When `entry.app` is a `RouterProvider` (a data
    router), use a `MemoryRouter` too; if the variant needs its loaders' data, that is a **gap**.
  - `query-cache` (`QueryClientProvider`, `SWRConfig`): import the instance when it is exported or
    imported; when it is `local` and not exported, create one in `providers.tsx` with the same
    options (the prop's `init`, as written). The data comes from the same hooks and fetchers;
    say that only the cache is the lab's.
  - `provider` (a store, a theme, i18n, auth, a client with credentials): import the component and
    any instance it receives from where the app gets them. An instance the app creates in its
    entry and does not export is a **gap**: report it with the fix (export it from a module) and
    never re-create it, since its setup (auth, initial state, middleware) is the app's code.
- If a variant uses a hook whose provider is missing, the lab shows "La variante no se pudo
  mostrar" with the error and keeps the panel: add the provider here.
- `vite build` only builds the root `index.html`, so `<lab.dir>/` never ships, and `main.tsx`
  renders nothing in production. If `get_design_system` says `vite.config` lists the lab in
  `build.rollupOptions.input`, stop and ask the developer to remove it.
- Live mode adds the panel, the endpoint as a dev-only Vite plugin and its one line in
  `vite.config`, only when the developer starts it (`live.md`, L1).

### Both

- In `lab-theme.tsx`, replace `/*__THEMES__*/` with one entry per non-default theme, taken from
  `project.themes`:

| Selector | Entry |
|---|---|
| `html.dark`, `.dark` or `:root.dark` | `dark: { attribute: "class", value: "dark" }` |
| `[data-theme="dark"]` | `dark: { attribute: "data-theme", value: "dark" }` |
| `@media (prefers-color-scheme: dark)` | No entry: the theme cannot be forced from the page, so tell the developer to capture it with browser emulation |

- A Next lab created by an older version: add `lab-state.ts` and `lab-responsive.tsx` when they
  are missing, and update `layout.tsx` to the template's version.
- The live panel (`lab-panel.tsx`) and the compare page are facha-ui's own UI: their
  styles are their own, they are never copied into a variant, and the panel hides itself in
  automated browsers and inside its own previews, so captures stay clean.

## Variant files

- Next: `<lab.dir>/<slug>/<a|b|c>/page.tsx` (keep `"use client"` if the original has it).
  Vite: `<lab.dir>/<slug>/<a|b|c>/Page.tsx` (or `Page.jsx` in a JavaScript project), with a
  default export; `main.tsx` finds it, no other file changes. Code shared between variants goes
  in `<lab.dir>/<slug>/_shared/`.
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
`?theme=<name>` for every non-default theme (`&theme=<name>` in Vite, whose URL already has a
query: `/facha-lab/?screen=orders&v=a&theme=dark`); the same goes for `state` and `check`.

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

- **Compare page:** `preview.baseUrl` + `<LAB_BASE>/compare/<slug>` (Next) or
  `/<lab.dir>/?compare=<slug>` (Vite) shows the variants side by side with the same real data, at
  desktop, tablet or mobile width, in any theme and state, with synced scroll. With live mode on
  (Next), each person votes for a variant with a reason (`live.md`, L4b).
- **Report to share:** run `node "<this skill's directory>/scripts/report.mjs" "<project root>" <slug>`
  (add `--workspace "<workspace root>"` when `project.workspacePath` is not `.`) and write its
  output, unchanged, to `.facha-ui/reports/<slug>.html` with the Write tool. It links the
  screenshots relatively, so share the `.facha-ui/reports/` and `.facha-ui/screenshots/` folders
  together.
