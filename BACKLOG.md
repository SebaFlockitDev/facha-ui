# Backlog

Lo que falta desarrollar en facha-ui, en orden. Es la fuente de verdad de **qué sigue**: `SPEC.md`
dice qué es y cómo funciona, `CHANGELOG.md` qué cambió y `CLAUDE.md` cómo se trabaja.

**Cómo se usa** (Spec-Driven Development):

1. Al empezar una sesión, se toma el primer ítem de **Ahora**.
2. Se escribe su spec en `docs/specs/B-NNN-<tema>.md` (por qué, plan, criterios, tareas, decisiones,
   registro y cómo retomar) y se aprueba el plan antes de implementar. Mientras el ítem dura, cada
   avance se anota ahí: es lo que permite retomarlo desde otra sesión.
3. Se implementa en una rama, con tests que cubren sus criterios de aceptación.
4. Al hacer release, el ítem pasa a **Hecho** con su versión, y lo que haya surgido entra en **Ideas**.

Lo que aparece mientras se trabaja se anota en **Ideas**; no se hace sin aprobación. Los estudios
que originan ítems (de mercado, de estándares) van en `docs/research/`.

**Formato de cada ítem:** `### B-NNN · Título`, con estos campos:
- **Estado:** `listo para spec`, `en spec`, `aprobado`, `en curso`, `hecho (0.x.0)` o `descartado`;
- **Prioridad:** `P0` (bloquea el uso), `P1` (alta), `P2` (media) o `P3` (baja);
- **Tamaño:** `S` (horas), `M` (un día) o `L` (varios días);
- **Por qué**, **Qué** y **Criterios de aceptación**;
- **Depende de** y **Referencias**, si corresponde;
- **Spec:** el archivo de `docs/specs/`, desde que el ítem pasa a `en spec`.

**Ahora** tiene como máximo 3 ítems. Los ids no se reutilizan.

## Ahora

### B-046 · Editar una pantalla sin pedir variantes
- **Estado:** en spec
- **Prioridad:** P1 · **Tamaño:** M
- **Por qué:** el panel en vivo solo aparece en las variantes: para ajustar la pantalla real hay que pedir variantes primero. La industria edita sobre la app corriendo (Lovable Visual Edits, Onlook, Builder.io, la barra de Vercel), pero casi siempre escribe directo en el código, sin validar ni pedir OK.
- **Qué:** "Editar esta pantalla" en el centro abre la pantalla original en el laboratorio (el componente real, no una copia) con el mismo panel; el primer cambio crea por detrás una variante de edición validada por el guardián, que el panel muestra desde ahí; se aplica con `/facha-ui:apply` como cualquier variante. El panel sobre la app en su ruta real queda para después (en Next obliga a tocar el layout).
- **Criterios de aceptación:** se puede marcar y pedir cambios sobre la pantalla original sin pedir variantes; el archivo original no cambia hasta `apply`; cada cambio pasa por el guardián; el centro muestra el comando para aplicarla.
- **Spec:** [`docs/specs/B-046-editar-pantalla.md`](docs/specs/B-046-editar-pantalla.md)
- **Referencias:** `skills/variants/live.md`, `skills/variants/templates/next-app/lab-panel.tsx`

### B-033 · Accesibilidad en ejecución sobre el laboratorio
- **Estado:** listo para spec
- **Prioridad:** P2 · **Tamaño:** M
- **Por qué:** el análisis estático no ve el contraste real con capas, ni el tamaño final de los objetivos, ni los nombres accesibles; axe-core sí.
- **Qué:** correr axe-core, empaquetado y sin red, sobre cada variante del laboratorio, y sumar los hallazgos a la revisión y a `ux_score`.
- **Criterios de aceptación:** hallazgos con criterio WCAG y selector; se decide cómo se inyecta axe sin ampliar las herramientas de Playwright permitidas (regla dura 6) o se amplían con su justificación.
- **Referencias:** [estudio](docs/research/2026-10-15-herramientas-de-diseno.md), https://storybook.js.org/docs/9/writing-tests/accessibility-testing.md

