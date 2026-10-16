# B-038 · Colores `oklch()` y HSL en el panel en vivo

> **Estado:** en curso (falta el release) · **Rama:** `feat/panel-oklch` · **Ítem:** [BACKLOG.md](../../BACKLOG.md) ·
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

## Plan aprobado (2026-10-16)

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

## Decisiones confirmadas (2026-10-16: las dos recomendadas)

1. **Escribir cada valor en el formato que tenía** (recomendado): `oklch()` sigue en `oklch()`, los
   canales siguen en canales. La alternativa es escribir todo en hex, que es más simple pero cambia el
   estilo del archivo del equipo.
2. **Con la marca gris, los presets la pintan** (recomendado): es lo que se espera al tocar "Índigo"
   en un proyecto shadcn recién creado. La alternativa es dejarla gris y que el tono no haga nada, como
   hoy.

## Criterios de aceptación

- [x] La pestaña Diseño aparece en un proyecto shadcn con Tailwind 4 (`oklch()`) y con Tailwind 3
  (canales HSL).
- [x] La propuesta escribe los valores en el formato del proyecto.
- [x] Con la marca gris, un preset la pinta en los dos temas y el contraste del texto sobre ella se mide.

## Tareas

- [x] 1. `lab-palette.ts`: formatos y marca gris, tests · `7788dca`
- [x] 2. `palette-base.mjs` y `live-core.ts`, tests · `9e9c047`
- [x] 3. Docs
- [x] 4. Prueba real (con las correcciones `d97c6a6`, `8832882` y la de la marca como texto)
- [ ] 5. Release

## Decisiones tomadas durante el trabajo

1. **`oklch()` se convierte a sRGB** para medir y previsualizar: un color fuera de sRGB (P3) se acerca
   al más cercano. Los valores que no cambian quedan como estaban.
2. **La solución para el texto sobre la marca dice la dirección:** blanco o negro según cuál contrasta
   más con la marca (luminancia bajo 0.179, el punto de cruce de la fórmula de WCAG), y lo mismo para la
   marca como texto. Salió de la prueba real: en oscuro, el texto casi negro de shadcn sobre índigo pedía
   "un texto oscuro" y lo que se lee es blanco (5.2:1 contra 4.0:1).
3. **Un commit quedó con un test fallando** (`d97c6a6`, la primera versión de esa dirección): se
   encadenó el commit sin cortar ante el fallo. Lo corrige `8832882`; desde ahí, el commit va solo si la
   suite pasa.
4. **Grafito no pinta la marca gris**: es "la marca casi sin color".

## Registro

- **2026-10-16:** relevado; spec escrito y plan presentado, pendiente de aprobación.
- **2026-10-16:** plan aprobado con las dos decisiones recomendadas.
- **2026-10-16:** tareas 1 a 3; 365 tests en verde.
- **2026-10-16, prueba real:** una copia de la app de Vite con los tokens de shadcn con Tailwind 4
  (`oklch()`, marca gris) y el modo en vivo: la pestaña Diseño aparece; Índigo pinta la marca como
  `oklch(0.544 0.191 267)` (el paso 9 de Radix) en claro y en oscuro; en oscuro avisa la marca como texto
  (2.9:1) y el texto de los botones (3.4:1), con las soluciones en la dirección correcta. Los canales HSL
  de Tailwind 3 quedan probados en los tests (ida y vuelta) y en la base de `shadcn-tw3`.

## Cómo retomar

Todo hecho y probado en `feat/panel-oklch`; falta el release (tarea 5), solo cuando quien mantiene
el repo lo pida: versión 0.29.0 con el flujo de `CLAUDE.md`; B-038 a **Hecho**.
