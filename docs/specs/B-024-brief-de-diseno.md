# B-024 · Brief de diseño para un proyecto sin diseño

> **Estado:** en curso · **Rama:** `feat/design-brief` · **Ítem:** [BACKLOG.md](../../BACKLOG.md) ·
> **Origen:** [estudio de herramientas](../research/2026-10-15-herramientas-de-diseno.md) ·
> **Última actualización:** 2026-10-15

## Por qué

En un proyecto sin tokens ni dirección visual, `init` solo ordena los valores que ya están en el
código: no propone un diseño. Un diseñador primero entiende el producto. Las herramientas que mejor
resuelven el inicio (Google Stitch, Readdy, la skill frontend-design de Anthropic) arrancan con una
entrevista corta. El brief es la primera pieza del bloque "diseño desde cero" (B-024 → B-025
generador → B-026 tres direcciones sobre la pantalla real).

## Plan aprobado (2026-10-15)

**Comportamiento.** Como un diseñador en la primera reunión: Claude lee el código y muestra un
**brief ya completado** ("esto es lo que entiendo de tu producto"), con la evidencia de cada
respuesta (`archivo:línea`). El dev corrige lo que no corresponde, y Claude pregunta solo lo que el
código no puede saber (como máximo 3 cosas: personalidad, referencias y qué evitar).

**Campos:** tipo de producto (`saas-dashboard`, `ecommerce`, `fintech`, `content`, `marketing`,
`internal-tool`, `consumer-app`, `other`; alimenta los perfiles de B-027), quién lo usa y su tarea
principal, contexto (dispositivo y frecuencia), 3 rasgos de personalidad, densidad (compacta,
equilibrada o aireada), color de marca o "ninguno", tipografía en uso, 1 a 3 referencias (como texto,
sin abrirlas: el MCP no usa la red), qué evitar, nivel de accesibilidad (AA por defecto) y modo
oscuro (sí, no o más adelante).

**Archivos:**

1. `mcp/src/brief.ts` (nuevo) y `design-system.ts`: sección `brief` de `get_design_system`. Lee la
   entrada `dec-AAAA-MM-DD-brief` más reciente de `decisions.md` y devuelve los campos estructurados,
   cada uno con su `archivo:línea`; valida tipo de producto, densidad y color; un valor inválido se
   informa en `invalid`, no se adivina; sin brief, `null`. `server.ts` (descripción), bundle.
2. `mcp/test/brief.test.ts`: brief completo, el más reciente gana, etiquetas en inglés, campos
   faltantes, valores inválidos, texto con instrucciones como dato, sin `decisions.md`, y la sección a
   través del MCP.
3. `skills/init/brief.md` (nuevo): el modo `/facha-ui:init brief`. Preflight con evidencia →
   brief completado + hasta 3 preguntas → aprobación explícita → agregar la entrada a `decisions.md`
   (lo único que escribe) → validar con `get_design_system` → informe y siguiente paso. Hasta que
   exista B-025, el siguiente paso es `/facha-ui:init` desde el uso, con el brief para priorizar.
4. `skills/init/SKILL.md`: `brief` en los argumentos, con "antes de este modo, leé `brief.md`"; sin
   tokens ni brief, ofrece arrancar por el brief. Sigue en 250 líneas o menos.
5. `skills/start/SKILL.md`: sin tokens ni brief → `/facha-ui:init brief`; sin tokens con brief →
   `/facha-ui:init`; con design system y sin brief, el brief como alternativa.
6. `skills/variants/SKILL.md`: el diagnóstico (paso 3b) toma quién usa la pantalla y su contexto
   del brief y lo cita con su id. Sigue en 250 líneas.
7. `skills/help/SKILL.md` y `mcp/test/plugin.test.ts` (contratos: `brief.md` existe, `init` lo
   referencia, `start` lo recomienda, `variants` lo cita).
8. Docs: SPEC (sección del brief en `init` y §7.30), `docs/uso.md` (empezar sin diseño),
   `CHANGELOG.md` (Unreleased).
9. Commits: `feat(mcp)`, `feat(skills)`, `docs`. Prueba en la app de Vite de prueba: armar un brief,
   verificarlo con `get_design_system` y que `start` recomiende lo correcto.

**Fuera de alcance:** el brief no escribe tokens (B-025) ni muestra direcciones (B-026).

## Criterios de aceptación (del backlog)

- [ ] En un proyecto sin tokens, `start` recomienda el brief.
- [ ] Cada pregunta trae opciones sugeridas con su evidencia del código.
- [ ] El brief se guarda solo con el sí del dev, en `decisions.md` con id.
- [x] `get_design_system` lo devuelve (test).
- [ ] `variants` lo cita en sus hipótesis.

## Tareas

- [x] 1–2. MCP: `brief.ts`, sección `brief`, descripción de la tool (también en SPEC §2.a.3),
  tests y bundle · `5211ba0`
- [ ] 3. `skills/init/brief.md`
- [ ] 4. `skills/init/SKILL.md`
- [ ] 5. `skills/start/SKILL.md`
- [ ] 6. `skills/variants/SKILL.md`
- [ ] 7. `skills/help/SKILL.md` y contratos en `plugin.test.ts`
- [ ] 8. Docs: SPEC §2.c.4 y §7.30, `docs/uso.md`, `CHANGELOG.md`
- [ ] 9. Prueba en la app de Vite de prueba y release

## Decisiones tomadas durante el trabajo

- **El brief vive en `decisions.md`**, como una decisión más (`dec-<fecha>-brief`), y no en
  `facha-ui.config.json`: es una decisión de diseño del equipo, se lee en el diff y ya es una fuente
  válida según `CLAUDE.md`. Un brief nuevo no borra el anterior: el último gana (por fecha y luego
  por posición) y los anteriores quedan en `history`.
- **El lector va en un módulo propio** (`mcp/src/brief.ts`), no dentro de `design-system.ts` como
  decía el plan: es más claro y se testea aparte. `design-system.ts` solo lo expone.
- **Ids en inglés, etiquetas en español:** el tipo de producto y la densidad tienen ids estables en
  inglés (los usa B-027); las etiquetas que escribe la skill son en español y el lector acepta
  también las inglesas (`Product`, `Density`…) y las palabras en español de la densidad.

## Registro

- **2026-10-15:** plan aprobado. Tareas 1–2 hechas (`5211ba0`), 223 tests en verde. La prueba de
  etiquetas en inglés encontró un bug antes del commit: un tipo sin backticks con guion
  (`consumer-app`) se cortaba en el guion; corregido.

## Cómo retomar

Seguir por la tarea 3 (`skills/init/brief.md`), en la rama `feat/design-brief`. Releer antes
`skills/init/SKILL.md` (está en 245 líneas: el puntero a `brief.md` tiene que entrar sin pasar
de 250) y la regla dura 2 de `init` (los valores salen solo de `scan_styles` o del dev: el brief
solo guarda el color de marca que diga el dev).
