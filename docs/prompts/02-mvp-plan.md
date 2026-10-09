<!--
  Prompt 02 · Plan de implementación MVP AI Day (T0..T4)
  Fecha: 2026-10-09 · Autor: Seba Adrover
  Resultado: SPEC.md §7 + implementación por tareas
  El texto de abajo es el prompt original. Solo se reemplazaron las referencias al proyecto de prueba (privado) por marcadores genéricos.
-->

Aprobado el SPEC como visión v0.1, muy buen trabajo, en especial el Anexo A.
Quedan ~3 horas, así que hoy implementamos un **MVP del AI Day**. Agregá al
SPEC una sección "7. Plan de implementación: MVP AI Day" con esta lista de
incluido/excluido; lo excluido pasa al roadmap (§6). No borres nada del resto.

INCLUIDO HOY
T0 · Spike (15 min, sin código de producto):
  - Verificá con `npm view <pkg> version` cada versión del §2.a.1 y de Playwright
    MCP; corregí el SPEC con las reales.
  - Confirmá `${CLAUDE_PROJECT_DIR}` en .mcp.json; si no está, fallback a --root/cwd.
T1 · MCP facha-ui (prioridad máxima):
  - Config mínima: tokens.sources, themes (autodetección :root / .dark /
    html.dark / [data-theme]), include/exclude, lab.dir, preview.baseUrl.
    Sin JSON Schema publicado: validá con zod.
  - --root apunta directo al proyecto frontend (sin MULTIPLE_PROJECTS ni roots/list).
  - Adapters: tokens css-custom-properties (postcss), fuentes jsx (babel) y css.
    Solo framework next-app.
  - Reglas: color-literal, tailwind-arbitrary-value, unknown-token,
    inline-style. Sugerencia exact/nearest/none con compatibilidad de rol.
  - health: contraste de tokens de texto vs. superficies por tema (solo
    token a token, no por uso). Así detectamos los títulos invisibles en dark.
  - 3 tools con las descripciones literales del SPEC; resources: tokens y rules.
  - Tests: 1 fixture sintético + snapshot de las 3 pruebas del §5.3 sobre
    `<proyecto de prueba>/frontend`. Más MCP-2 (solo lectura) y MCP-7 (grep de
    hardcodeo).
T2 · Skill variants: flujo §2.b.2 completo, solo Next, viewport desktop,
  capturas light y dark, run JSON sin schema formal.
T3 · Skill apply: flujo §2.c.1 sin sourceHash/designSystemHash ni --discard.
T4 · Plugin: plugin.json, marketplace.json, .mcp.json con run-pinned.mjs
  (estoy en Windows), README con instalación y demo.

EXCLUIDO HOY (roadmap)
vite-react, tailwind-palette-color, tailwind-default-scale, theme-contrast
por uso, reglas custom, directivas facha-ui-ignore, resources decisions y
config, outputSchema, bundle esbuild (usá tsc), JSON Schemas publicados,
fixtures b/c/d, MCP-11 rendimiento, SEC-1 automatizado.

Reglas de trabajo:
- Commits chicos y convencionales al terminar cada tarea (T0..T4).
- Al terminar T1, frená y mostrame las 3 pruebas antes de seguir.
- Guardá este prompt en docs/prompts/02-mvp-plan.md.
Empezá por T0.