## Siguiente

### B-005 · Regla `ux-missing-states`
- **Estado:** listo para spec
- **Prioridad:** P1 · **Tamaño:** M
- **Por qué:** las listas sin estado vacío ni de error son el error de UX más común (`ux:state-empty`, `ux:state-error`); hoy es una señal de `review_ui`.
- **Qué:** una pantalla que renderiza una lista (`.map`) sin rama de vacío ni de error recibe un aviso.
- **Criterios de aceptación:** positivos y negativos en un fixture; no marca listas que ya manejan ambos estados.
- **Referencias:** SPEC §6

### B-006 · Regla `copy-error-action`
- **Estado:** listo para spec
- **Prioridad:** P2 · **Tamaño:** S
- **Por qué:** un error sin acción deja a la persona sin salida (`ux:copy-actionable-errors`).
- **Qué:** un mensaje de error sin botón de reintentar, enlace o siguiente paso cerca recibe un aviso.
- **Criterios de aceptación:** positivos y negativos en un fixture.
- **Referencias:** SPEC §6

### B-007 · Regla `ux-too-many-choices`
- **Estado:** listo para spec
- **Prioridad:** P2 · **Tamaño:** S
- **Por qué:** muchas opciones al mismo nivel demoran la decisión (`ux:hick`).
- **Qué:** más de 7 acciones hermanas al mismo nivel (botones de una barra, ítems de menú sin agrupar) reciben un aviso.
- **Criterios de aceptación:** positivos y negativos en un fixture; el umbral es configurable.
- **Referencias:** SPEC §6

### B-009 · Regla `unknown-class`
- **Estado:** listo para spec
- **Prioridad:** P2 · **Tamaño:** L
- **Por qué:** la IA inventa clases que no existen ni en Tailwind ni en el CSS del proyecto.
- **Qué:** marcar clases sin utilidad de Tailwind ni regla CSS del proyecto, resolviendo las utilidades con el motor de Tailwind empaquetado (sin ejecutar código del proyecto).
- **Criterios de aceptación:** detecta clases inventadas en un fixture; 0 falsos positivos en los fixtures de Tailwind 3 y 4.
- **Referencias:** SPEC §6

### B-010 · Mensajes del guardián en español
- **Estado:** listo para spec
- **Prioridad:** P3 · **Tamaño:** M
- **Por qué:** hoy los mensajes salen en inglés y Claude los traduce.
- **Qué:** opción `locale` en la config, con mensajes en español.
- **Criterios de aceptación:** con `locale: "es"`, los mensajes de todas las reglas salen en español; sin la opción, no cambia nada.
- **Referencias:** SPEC §6

## Después

### B-034 · `DESIGN.md` y tokens en formato DTCG
- **Estado:** listo para spec
- **Prioridad:** P2 · **Tamaño:** M
- **Por qué:** los equipos diseñan también en otras herramientas (Stitch, Claude Design, v0, tweakcn); facha-ui puede ser la capa que verifica en el repo lo que llega de ellas. El formato W3C DTCG tiene su primera versión estable (2025.10). Absorbe B-019.
- **Qué:** `init` exporta los tokens en DTCG y un `DESIGN.md` con la intención de cada color y regla; `get_design_system` lee un `DESIGN.md` o un JSON DTCG como fuente, y `check_ui` verifica lo que llega.
- **Criterios de aceptación:** ida y vuelta sin pérdidas para colores, tipografía, espaciado y radios; fixtures de `DESIGN.md` y DTCG; antes de la spec se confirma el formato publicado de `DESIGN.md`.
- **Referencias:** [estudio](docs/research/2026-10-15-herramientas-de-diseno.md), https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/ , https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-design-md/

