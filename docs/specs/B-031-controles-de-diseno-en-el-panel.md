# B-031 · Controles de diseño en el panel en vivo

> **Estado:** en curso (falta el release) · **Rama:** `feat/panel-design-controls` · **Ítem:** [BACKLOG.md](../../BACKLOG.md) ·
> **Origen:** [estudio de herramientas](../research/2026-10-15-herramientas-de-diseno.md) ·
> **Última actualización:** 2026-10-16

## Por qué

Ajustar el diseño con controles directos y ver el efecto en el momento ya es lo esperable (Claude
Design, Realtime Colors, tweakcn). Hoy el panel solo prueba paletas armadas o un color propio:
cambia el tono de la marca y de los grises teñidos, y nada más.

## Cómo funciona hoy (relevado el 2026-10-16)

- `palette-base.mjs` arma la base desde `get_design_system`, solo con tokens de color (sin estados,
  radios ni tamaños), y Claude la guarda en `.facha-ui/live/palette.json` (`live.md`, L1.5).
- `lab-panel.tsx` calcula la paleta en el navegador (`computePalette`: corre el tono de los colores
  cercanos a la marca y escala su croma), la aplica con un `<style>`, mide el contraste del texto y de
  la marca contra las superficies, y lista los conflictos nuevos con su solución.
- "Proponer" manda los valores al endpoint, que los valida contra `palette.json` (tokens y temas que
  existen, valores sin llaves ni `url()`). Claude escribe `.facha-ui/proposals/palette-*.json` (L6), y
  solo `/facha-ui:init palette` escribe tokens, con aprobación.
- Nada de esa lógica tiene tests: vive dentro del componente.

## Plan aprobado (2026-10-16)

### 1. Cinco controles, cada uno con su fuente

| Control | Qué cambia | Valores | Fuente |
|---|---|---|---|
| **Tono** | La familia de la marca (como hoy) | Deslizador 0–360°, presets y "tu color" | — (lo elige el dev) |
| **Tinte de los grises** | Los neutros: superficies, textos y bordes casi sin croma | De gris puro a teñido con el tono de la marca | Radix: gris puro (*gray*) y grises teñidos (croma medido por luminosidad) |
| **Radio** | Los tokens de radio, en proporción al radio base | 0, 4, 8, 12 o 16px | Escala de esquinas de Material 3 |
| **Alto de controles** | `--size-control` y `--size-row`, si el sistema los tiene | 32, 40 o 48px | Carbon (sm, md, lg); WCAG 2.5.8 |
| **Contraste** | Los textos que no llegan: se oscurecen (claro) o aclaran (oscuro) lo mínimo | Estándar (4.5:1) o Alto (7:1) | WCAG 1.4.3 y 1.4.6 |

