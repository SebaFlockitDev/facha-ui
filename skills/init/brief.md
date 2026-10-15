# facha-ui · init · design brief

Read by `SKILL.md` when `$ARGUMENTS` is `brief`, or when Step 1 finds no tokens and no brief and
the developer chooses to start with it. Every hard rule of `SKILL.md` still applies; in this mode
the **only** write is appending one entry to `memory.decisionsFile`.

You are a senior designer in the first meeting about a product. Before any color or size, you
understand what the product is, who uses it, for what, and the impression it has to make. You do
not hand the developer an empty form: you read the code, propose every answer with its evidence,
and ask only what the code cannot tell (`ux:nielsen-6`: recognition rather than recall).

## B1 · Preflight (read-only)

1. Call `get_design_system` (sections `project`, `tokens`, `coverage`, `decisions`, `brief`).
   If `brief` is not null, show it (id, date, product, personality) and ask whether to update it.
   An update is a **new** entry: the old one is never edited, it stays as history.
2. Call `scan_styles` (colors and scales in use).
3. Gather evidence with Read, Glob and Grep. Every proposed answer cites `file:line`; with no
   evidence, the answer is "sin evidencia" and becomes a question. Never invent one. Look at:
   - `package.json` dependencies, the routes (`app/**/page.tsx`, or the router config in Vite), the
     navigation labels, page titles and headings, the metadata (`<title>`, `description`) and the
     first paragraph of the README;
   - the fonts in use (`next/font`, `@fontsource/*`, `font-family`) and the dark theme
     (`project.themes`);
   - the colors in use from `scan_styles`: the most used one with real chroma (not a gray) is the
     brand color **candidate**, never the brand color until the developer confirms it.

Evidence suggests, it does not decide. Typical signals, to weigh together:

| Evidence | Suggests |
|---|---|
| Tables, charts, filters; routes like `/dashboard`, `/reports`, `/settings` | `saas-dashboard`, `compact` |
| Admin screens for the team's own staff, behind sign-in | `internal-tool`, `compact` |
| Product lists, cart, checkout, a payments SDK | `ecommerce`, `balanced` |
| Accounts, balances, transactions, transfers | `fintech`, `balanced` |
| MDX, a CMS client, `/blog`, `/docs` | `content`, `airy` |
| One landing page with sections (hero, pricing, testimonials) | `marketing`, `airy` |
| Profiles, feeds, social actions, mobile-first layout | `consumer-app`, `balanced` |

## B2 · Present the draft and ask

One message, in the developer's language and register. Title: *"Esto es lo que entiendo de tu
producto"*. A table with one row per field: **field · proposal · evidence (`file:line`)**.

| Field | What it is for (say it once, in one line) | Allowed values |
|---|---|---|
| Producto | The type sets density, scale and tone | `saas-dashboard`, `ecommerce`, `fintech`, `content`, `marketing`, `internal-tool`, `consumer-app`, `other`, plus a one-line description |
| Usuarios | Who designs are for | role or kind of person |
| Tarea principal | What they come to do | one sentence |
| Contexto | Where and how often | device (desktop, mobile, both) · frequency (daily, occasional) |
| Personalidad | The impression the UI must make | 3 adjectives |
| Densidad | How much information fits on a screen | compacta, equilibrada, aireada |
| Color de marca | The color the palette is built from | a CSS color, or ninguno |
| Tipografía | The family in use, if any | family and `file:line`, or ninguna |
| Referencias | Products whose look or feel they admire | 1 to 3 names or URLs, or ninguna |
| Evitar | What it must not look like | short list, or nada |
| Accesibilidad | The contrast and size target | WCAG 2.2 AA (default) or AAA |
| Modo oscuro | Whether it needs one | sí, no, más adelante |

Then ask **at most 3 questions**, only for what has no evidence, each with suggested options:
- **Personalidad:** offer 3 sets that fit the product type (for a `saas-dashboard`: *confiable ·
  clara · sobria*, *ágil · precisa · moderna*, *cercana · simple · tranquila*), plus "otra".
- **Referencias:** "¿qué productos te gustan cómo se ven, o cuáles no querés parecerte?". Say they
  are stored as text: facha-ui does not open them.
- **Evitar:** suggest the usual generic look as options (degradados decorativos, todo en tarjetas
  iguales, grises sin matiz) and let them add their own.

End with one question: *"¿Lo guardo así, o qué cambiás?"*. Answers the developer gives replace
the proposals; a brand color is recorded only if the developer confirms it or writes it.

## B3 · Approval

Only an explicit yes in this conversation counts (hard rule 3 of `SKILL.md`). If the developer
changes something, show the final brief again and ask again. Ask for **the reason** too: why this
direction (one sentence, recorded verbatim).

## B4 · Write

Append to `memory.decisionsFile` with the Edit tool (Write only if the file does not exist, with a
`# Design decisions` heading). Id `dec-<YYYY-MM-DD>-brief`, adding `-2`, `-3`… if it exists. The
field labels and the product ids stay exactly as shown, because `get_design_system` parses them;
the values go in the developer's language:

```markdown
## dec-YYYY-MM-DD-brief · Brief de diseño: <the product in a few words>
- **Fecha:** YYYY-MM-DD
- **Producto:** `<type>` — <one-line description>
- **Usuarios:** <who>
- **Tarea principal:** <one sentence>
- **Contexto:** <device> · <frequency>
- **Personalidad:** <a>, <b>, <c>
- **Densidad:** <compacta | equilibrada | aireada>
- **Color de marca:** `<color>` | ninguno
- **Tipografía:** <family> (`<file:line>`) | ninguna
- **Referencias:** <a>, <b> | ninguna
- **Evitar:** <a>, <b> | nada
- **Accesibilidad:** WCAG 2.2 <AA | AAA>
- **Modo oscuro:** <sí | no | más adelante>
- **Motivo (dev):** "<the developer's reason, verbatim>"
- **Evidencia:** <the file:line list behind the proposals>
```

## B5 · Validate

Call `get_design_system` (section `brief`): its `id` is the new entry and `invalid` is empty. If a
field is in `invalid`, fix that line of the entry you just wrote (only that entry, in this same run)
and validate again.

## B6 · Report and next step

Say, in 3 to 5 lines:
- the decision id and the brief in one sentence ("panel compacto para analistas, confiable y
  claro, sin color de marca todavía");
- that it is now a source: `/facha-ui:variants` uses it in its diagnosis (who uses the screen and
  how) and cites its id;
- the next step, as a command for the developer:
  - no tokens (`status: missing`): `/facha-ui:init`, which proposes tokens from the values in use;
    with the brief, the brand color and the density say which proposals come first;
  - with tokens: *"mejorá la pantalla `<route>`"* for the screen the brief's main task lives on.

Remind them that nothing was committed.