### B-011 · CI de violaciones
- **Estado:** listo para spec
- **Prioridad:** P2 · **Tamaño:** M
- **Por qué:** el puntaje de UX ya tiene modo CI (§7.20); las violaciones no.
- **Qué:** `facha-ui audit --baseline` falla si aparecen violaciones nuevas.
- **Criterios de aceptación:** sale con código 1 solo ante violaciones nuevas respecto de la línea base.
- **Referencias:** SPEC §6

### B-012 · `apply` abre un PR
- **Estado:** listo para spec
- **Prioridad:** P2 · **Tamaño:** M
- **Qué:** con GitHub MCP, `apply` abre un PR con las capturas antes y después y la entrada de `decisions.md`.
- **Criterios de aceptación:** el PR se abre solo con aprobación explícita y contiene el plan aplicado.
- **Referencias:** SPEC §6

### B-013 · Diff visual entre pantallas
- **Estado:** listo para spec
- **Prioridad:** P3 · **Tamaño:** L
- **Qué:** cuando `apply` cambia un componente compartido, capturar antes y después de las otras pantallas que lo usan.
- **Criterios de aceptación:** el plan de `apply` lista las pantallas afectadas y el diff las incluye.
- **Referencias:** SPEC §6

### B-014 · Plugins y presets de Tailwind 3
- **Estado:** listo para spec
- **Prioridad:** P3 · **Tamaño:** L
- **Qué:** reconocer lo que agregan los presets y plugins más comunes sin ejecutar código (hoy se informan y se declaran en `tailwind.mapped`).
- **Criterios de aceptación:** un proyecto con un preset conocido no recibe falsos `tailwind-default-scale`; el config sigue sin ejecutarse (test S2).
- **Referencias:** SPEC §2.0.2, §7.23

### B-015 · Colores como canales RGB
- **Estado:** listo para spec
- **Prioridad:** P3 · **Tamaño:** S
- **Qué:** igual que los canales HSL, con evidencia `rgb(var(--x))`.
- **Criterios de aceptación:** canales RGB con evidencia se leen como color con contraste; sin evidencia, nada cambia.
- **Referencias:** SPEC §2.0.2

### B-016 · Postergados técnicos del MVP
- **Estado:** listo para spec
- **Prioridad:** P3 · **Tamaño:** L
- **Qué:**
  - directivas `facha-ui-ignore-next-line` (§2.a.4);
  - resources `facha-ui://design-system/decisions` y `facha-ui://config` (§2.a.5);
  - `outputSchema` en las tools (§2.a.1);
  - JSON Schemas publicados de la config y del run (§2.0.2, §2.b.5);
  - fixtures sintéticos pendientes (MCP-8) y el criterio de rendimiento MCP-11 (§5.1);
  - SEC-1 automatizado (§5.2);
  - `roots/list` del cliente MCP (§2.0.2);
  - `sourceHash`/`designSystemHash` en el run y `apply --discard` (§2.b.5, §2.c.1).
- **Criterios de aceptación:** se separa en un ítem por punto antes de empezar cualquiera, cada uno con sus propios criterios.
- **Referencias:** SPEC §7.2

## Ideas

Sin evaluar: entran a **Siguiente** o **Después** con su spec, o pasan a **Descartado**.