- Un control que el sistema no puede usar se muestra desactivado, con el motivo (por ejemplo, "tu
  sistema no tiene un token de alto de controles").
- El **espaciado no se toca**: ninguna fuente dice cuánto mover una escala de espacios ajena.

### 2. La lógica sale del componente y se testea (`lab-palette.ts`)

Un template nuevo, puro, compartido por Next y Vite: `computePalette`, el tinte, el radio, el alto de
controles, el ajuste de contraste, el informe de contraste y los conflictos. `lab-panel.tsx` lo
importa. Sus constantes (croma de los grises de Radix, escala de Material, alturas de Carbon) son
copias de `mcp/src/standards.ts`, y un test controla que coincidan.

### 3. Lo que ya existe se extiende

- `palette-base.mjs` suma los tokens de radio y de alto de controles a la base.
- `live-core.ts` los acepta en la propuesta (mismas validaciones).
- El panel muestra, con cada cambio, **los pares que dejan de pasar WCAG** (texto, texto secundario,
  marca, borde de controles) y su solución; y, con contraste alto, qué textos ajustó.
- "Proponer" manda todos los tokens que cambiaron, con un nombre que resume la combinación
  ("Índigo · radio 12 · contraste alto").
- `live.md` (L6) e `init` (modo paleta) aceptan tokens que no son de color: la tabla los muestra, y el
  contraste se mide solo sobre los colores.

### 4. B-036 (de Ideas): presets con fuente

Los presets de hoy traen afirmaciones sin fuente ("El más usado en bancos y fintech: transmite
seguridad"). Pasan a ser los acentos de Radix (índigo, azul, cyan, teal, ciruela, violeta) más
"Grafito" (solo neutros), nombrados por su escala y sin afirmaciones de mercado. Los conflictos con
los estados ya se calculan en el momento.

### 5. Tests, docs y prueba

- Tests de `lab-palette.ts` (tinte 0 da gris puro y 1 da el croma de Radix; el radio respeta
  `full`; el contraste alto deja todo texto en 7:1; conflictos), de las constantes, de `live-core`
  con tokens de radio y de los presets sin afirmaciones.
- El andamiaje copia `lab-palette.ts` (Next y Vite); un laboratorio viejo lo recibe (`lab.md`).
- SPEC, `docs/uso.md` (6.6, modo en vivo), `CHANGELOG.md`.
- Prueba en la app de prueba de Vite, en el navegador.

## Decisiones confirmadas (2026-10-16: las tres recomendadas)

1. **Incluir B-036** (presets con fuente) en este ítem. Recomendado: toca la misma parte del panel.
2. **"Densidad" se limita al alto de controles y de filas**; el espaciado no se toca. Recomendado:
   mover una escala de espacios ajena no tiene fuente.
3. **Contraste en dos niveles: AA (4.5) y AAA (7)**, los que define WCAG. Material tiene niveles
   más altos, pero no tienen un criterio de accesibilidad detrás.

## Criterios de aceptación

- [x] Cada cambio muestra los pares que dejan de pasar WCAG y una solución (probado en el navegador: marca como texto y texto de los botones con un color propio claro).
- [x] La combinación elegida queda como propuesta en `.facha-ui/proposals/` (el endpoint la acepta con el radio; L6 escribe `from`/`to`).
- [x] Fuera del laboratorio no cambia ningún archivo (`src/index.css` de la app de prueba intacto).
- [x] La lógica del panel tiene tests, y sus constantes coinciden con `standards.ts`.

## Tareas

- [x] 1. `lab-palette.ts` (lógica pura y controles nuevos), tests
- [x] 2. `lab-panel.tsx`: controles, informe, presets (B-036), propuesta
- [x] 3. `palette-base.mjs` y `live-core.ts`: tokens de radio y alto; tests
- [x] 4. Skills: `lab.md` (andamiaje), `live.md` (L1, L6), `init` (modo paleta en `palette.md`), `apply`; contratos
- [x] 5. Docs (SPEC §2.b y §7.35, `docs/uso.md` 5.1 y 6.6, `help`, CHANGELOG)
- [x] 6. Prueba real
- [ ] 7. Release (cuando lo pida quien mantiene el repo)

## Decisiones tomadas durante el trabajo

1. **La pestaña pasa de "Paleta" a "Diseño"**: ahora cambia radios, alturas y contraste, no solo
   colores, y el nombre tiene que decir lo que hace (`ux:nielsen-2`).
2. **El modo paleta de `init` va a `skills/init/palette.md`**: `init/SKILL.md` tenía 247 de 250
   líneas, y la regla del repo dice que lo que se usa en un solo modo va aparte.
3. **Se mide el texto sobre la marca** (`--on-primary` sobre `--primary`, WCAG 1.4.3): la prueba
   real mostró texto blanco sobre un cyan claro (1.8:1) sin aviso. Se empareja por nombre
   (`--on-primary`, `--color-on-primary`, `--primary-foreground`) o, si hay uno solo, el único
   `on-accent`.
4. **Los conflictos de contraste van uno por token y tema**, con la peor superficie y cuántas más
   fallan: la marca sobre tres superficies eran tres líneas casi iguales (`ux:nielsen-8`).
5. **La razón se trunca** (`formatRatio`: 4.49 se lee 4.4): redondear decía "baja a 4.5:1 (mínimo
   4.5:1)", el mismo error que se corrigió en B-025.
6. **La vista previa escribe cada token cambiado en todos los temas**: con el valor solo en `:root`,
   su `!important` le ganaba a la declaración normal del tema oscuro del proyecto.
7. **El endpoint guarda hasta 120 tokens de la base** (antes 80): con radios y alturas, un sistema
   generado podía quedarse sin sus radios en silencio.
8. **Un panel viejo se actualiza al activar el modo en vivo** (L1, si no importa `./lab-palette`):
   es UI de facha-ui, y sin eso un laboratorio existente nunca vería los controles.
9. **El test del andamiaje lee imports de varias líneas**: el de una línea no veía el import de
   `lab-palette`, y un andamiaje sin ese archivo habría roto el laboratorio de Vite (como B-001).
10. **El test importa `lab-palette.ts` en tiempo de ejecución**, como `live.test.ts` con
    `live-core.ts`: las plantillas están fuera del `rootDir` de `mcp/`. Se verificó aparte con
    `tsc --strict --noUncheckedIndexedAccess`.
11. **Colores `oklch()`: fuera de este ítem** (idea B-038). `palette-base.mjs` y `lab-palette.ts` solo
    leen hex y `rgb()`, así que un proyecto shadcn/ui con Tailwind 4 no tiene pestaña Diseño.

## Registro

- **2026-10-16:** relevado el panel; spec escrito y plan presentado, pendiente de aprobación.
- **2026-10-16:** plan aprobado con las tres decisiones recomendadas.
- **2026-10-16:** tarea 1 (`lab-palette.ts` y 12 tests); tarea 2 (`lab-panel.tsx` importa la lógica, pestaña
  Diseño con los cinco controles); tarea 3 (`palette-base.mjs` y el endpoint con radios y alturas);
  tarea 4 (`lab.md`, `live.md` L1 y L6, `init/palette.md`, `apply`, contratos); B-036 absorbido;
  idea B-038.
- **2026-10-16, prueba real** (app de prueba de Vite con la pantalla `orders`, modo en vivo emulado
  como L1, panel en el navegador):
  - los presets, el deslizador de tono, los grises puros, el radio 16px y el contraste alto se ven
    en toda la app; el contraste alto ajustó `--text-muted` y llegó a 7.0:1; sin token de alto, el
    control aparece desactivado con su motivo;
  - un color propio claro (`#22d3ee`) mostró sus conflictos con solución; ahí se encontró que faltaba
    medir el texto de los botones (decisión 3) y que los conflictos se repetían (decisión 4);
  - con tono 247° en el tema oscuro, el título quedó oscuro sobre oscuro con el informe en verde:
    el `!important` de `:root` pisaba el tema oscuro (decisión 6). Corregido y medido en la página:
    `--text` vale lo que dice el informe;
  - *Proponer este diseño* llegó al endpoint (202) con nombre, colores, `--radius` y los conflictos;
    L6 emulado escribió la propuesta con `from`/`to` y el panel mostró "Propuesta lista";
  - la elección sobrevive a la recarga; *Volver al original* deja todo como estaba; la app no cambió
    fuera del laboratorio.
- **2026-10-16:** docs (SPEC §2.b y §7.35, guía, `help`, CHANGELOG). 336 tests en verde.

## Cómo retomar

Todo está hecho y probado en `feat/panel-design-controls`; falta el release (tarea 7), solo cuando
quien mantiene el repo lo pida: versión 0.25.0 en `plugin.json`, `mcp/package.json`, el lockfile y
`server.ts`; CHANGELOG de Unreleased a 0.25.0 con fecha y enlaces del pie; B-031 a **Hecho**
(incluye B-036); merge `--no-ff` a `main`, tag, push y actualizar el plugin.
