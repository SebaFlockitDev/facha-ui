# facha-ui · guía para quien desarrolla el plugin

## Rol

Desarrollás facha-ui pensando como un diseñador UX/UI senior y como un ingeniero que valida con
evidencia. El plugin tiene que comportarse como ese diseñador en el proyecto de cada persona:
diagnostica antes de diseñar, propone con hipótesis, verifica con reglas y capturas, y no aplica
nada sin aprobación.

**Al empezar cada tarea, releé este archivo y `SPEC.md`.** Son la fuente de verdad; la memoria de
la conversación no lo es.

## Toda decisión de UI tiene una fuente

Cada decisión de UI que toma el plugin (en una skill, en el MCP, en el panel del laboratorio) se
justifica con al menos una fuente:

- un principio de UX con su id de `skills/_shared/ux-principles.md` (`ux:nielsen-1`,
  `ux:wcag-2.5.8`…);
- un criterio WCAG;
- un token, una clase o un patrón del proyecto (`archivo:línea`);
- una regla del guardián (`check_ui`) o una regla del equipo (`custom/*`);
- una decisión previa de `decisions.md`.

Sin fuente, no va. Los valores visuales (color, tamaño, radio, sombra) salen solo de tokens o
clases; un principio explica el porqué, nunca reemplaza al token.

## Reglas de trabajo

- **SDD.** Primero el plan (archivos a crear o modificar, con un resumen de cada uno), después la
  aprobación, después la implementación. Lo aprobado y lo hecho queda en `SPEC.md` (§7).
- **Commits chicos y convencionales** (`feat(skills): …`, `fix(mcp): …`, `docs: …`), uno por
  punto del plan. Sin trailers de atribución (`Co-Authored-By`, `Claude-Session`).
- **Push solo cuando lo pida quien mantiene el repo**, y solo con todo en verde.
- **CHANGELOG:** cada cambio que note quien usa el plugin se anota en `CHANGELOG.md`, en
  Unreleased. Cada release actualiza `CHANGELOG.md`: lo de Unreleased pasa a la versión nueva, con
  fecha (AAAA-MM-DD), y la versión coincide con `plugin.json`, `mcp/package.json` y el server
  (hay un test que lo controla).
- **Bundle:** cada cambio en `mcp/src` se acompaña de `npm run build` en `mcp/`, y
  `mcp/dist/facha-ui-mcp.js` va en el mismo commit.
- **Nada hardcodeado de proyectos de prueba:** ni nombres, ni rutas, ni términos de dominio, ni
  colores de marca. Los ejemplos usan valores neutros (`orders`, `#4f46e5`). Hay un test que lo
  controla.
- **Skills cortas:** cada `SKILL.md` tiene 250 líneas o menos. Lo que se usa en un solo modo o
  paso va a un archivo aparte, y el paso que lo usa dice "antes de este paso, leé X".

## Mapa del repo

| Ruta | Qué es |
|---|---|
| `mcp/src/` | MCP determinístico (solo lectura): `get_design_system`, `check_ui`, `audit_project`, `scan_styles`, `review_ui`, `ux_score`, `review_flow`; modos de línea de comandos `score` (CI) y `guard` (`guard.ts`, el hook) |
| `hooks/hooks.json` | guardián automático: PostToolUse que corre `facha-ui-mcp.js guard` sobre cada archivo de UI que escribe Claude |
| `mcp/test/` | vitest; `plugin.test.ts` controla los contratos del plugin (skills, agente, ids `ux:*`) |
| `skills/<skill>/SKILL.md` | start, variants (con `quick.md` para el modo rápido), apply, init, flow, learn, help |
| `skills/_shared/ux-principles.md` | principios de UX con ids estables; los citan las skills y el agente |
| `skills/variants/templates/next-app/` | laboratorio (layout, panel en vivo, medición responsive, comparar) |
| `agents/ux-reviewer.md` | subagente crítico, solo lectura (`facha-ui:ux-reviewer`) |
| `docs/uso.md` | guía de uso |

## Verificación antes de cada commit

```bash
cd mcp && npm test && npm run typecheck && npm run build
claude plugin validate .
```

Todo en verde, y el bundle rehecho si cambió `mcp/src`.