- **B-041 · `responsive-table-scroll` con CSS modules:** visto en B-040: una tabla dentro de un contenedor con `overflow-x: auto` definido en un CSS module (`styles.scroll`) recibe el aviso igual, porque la regla no resuelve la clase del módulo. Que lea el CSS module importado por el archivo.
- **B-039 · Marca monocroma en el tema oscuro:** visto en B-028 con una referencia monocroma (shadcn/ui): con una marca casi negra, el generador la deja igual en oscuro y el botón queda casi negro sobre casi negro. shadcn la invierte (blanco en oscuro). Que el generador invierta una marca sin croma en el tema oscuro, con su texto, y lo pruebe como siempre.
- **B-017 · Más frameworks de laboratorio:** Remix/React Router como framework, Astro, Expo.
- **B-018 · Otros lenguajes de UI:** Vue, Svelte, Angular (adapters de fuente).
- **B-020 · Export para Cursor:** los flujos de `variants` y `apply` como reglas de Cursor.
- **B-021 · Ejecución fuera de Claude Code:** el mismo flujo como agente (LangGraph, Strands) reutilizando el MCP.
- **B-022 · UI web de configuración:** editor visual de `facha-ui.config.json`, roles y reglas `custom`.
- **B-037 · `near-duplicate-tokens` según el rol:** visto en la prueba de B-025: la regla de paleta inflada compara tokens de cualquier rol, y en un sistema generado marca pares que se parecen por diseño (fondo y panel, que son los pasos 1 y 2 de Radix; el blanco del texto sobre acento y el casi blanco del fondo). Su propia nota dice que se ignoren "si son roles distintos": que la regla los deje afuera y siga marcando los del mismo rol.
- **B-035 · `scan_styles` en un proyecto sin temas:** visto en la prueba de B-024, sobre una app sin ningún bloque de tema: las propuestas salen con `values: {}` (falta el valor del tema por defecto), un gris de texto secundario (`#475569`, usado en "Cancelado", `.muted` y encabezados) se propone como `--status-danger-fg`, y el color de marca se parte en dos propuestas, una como `status.info`. Con un brief, su color de marca debería proponerse como `accent.primary`.

## Hecho

El detalle de cada versión está en `CHANGELOG.md` y en SPEC §7.

