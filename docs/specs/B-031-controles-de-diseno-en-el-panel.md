# B-031 · Controles de diseño en el panel en vivo

> **Estado:** en spec · **Rama:** `feat/panel-design-controls` · **Ítem:** [BACKLOG.md](../../BACKLOG.md) ·
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

## Plan (propuesto, pendiente de aprobación)

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

## Decisiones a confirmar

1. **Incluir B-036** (presets con fuente) en este ítem. Recomendado: toca la misma parte del panel.
2. **"Densidad" se limita al alto de controles y de filas**; el espaciado no se toca. Recomendado:
   mover una escala de espacios ajena no tiene fuente.
3. **Contraste en dos niveles: AA (4.5) y AAA (7)**, los que define WCAG. Material tiene niveles
   más altos, pero no tienen un criterio de accesibilidad detrás.

## Criterios de aceptación

- [ ] Cada cambio muestra los pares que dejan de pasar WCAG y una solución.
- [ ] La combinación elegida queda como propuesta en `.facha-ui/proposals/`.
- [ ] Fuera del laboratorio no cambia ningún archivo.
- [ ] La lógica del panel tiene tests, y sus constantes coinciden con `standards.ts`.

## Tareas

- [ ] 1. `lab-palette.ts` (lógica pura y controles nuevos), tests
- [ ] 2. `lab-panel.tsx`: controles, informe, presets (B-036), propuesta
- [ ] 3. `palette-base.mjs` y `live-core.ts`: tokens de radio y alto; tests
- [ ] 4. Skills: `lab.md` (andamiaje), `live.md` (L6), `init` (modo paleta); contratos
- [ ] 5. Docs
- [ ] 6. Prueba real
- [ ] 7. Release

## Decisiones tomadas durante el trabajo

(ninguna todavía)

## Registro

- **2026-10-16:** relevado el panel; spec escrito y plan presentado, pendiente de aprobación.

## Cómo retomar

Esperar la aprobación del plan. Con el OK: "Plan (propuesto…)" pasa a "Plan aprobado (fecha)", el
estado a `en curso`, y se arranca por la tarea 1 en `feat/panel-design-controls`.
