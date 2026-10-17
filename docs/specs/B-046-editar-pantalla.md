# B-046 · Editar una pantalla sin pedir variantes

> **Estado:** en spec · **Rama:** `feat/edit-screen` · **Ítem:** [BACKLOG.md](../../BACKLOG.md) ·
> **Origen:** el desarrollador quiso entrar a editar sin tener que pedir una variante · **Última actualización:** 2026-10-16

## Por qué

El panel en vivo (marcar elementos, pedir cambios, mejorar con un clic, probar paletas) aparece solo en las
variantes del laboratorio. Para ajustar la pantalla tal como está, hoy hay que pedir variantes primero, aunque lo
que se quiera sea "esto, pero con el botón arriba".

La industria resuelve esto editando sobre la app corriendo: Lovable (Visual Edits), Onlook, Builder.io, la barra de
Vercel y el modo diseño de v0. Casi todas escriben directo en el código, sin validar ni pedir OK. facha-ui no puede
hacer eso: nada se aplica sin aprobación y el guardián valida antes (`CLAUDE.md`, hard rule 7 de `variants`).

## Cómo funciona hoy (relevado el 2026-10-16)

- Una variante es `<lab.dir>/<slug>/<x>/Page.tsx` (Vite) o `page.tsx` (Next). Las letras válidas son
  `^[a-z][0-9]?$` en el endpoint (`live-core.ts:106`) y en el laboratorio de Vite (`main.tsx:148`).
- Un cambio pedido desde el panel sigue `live.md` L3, que corre R1 a R7 de `refine.md` sobre esa variante.
- `apply` toma una variante de `.facha-ui/runs/<slug>.json` y solo si su `status` es `valid`
  (`apply/SKILL.md:70`); su `argument-hint` dice `<a|b|c>`.
- `variants` Step 1 frena si ya hay una corrida: la edición no debe frenar por eso, porque no toca A, B ni C.

## Plan propuesto

| Archivo | Cambio |
|---|---|
| `skills/variants/edit.md` (nuevo) | El modo edición. **E1:** si `<lab.dir>/<slug>/e/` existe, se reabre. Si no, se copia la pantalla tal cual a la variante **E**: la primera línea del contrato del laboratorio, los imports reescritos para la carpeta nueva y ningún otro cambio. **E2:** el guardián mide la copia (es la línea base de E). **E3:** E entra en `.facha-ui/runs/<slug>.json`: se suma a la corrida que haya, sin tocar A, B ni C, o se crea una con `"mode": "edit"`. Queda `valid` con 0 errores, o `draft` con los errores que ya tenía la pantalla. **E4:** el estado `done` lleva el enlace. Desde ahí, cada cambio sobre E sigue `refine.md` como cualquier variante. |
| `skills/variants/SKILL.md` | En *Inputs*, el modo edición ("antes de E1, leé `edit.md`"), reescribiendo líneas para seguir en 250. |
| `skills/center/SKILL.md` | C5: el pedido `edit` sigue `../variants/edit.md`. |
| `skills/apply/SKILL.md` | `argument-hint` `<a|b|c|e>`. Con una E en `draft`, explica qué falta: "pedí «arreglá lo que marca el guardián»". |
| `facha-live/live-core.ts` | Pedido `edit` (solo en una sesión de proyecto, para una pantalla de `center.json`). |
| `lab-center.tsx` | En cada pantalla, **"Editar esta pantalla"**, botón secundario al lado de "Proponer variantes". Con una E existente pasa a **"Seguir editando"** y abre la E sin pedir nada. Mientras se prepara: "Preparando la edición…". Cuando termina: **"Abrir la edición"**, un enlace que el desarrollador elige abrir: la página no navega sola (`ux:nielsen-3`). |
| `lab-panel.tsx` | En la variante E, el encabezado dice **"Edición de tu pantalla"**, con una línea: "Es una copia: tu archivo no cambia hasta que la apliques". Con E en `draft`, dice cuántos errores heredó y ofrece "Arreglá lo que marca el guardián" como mejora de un clic. |
| Tests | `live.test.ts`: `edit` solo en sesión de proyecto y para una pantalla conocida. `plugin.test.ts`: los contratos de `edit.md` (copia sin cambios, imports reescritos, nunca tocar el original ni A/B/C), del centro (los dos botones, sin navegar solo) y del panel. |
| Docs | `docs/uso.md`, `help`, SPEC §2.i y §7.46, CHANGELOG. |

## Decisiones (recomendación en negrita)

1. **Copia desde el principio o vista del original.**
   - **A (recomendada): E nace como copia fiel.** Un solo modelo mental ("estás editando E; tu archivo no
     cambia"). Usa todo lo que ya existe: el panel, `refine.md`, comparar y `apply`.
   - B: mostrar el original importado y copiar recién con el primer cambio. Es más exacto al principio, pero el panel
     cambia de página a mitad de la edición.
2. **La letra.** **`e`, fija.** Se reconoce ("E de edición"), no choca con A, B y C, y una sola edición por
   pantalla evita confusiones; "Seguir editando" la reabre.
3. **Si la pantalla ya tiene errores del guardián.** **E queda `draft`** y `apply` no la acepta hasta que tenga 0.
   Hoy la copia heredaría los errores y quedaría `failed`, que se lee como "no funcionó". `draft` dice la verdad:
   "es tu pantalla, con lo que ya tenía".
4. **El panel sobre la app en su ruta real** (como la barra de Vercel). **Queda para otro ítem**: en Next obliga a
   tocar el layout de la app.

## Fuera de este ítem

- El panel sobre la app en su ruta real.
- Editar varias pantallas a la vez.

## Criterios de aceptación

- [ ] Desde el centro, "Editar esta pantalla" abre la pantalla con el panel, sin pedir variantes.
- [ ] El archivo original no cambia hasta `apply`, y A, B y C no se tocan.
- [ ] Cada cambio pasa por el guardián; con errores heredados, E queda `draft` y el panel dice qué falta.
- [ ] El centro muestra el comando para aplicar la E.

## Tareas

- [ ] 1. El endpoint (`edit`) y `edit.md`; `variants`, `center` y `apply`; tests y contratos
- [ ] 2. El centro y el panel; contratos
- [ ] 3. Docs
- [ ] 4. Prueba real (editar `orders` desde el centro, pedir un cambio, ver la E y el comando)
- [ ] 5. Release

## Decisiones tomadas durante el trabajo

(ninguna todavía)

## Registro

- **2026-10-16:** pedido del desarrollador; agregado al backlog (B-046) con su OK junto con B-045. Relevado; spec y
  plan escritos, pendientes de aprobación.

## Cómo retomar

Plan propuesto, esperando la aprobación del desarrollador.