- **0.35.0:** B-045, «¿Cuántas querés?» en el centro («3 para comparar» de entrada o «1 rápida», recordada en el navegador); spec en [`docs/specs/B-045-cuantas-variantes.md`](docs/specs/B-045-cuantas-variantes.md).
- **0.34.0:** B-044, el centro en vivo (escucha real con la señal del watcher, «Volver a medir», la evolución por proyecto y pantalla, y «Elegir esta»), y el arreglo de `review_ui` con las variantes del laboratorio; spec en [`docs/specs/B-044-centro-en-vivo.md`](docs/specs/B-044-centro-en-vivo.md).
- **0.33.0:** B-043, `ux_score` y `review_ui` con pantallas de Vite (lo que monta el router, con su ruta, y las carpetas por convención; la opción `screens` de la config), y el arreglo del frontmatter de `center`; spec en [`docs/specs/B-043-ux-score-vite.md`](docs/specs/B-043-ux-score-vite.md).
- **0.32.0:** B-042, el centro facha-ui (`/facha-ui:center`): el proyecto y sus pantallas en una página, variantes con un objetivo y una captura subida, y el comando exacto para `init`; spec en [`docs/specs/B-042-centro-facha-ui.md`](docs/specs/B-042-centro-facha-ui.md).
- **0.31.0:** B-040, `variants` con una captura de referencia para la estructura (la variante C la adapta y cita sus regiones); spec en [`docs/specs/B-040-variantes-desde-una-captura.md`](docs/specs/B-040-variantes-desde-una-captura.md).
- **0.30.0:** B-028, `/facha-ui:init reference <url|image>`: un design system a partir de una página que te gusta, con el informe de lo que no pasaba el contraste; spec en [`docs/specs/B-028-de-referencias-a-tokens.md`](docs/specs/B-028-de-referencias-a-tokens.md).
- **0.29.0:** B-038, el panel en vivo lee y escribe `oklch()`, `hsl()` y los canales HSL de shadcn/ui, y pinta la marca gris; spec en [`docs/specs/B-038-panel-con-oklch.md`](docs/specs/B-038-panel-con-oklch.md).
- **0.28.0:** B-004, la regla `a11y-color-only` (un estado que se muestra solo con color, WCAG 1.4.1); spec en [`docs/specs/B-004-a11y-color-only.md`](docs/specs/B-004-a11y-color-only.md).
- **0.27.0:** B-030, componentes del proyecto en `get_design_system`, la regla `ds-component-reuse` con el import exacto y la cobertura del design system en `ux_score`; spec en [`docs/specs/B-030-componente-reimplementado.md`](docs/specs/B-030-componente-reimplementado.md).
- **0.26.0:** B-032 (absorbe B-008), matriz completa de contraste en `get_design_system`, contraste sin redondear y sugerencias que conservan el significado; spec en [`docs/specs/B-032-matriz-de-contraste.md`](docs/specs/B-032-matriz-de-contraste.md).
- **0.25.0:** B-031 (incluye B-036), controles de diseño en el panel en vivo: tono, grises, radio, alto de controles y contraste del texto, con presets de Radix y el contraste y los conflictos recalculados en cada cambio; spec en [`docs/specs/B-031-controles-de-diseno-en-el-panel.md`](docs/specs/B-031-controles-de-diseno-en-el-panel.md).
- **0.24.0:** B-029, reglas del guardián para las partes del look genérico de IA que rompen una regla publicada (`ux-gray-on-color`, `a11y-gradient-text`, `a11y-motion`) y la señal `nested-surfaces`; spec en [`docs/specs/B-029-reglas-contra-el-look-generico.md`](docs/specs/B-029-reglas-contra-el-look-generico.md).
- **0.23.0:** B-027, perfiles por tipo de producto (escala, controles, tokens y pautas con fuente, desde el brief); spec en [`docs/specs/B-027-perfiles-por-tipo-de-producto.md`](docs/specs/B-027-perfiles-por-tipo-de-producto.md).
- **0.22.0:** B-026, tres direcciones (semilla + estilo) sobre la pantalla real y una página de muestra, en el laboratorio, antes de escribir; spec en [`docs/specs/B-026-direcciones-sobre-la-pantalla-real.md`](docs/specs/B-026-direcciones-sobre-la-pantalla-real.md).
- **0.21.0:** B-025, design system desde estándares (`propose_design_system`, `/facha-ui:init system`); spec en [`docs/specs/B-025-generador-de-design-system.md`](docs/specs/B-025-generador-de-design-system.md).
- **0.20.0:** B-024, brief de diseño para un proyecto sin diseño (`/facha-ui:init brief`, sección `brief` de `get_design_system`); spec en [`docs/specs/B-024-brief-de-diseno.md`](docs/specs/B-024-brief-de-diseno.md).
- **0.19.1:** B-023, el "Connection closed" del MCP en sesiones abiertas en el repo de facha-ui (los servidores pasan a `plugin.json`).
- **0.19.0:** B-003, el revisor independiente ve las capturas (verificado; sin cambios de código).
- **0.19.0:** B-002, providers reales en el laboratorio de Vite (entry leído de forma estática) y variantes que fallan sin dejar la página en blanco.
- **0.18.1:** B-001, el laboratorio de Vite se rompía antes del modo en vivo (faltaba `lab-panel.tsx` en el andamiaje).
- **0.18.0:** modo en vivo en React + Vite.
- **0.17.0:** laboratorio de variantes en React + Vite.
- **0.16.0:** primer uso (`/facha-ui:start`), modo rápido y guardián automático.
- **0.15.0:** compatibilidad con shadcn/ui.

## Descartado

### B-008 · Sugerencias de contraste que respetan el significado
- **Estado:** descartado
- **Prioridad:** P1 · **Tamaño:** M
- **Por qué:** `theme-contrast` puede sugerir para un texto rojo de error un gris secundario: el aviso pasa a parecer información común.
- **Qué:** la sugerencia conserva el significado (estado, acento, texto) y, si no hay token que lo cumpla, lo reporta como brecha.
- **Criterios de aceptación:** un texto de error con contraste bajo recibe un token de error legible o una brecha, nunca un gris.
- **Referencias:** SPEC §6
- **Motivo:** absorbido por B-032 (matriz completa de contraste), que incluye su criterio de aceptación.

- **B-019 · Otros formatos de tokens:** DTCG, Style Dictionary, SCSS, CSS-in-JS (styled-components, Emotion). Absorbido por B-034 (DTCG); el resto de los formatos sigue abierto si se vuelve a pedir.
