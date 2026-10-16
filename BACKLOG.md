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

### B-031 · Controles de diseño en el panel en vivo
- **Estado:** en curso
- **Prioridad:** P1 · **Tamaño:** M
- **Por qué:** ajustar el diseño con controles directos y ver el efecto en el momento ya es lo esperable (Claude Design, Realtime Colors, tweakcn); hoy el panel solo prueba paletas armadas.
- **Qué:** en el panel, controles de tono, tinte de los neutros, radio, alto de controles y nivel de contraste (AA o AAA de WCAG), aplicados a la variante con el contraste recalculado en el momento. Nada se escribe hasta `/facha-ui:init palette`. Incluye B-036 (presets con fuente).
- **Criterios de aceptación:** cada cambio muestra los pares que dejan de pasar WCAG y una solución; la combinación elegida queda como propuesta en `.facha-ui/proposals/`; fuera del laboratorio no cambia ningún archivo.
- **Depende de:** B-025
- **Spec:** [`docs/specs/B-031-controles-de-diseno-en-el-panel.md`](docs/specs/B-031-controles-de-diseno-en-el-panel.md)
- **Referencias:** [estudio](docs/research/2026-10-15-herramientas-de-diseno.md), `skills/variants/live.md`, https://www.realtimecolors.com/docs/how-it-works

## Siguiente

### B-032 · Matriz completa de contraste
- **Estado:** listo para spec
- **Prioridad:** P1 · **Tamaño:** M
- **Por qué:** hoy se controla el contraste de los pares que aparecen en el código; un sistema accesible garantiza cada texto sobre cada fondo donde puede aparecer. Además, `theme-contrast` puede sugerir para un texto rojo de error un gris secundario, y el aviso pasa a parecer información común (absorbe B-008).
- **Qué:** cada token de texto contra cada fondo posible, en claro y oscuro; WCAG 2.2 decide y APCA se informa como dato orientativo. Las sugerencias conservan el significado (estado, acento, texto) y, si ningún token lo cumple, lo reportan como brecha.
- **Criterios de aceptación:** la matriz sale en `get_design_system` o en `audit_project`; un texto de error con contraste bajo recibe un token de error legible o una brecha, nunca un gris (criterio de B-008).
- **Referencias:** [estudio](docs/research/2026-10-15-herramientas-de-diseno.md), SPEC §6, https://adrianroselli.com/2026/04/wcag3-contrast-as-of-april-2026.html

### B-030 · Componente reimplementado y cobertura del design system
- **Estado:** listo para spec
- **Prioridad:** P2 · **Tamaño:** M
- **Por qué:** la IA suele rehacer a mano lo que el proyecto ya tiene como componente; Lovable y v0 ya controlan que se use el sistema.
- **Qué:** un aviso cuando se arma a mano un elemento que el proyecto ya tiene como componente (un `<button>` con clases, existiendo `components/ui/button`), con el import sugerido. `ux_score` suma la cobertura: cuánto de la UI usa componentes y tokens del sistema.
- **Criterios de aceptación:** positivo y negativo en el fixture de shadcn; la cobertura sale en `ux_score` (test).
- **Referencias:** [estudio](docs/research/2026-10-15-herramientas-de-diseno.md), https://docs.lovable.dev/features/design-systems

### B-004 · Regla `a11y-color-only`
- **Estado:** listo para spec
- **Prioridad:** P1 · **Tamaño:** M
- **Por qué:** un estado que se distingue solo por color falla WCAG 1.4.1 (`ux:wcag-1.4.1`); hoy solo lo ve la revisión.
- **Qué:** el guardián marca chips, puntos o filas de estado cuyo único diferenciador es una clase o token de color, sin texto ni ícono en el mismo elemento.
- **Criterios de aceptación:** positivos y negativos en un fixture; 0 falsos positivos en los fixtures existentes; `ux-principles.md` la pasa a "verificado por el guardián".
- **Referencias:** SPEC §6 (reglas UX), `skills/_shared/ux-principles.md`

