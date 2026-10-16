# B-038 · Colores `oklch()` y HSL en el panel en vivo

> **Estado:** en spec · **Rama:** `feat/panel-oklch` · **Ítem:** [BACKLOG.md](../../BACKLOG.md) ·
> **Origen:** visto en B-031 ([spec](B-031-controles-de-diseno-en-el-panel.md), decisión 11) ·
> **Última actualización:** 2026-10-16

## Por qué

shadcn/ui es la base más común de los proyectos React de hoy, y la pestaña **Diseño** del panel en
vivo no funciona en ninguna de sus dos formas:
- con Tailwind 4 los tokens están en `oklch()` (`--primary: oklch(0.205 0 0)`);
- con Tailwind 3 son canales HSL sueltos (`--primary: 222.2 47.4% 11.2%`).

`palette-base.mjs` y `lab-palette.ts` solo leen hex y `rgb()`: no hay base, y el panel no muestra la
pestaña. El MCP ya lee los dos formatos (culori, y `format: "hsl-channels"` desde 0.15.0).

## Cómo funciona hoy (relevado el 2026-10-16)

- `palette-base.mjs:61`: un token es de color si su valor tiene `#…` o `rgb(`.
- `lab-palette.ts:94`: `COLOR_RE`, `parseColor` y `formatColor` conocen hex, hex8 y `rgb()`.
- El endpoint (`live-core.ts`) acepta los valores de los dos formatos: letras, números, espacios,
  paréntesis, `%`, `.` y `/`.
- shadcn por defecto tiene la **marca gris** (`--primary` casi negro en claro, casi blanco en oscuro): un
  cambio de tono no tiene a qué aplicarse, porque el tono solo corre los colores con croma.

## Plan (propuesto, pendiente de aprobación)

### 1. Leer y escribir los formatos del proyecto (`lab-palette.ts`)

- `parseColor` lee `oklch(L C H [/ a])` (L en número o %), `hsl()` y `hsla()`, y los canales HSL
  sueltos de un token marcado como tal.
- `formatColor` escribe cada valor nuevo **en el formato que tenía**: `oklch()` con 3 decimales,
  `hsl()`, o canales sueltos. Así la propuesta y `/facha-ui:init palette` cambian el número y no el
  estilo del archivo.

### 2. La base y el endpoint

- `palette-base.mjs` reconoce `oklch()`, `hsl()` y los tokens con `format: "hsl-channels"` (como los
  reporta `get_design_system`), y pasa ese `format` en la base.
- `live-core.ts` conserva el `format` de cada token al servir la base.

### 3. La marca gris

Cuando la marca no tiene color (croma menor a 0.04, como el `--primary` por defecto de shadcn), un
preset o el deslizador de tono **pintan la marca** con el color del preset (el paso 9 de Radix, en los
dos temas). El texto sobre la marca se mide como siempre y avisa si deja de leerse. Los presets ya
traen su hex (`lab-palette.ts`, `PRESETS`). Con el deslizador, se usa el croma del paso 9 de índigo.

### 4. Docs y pruebas

- `docs/uso.md` (6.6), CHANGELOG.
- Tests de `lab-palette.ts`: ida y vuelta de `oklch()` y de canales sin cambiar el formato; la marca gris
  toma el color del preset; `palette-base.mjs` sobre `shadcn-tw3` y `shadcn-tw4` da la base.
- Prueba real en el navegador sobre un proyecto shadcn con Tailwind 4.

## Decisiones para confirmar

1. **Escribir cada valor en el formato que tenía** (recomendado): `oklch()` sigue en `oklch()`, los
   canales siguen en canales. La alternativa es escribir todo en hex, que es más simple pero cambia el
   estilo del archivo del equipo.
2. **Con la marca gris, los presets la pintan** (recomendado): es lo que se espera al tocar "Índigo"
   en un proyecto shadcn recién creado. La alternativa es dejarla gris y que el tono no haga nada, como
   hoy.

## Criterios de aceptación

- [ ] La pestaña Diseño aparece en un proyecto shadcn con Tailwind 4 (`oklch()`) y con Tailwind 3
  (canales HSL).
- [ ] La propuesta escribe los valores en el formato del proyecto.
- [ ] Con la marca gris, un preset la pinta en los dos temas y el contraste del texto sobre ella se mide.

## Tareas

- [ ] 1. `lab-palette.ts`: formatos y marca gris, tests
- [ ] 2. `palette-base.mjs` y `live-core.ts`, tests
- [ ] 3. Docs
- [ ] 4. Prueba real
- [ ] 5. Release

## Decisiones tomadas durante el trabajo

(ninguna todavía)

## Registro

- **2026-10-16:** relevado; spec escrito y plan presentado, pendiente de aprobación.

## Cómo retomar

Esperar la aprobación del plan y de las dos decisiones. Con el OK: "Plan (propuesto…)" pasa a "Plan
aprobado (fecha)", el estado a `en curso`, y se arranca por la tarea 1 en `feat/panel-oklch`.
