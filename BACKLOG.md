# Backlog

Lo que falta desarrollar en facha-ui, en orden. Es la fuente de verdad de **qué sigue**: `SPEC.md`
dice qué es y cómo funciona, `CHANGELOG.md` qué cambió y `CLAUDE.md` cómo se trabaja.

**Cómo se usa** (Spec-Driven Development):

1. Al empezar una sesión, se toma el primer ítem de **Ahora**.
2. Se escribe su plan (archivos, criterios de aceptación) y se aprueba antes de implementar.
3. Se implementa en una rama, con tests que cubren sus criterios de aceptación.
4. Al hacer release, el ítem pasa a **Hecho** con su versión, y lo que haya surgido entra en **Ideas**.

Lo que aparece mientras se trabaja se anota en **Ideas**; no se hace sin aprobación.

**Formato de cada ítem:** `### B-NNN · Título`, con estos campos:
- **Estado:** `listo para spec`, `en spec`, `aprobado`, `en curso`, `hecho (0.x.0)` o `descartado`;
- **Prioridad:** `P0` (bloquea el uso), `P1` (alta), `P2` (media) o `P3` (baja);
- **Tamaño:** `S` (horas), `M` (un día) o `L` (varios días);
- **Por qué**, **Qué** y **Criterios de aceptación**;
- **Depende de** y **Referencias**, si corresponde.

**Ahora** tiene como máximo 3 ítems. Los ids no se reutilizan.

## Ahora

### B-003 · El revisor independiente ve las capturas
- **Estado:** listo para spec
- **Prioridad:** P1 · **Tamaño:** S
- **Por qué:** `facha-ui:ux-reviewer` está registrado, pero no se confirmó que pueda leer los PNG que recibe; sin capturas, revisa solo el código.
- **Qué:** una corrida de `variants` con capturas en la que el revisor cite evidencia de una captura (archivo y zona).
- **Criterios de aceptación:** la revisión cita al menos un hallazgo con evidencia de captura; si no puede leerlas, `SKILL.md` lo dice y el revisor avisa que revisó solo el código.
- **Referencias:** `agents/ux-reviewer.md`, SPEC §7.22

## Siguiente

### B-023 · El MCP de facha-ui no conecta en algunas sesiones
- **Estado:** listo para spec
- **Prioridad:** P1 · **Tamaño:** S
- **Por qué:** en una sesión de Claude Code abierta en el repo de facha-ui, el servidor figuró como "Connection closed", aunque el bundle 0.18.0 instalado, corrido a mano con `--root` sobre la misma carpeta, arranca y responde. Sin MCP no hay guardián ni design system.
- **Qué:** reproducir (sesión nueva, después de actualizar, en un repo con y sin frontend), leer el log del servidor (stderr) y corregir la causa; si es del entorno, que `start` y la guía digan cómo resolverlo.
- **Criterios de aceptación:** se identifica la causa con evidencia; si es del plugin, un test la cubre y el servidor conecta en una sesión nueva; si es del entorno, `docs/uso.md` lo explica en Problemas frecuentes.
- **Referencias:** `.mcp.json`, `mcp/src/index.ts`, SPEC §7.10

### B-004 · Regla `a11y-color-only`
- **Estado:** listo para spec
- **Prioridad:** P1 · **Tamaño:** M
- **Por qué:** un estado que se distingue solo por color falla WCAG 1.4.1 (`ux:wcag-1.4.1`); hoy solo lo ve la revisión.
- **Qué:** el guardián marca chips, puntos o filas de estado cuyo único diferenciador es una clase o token de color, sin texto ni ícono en el mismo elemento.
- **Criterios de aceptación:** positivos y negativos en un fixture; 0 falsos positivos en los fixtures existentes; `ux-principles.md` la pasa a "verificado por el guardián".
- **Referencias:** SPEC §6 (reglas UX), `skills/_shared/ux-principles.md`

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

### B-008 · Sugerencias de contraste que respetan el significado
- **Estado:** listo para spec
- **Prioridad:** P1 · **Tamaño:** M
- **Por qué:** `theme-contrast` puede sugerir para un texto rojo de error un gris secundario: el aviso pasa a parecer información común.
- **Qué:** la sugerencia conserva el significado (estado, acento, texto) y, si no hay token que lo cumpla, lo reporta como brecha.
- **Criterios de aceptación:** un texto de error con contraste bajo recibe un token de error legible o una brecha, nunca un gris.
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
- **B-019 · Otros formatos de tokens:** DTCG, Style Dictionary, SCSS, CSS-in-JS (styled-components, Emotion).
- **B-020 · Export para Cursor:** los flujos de `variants` y `apply` como reglas de Cursor.
- **B-021 · Ejecución fuera de Claude Code:** el mismo flujo como agente (LangGraph, Strands) reutilizando el MCP.
- **B-022 · UI web de configuración:** editor visual de `facha-ui.config.json`, roles y reglas `custom`.

## Hecho

El detalle de cada versión está en `CHANGELOG.md` y en SPEC §7.

- **0.19.0:** B-002, providers reales en el laboratorio de Vite (entry leído de forma estática) y variantes que fallan sin dejar la página en blanco.
- **0.18.1:** B-001, el laboratorio de Vite se rompía antes del modo en vivo (faltaba `lab-panel.tsx` en el andamiaje).
- **0.18.0:** modo en vivo en React + Vite.
- **0.17.0:** laboratorio de variantes en React + Vite.
- **0.16.0:** primer uso (`/facha-ui:start`), modo rápido y guardián automático.
- **0.15.0:** compatibilidad con shadcn/ui.

## Descartado

Nada por ahora.