### B-028 · De referencias a tokens
- **Estado:** listo para spec
- **Prioridad:** P2 · **Tamaño:** L
- **Por qué:** "quiero algo como esta página" es la forma más natural de pedir un estilo, y ya es estándar (Stitch, Visily, Uizard, Banani).
- **Qué:** extraer colores y tipografías de una captura o de una página de referencia y normalizarlos en escalas accesibles con B-025, informando qué valor de la referencia no pasaba contraste y cuál lo reemplaza.
- **Criterios de aceptación:** antes de la spec se decide cómo convive con S2 (el MCP no usa la red): la captura la toma la skill, con permiso del dev, y el MCP solo lee el archivo; cada valor extraído dice de dónde salió.
- **Depende de:** B-025
- **Referencias:** [estudio](docs/research/2026-10-15-herramientas-de-diseno.md), https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-updates/

### B-033 · Accesibilidad en ejecución sobre el laboratorio
- **Estado:** listo para spec
- **Prioridad:** P2 · **Tamaño:** M
- **Por qué:** el análisis estático no ve el contraste real con capas, ni el tamaño final de los objetivos, ni los nombres accesibles; axe-core sí.
- **Qué:** correr axe-core, empaquetado y sin red, sobre cada variante del laboratorio, y sumar los hallazgos a la revisión y a `ux_score`.
- **Criterios de aceptación:** hallazgos con criterio WCAG y selector; se decide cómo se inyecta axe sin ampliar las herramientas de Playwright permitidas (regla dura 6) o se amplían con su justificación.
- **Referencias:** [estudio](docs/research/2026-10-15-herramientas-de-diseno.md), https://storybook.js.org/docs/9/writing-tests/accessibility-testing.md

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

- **B-017 · Más frameworks de laboratorio:** Remix/React Router como framework, Astro, Expo.
- **B-018 · Otros lenguajes de UI:** Vue, Svelte, Angular (adapters de fuente).
- **B-020 · Export para Cursor:** los flujos de `variants` y `apply` como reglas de Cursor.
- **B-021 · Ejecución fuera de Claude Code:** el mismo flujo como agente (LangGraph, Strands) reutilizando el MCP.
- **B-022 · UI web de configuración:** editor visual de `facha-ui.config.json`, roles y reglas `custom`.
- **B-037 · `near-duplicate-tokens` según el rol:** visto en la prueba de B-025: la regla de paleta inflada compara tokens de cualquier rol, y en un sistema generado marca pares que se parecen por diseño (fondo y panel, que son los pasos 1 y 2 de Radix; el blanco del texto sobre acento y el casi blanco del fondo). Su propia nota dice que se ignoren "si son roles distintos": que la regla los deje afuera y siga marcando los del mismo rol.
- **B-038 · Colores `oklch()` en el panel en vivo:** visto en B-031: `palette-base.mjs` y `lab-palette.ts` solo leen colores hex y `rgb()`, así que un proyecto con los tokens en `oklch()` (shadcn/ui con Tailwind 4, como el fixture `shadcn-tw4`) no tiene base y el panel no muestra la pestaña Diseño. Leerlos, y escribir los valores nuevos en `oklch()`, el formato del proyecto.
- **B-035 · `scan_styles` en un proyecto sin temas:** visto en la prueba de B-024, sobre una app sin ningún bloque de tema: las propuestas salen con `values: {}` (falta el valor del tema por defecto), un gris de texto secundario (`#475569`, usado en "Cancelado", `.muted` y encabezados) se propone como `--status-danger-fg`, y el color de marca se parte en dos propuestas, una como `status.info`. Con un brief, su color de marca debería proponerse como `accent.primary`.

## Hecho

El detalle de cada versión está en `CHANGELOG.md` y en SPEC §7.

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
