# facha-ui

Plugin de Claude Code que trabaja como un diseñador UI senior dentro de tu proyecto: arma o completa tu design system, diseña pantallas con él, te deja ajustarlas y probar paletas en vivo, valida cada resultado con reglas objetivas y no aplica nada sin tu aprobación.

En su núcleo es un **optimizador de UI con el design system**: generás con IA variantes de un componente o de una pantalla, y facha-ui las ajusta hasta que respetan los tokens y las reglas de tu equipo. Todo lo demás se construye sobre esa base.

**Desde cero o sobre lo que ya tenés**
- **Sin design system:** `/facha-ui:init` lo arma a partir de los colores, tamaños y radios que tu código ya usa, con un valor por tema y contraste verificado. Te propone; vos aprobás.
- **Con design system:** el MCP `facha-ui` lo lee del código (tokens, temas, clases, decisiones) y es la única fuente de valores visuales: la IA no inventa colores ni tamaños.

**Diseñar con criterio**
- **`/facha-ui:variants`:** 3 hipótesis realmente distintas de una pantalla en un laboratorio. Antes de diseñar, te avisa lo que al design system le falta; cada decisión cita su fuente.
- **Ajustar en vivo** (`/facha-ui:variants <slug> live`): un panel en cada variante que es el centro de control: verla en móvil, tablet o escritorio, en cada tema y estado; mejoras con un clic (arreglar en el celular con lo que midió el laboratorio, accesibilidad, textos, estados, revisión senior); pedir cambios mientras mirás, **señalar** con un clic el elemento al que te referís y **probar paletas** para toda la app. Cada conflicto (contraste, estados que se confunden, colores sin token) viene con su solución y una recomendación.
- **Comparar y decidir en equipo:** `/lab/compare/<pantalla>` muestra las variantes lado a lado con los mismos datos, en escritorio, tablet o celular; cada persona vota con un motivo, y hay un reporte HTML para compartir.
- **`/facha-ui:apply`:** porta la variante elegida sobre un plan exacto, con tu aprobación y el motivo (y los votos del equipo a la vista). Captura la pantalla antes y después, marca las diferencias para detectar regresiones y muestra el puntaje de UX antes y después. La decisión queda como memoria para las próximas pantallas.
- **`/facha-ui:flow`:** revisa un recorrido entero (alta → revisión → listo): nombres consistentes, confirmaciones, errores, salida y próximo paso claro, con capturas y sin tocar código.

**Calidad que se mide**
- Un guardián determinista (`check_ui`, `audit_project`) marca valores fuera del design system, contraste insuficiente de texto, bordes, foco e íconos en cada tema (WCAG), estados que se confunden por color (también con daltonismo simulado), paletas infladas, layouts que se rompen en el celular (anchos fijos, grillas que no colapsan, tablas sin scroll), microcopy que no ayuda ("Click aquí", "Ocurrió un error", palabras o tratamientos fuera de la voz del producto) y problemas de accesibilidad: imágenes sin `alt`, campos sin etiqueta, botones sin nombre, acciones que no se alcanzan con el teclado, foco invisible, objetivos chicos y títulos salteados. Es de solo lectura, no usa red y no ejecuta código del proyecto.
- **Crítica de un senior:** `review_ui` mide la jerarquía (acciones primarias que compiten, acentos, tamaños de texto, títulos) y los estados; `variants` la usa junto con las capturas para revisar cada variante como lo haría un diseñador senior, y cada hallazgo trae su arreglo.
- **Método con fuentes:** antes de diseñar, un diagnóstico UX (quién usa la pantalla, su tarea, qué le cuesta hoy). Cada hipótesis, hallazgo y decisión cita un principio con id estable (Nielsen, WCAG 2.2 AA, Gestalt, Fitts, Hick, Jakob, estados, escritura de interfaz) de [`ux-principles.md`](skills/_shared/ux-principles.md), además del token o la clase que lo implementa. Un subagente de solo lectura, `ux-reviewer`, revisa las variantes sin conocer el razonamiento con que se hicieron.
- **Estados completos:** cada variante diseña cargando, vacío, error y datos extremos, y el laboratorio los muestra con `?state=…`.
- **Puntaje de UX por pantalla** (`ux_score`), de 0 a 100 en consistencia, accesibilidad, responsive, microcopy y jerarquía, y un modo para CI que falla si una pantalla empeora:
  ```bash
  node <plugin>/mcp/dist/facha-ui-mcp.js score --root . --baseline .facha-ui/ux-baseline.json
  ```
- **Responsive medido:** cada variante se captura en celular y tablet, y el laboratorio mide la página real (`?check=responsive`): desborde, contenido aplastado, objetivos y textos chicos. En el panel en vivo, *Ver en Móvil / Tablet*.

**Una forma de trabajar con IA en el front**
- Cada pieza tiene un dueño: la IA propone (estructura, hipótesis, soluciones), el código verifica (lo medible) y vos decidís (lo que tiene consecuencias). Como cada decisión explica su fuente y cada problema trae su salida, el plugin enseña ese método mientras lo usás.
- **`/facha-ui:learn`:** un curso práctico de 9 lecciones sobre **tu propio proyecto**, para quien empieza desde cero: qué es un design system y cómo lo ve la IA, por qué inventa valores, el guardián, contraste y accesibilidad, cómo pedir diseño y cómo decidir. Solo lee. `/facha-ui:help` y la [guía de uso](docs/uso.md) completan la referencia.

Principio: **la IA sigue las reglas del proyecto, no las suyas.** Especificación completa en [`SPEC.md`](SPEC.md).

![Flujo de facha-ui](docs/img/flujo.svg)

**Guía paso a paso** (instalación, preparación del proyecto, variantes, apply y problemas frecuentes): [`docs/uso.md`](docs/uso.md). Incluye capturas de una demo de punta a punta.

> **Estado:** 0.14.0. El MVP 0.1.0 salió del AI Day (2026-10-09); la 0.2.0 sumó `/facha-ui:init`, el descubrimiento del frontend en monorepos y mejoras en las capturas; la 0.3.0, reglas de calidad visual medibles (contraste por uso, clases con contraste insuficiente, contraste de elementos no textuales y estados confundibles); la 0.4.0, la paleta de Tailwind y las reglas propias del equipo (`custom`); la 0.5.0, las escalas por defecto de Tailwind y la detección de paleta inflada; la 0.6.0, el ajuste de una variante con historial de revisiones; la 0.7.0, el modo en vivo: un panel en el laboratorio para pedir cambios, señalar elementos y probar paletas de colores en tiempo real; la 0.8.0, `/facha-ui:learn`, un curso guiado sobre el propio proyecto; la 0.9.0, accesibilidad en el guardián, la crítica visual (`review_ui`) y los estados completos; la 0.10.0, responsive: reglas, medición en la página y capturas en celular y tablet; la 0.11.0, microcopy: la voz del producto en la config y reglas sobre los textos; la 0.12.0, flujos, comparar y votar variantes, regresión visual en `apply` y el puntaje de UX con modo CI; la 0.13.0, el panel como centro de control (pestaña Mejorar); la 0.14.0, consolidación: el rol de diseñador UX/UI senior en archivos versionados (principios con id, diagnóstico, revisor independiente) y `variants` dividida en partes que se leen en el paso que las usa. Soporta Next.js App Router y tokens como CSS custom properties, con o sin Tailwind 4. Lo que falta está en SPEC §6 y §7.2.

## Requisitos

- Claude Code con soporte de plugins.
- Node ≥ 20 y Git.
- Para las capturas: Google Chrome (Playwright MCP usa el canal `chrome`) o `npx playwright install chromium`.

## Instalación

Desde GitHub:

```text
/plugin marketplace add SebaFlockitDev/facha-ui
/plugin install facha-ui@facha-ui
```

Desde una copia local del repo (útil para probar cambios propios):

```text
/plugin marketplace add C:\ruta\a\facha-ui
/plugin install facha-ui@facha-ui
```

O solo para una sesión, sin instalar nada:

```bash
claude --plugin-dir /ruta/a/facha-ui
```

Para todo un equipo, commitear en el repo del proyecto `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": { "facha-ui": { "source": { "source": "github", "repo": "SebaFlockitDev/facha-ui" } } },
  "enabledPlugins": { "facha-ui@facha-ui": true }
}
```

El plugin trae dos servidores MCP con versiones fijas (`.mcp.json`):
- `facha-ui`: el bundle `mcp/dist/facha-ui-mcp.js`, que ya viene en el repo, así que no hace falta `npm install`;
- `playwright`: `@playwright/mcp@0.0.83`, lanzado con [`scripts/run-pinned.mjs`](scripts/run-pinned.mjs). Ese script funciona igual en Windows, macOS y Linux, y rechaza versiones que no sean exactas.

## Adopción en un proyecto

1. **Raíz del proyecto.** facha-ui toma como raíz la carpeta donde abrís Claude Code. Si ahí no hay un proyecto React, busca el frontend hasta dos niveles más abajo; si hay uno solo, lo usa. Con varios frontends, abrí Claude Code en el que quieras o definí `FACHA_UI_ROOT` antes de lanzarlo:
   ```powershell
   $env:FACHA_UI_ROOT = "frontend"; claude
   ```
2. **Probar sin configurar nada.** Preguntá *"¿qué design system tiene este proyecto?"*. `get_design_system` autodetecta tokens y temas, y lista los supuestos que hizo.
3. **Config mínima** (`facha-ui.config.json` en la raíz del frontend):
   ```json
   {
     "version": 1,
     "tokens": { "sources": ["app/globals.css"] },
     "preview": { "baseUrl": "http://localhost:3000" }
   }
   ```
   Lo demás es opcional: temas, `include`/`exclude`, `guidelines`, la voz del producto (`copy`: `voice` y `terms`), `lab.dir`, `preview.auth` y `memory.decisionsFile`. Hay un ejemplo completo en SPEC, Anexo A.
4. **`.gitignore`:** agregar el laboratorio (`app/lab/`) y `.facha-ui/` (como mínimo `.facha-ui/live/`, que guarda el token de la sesión en vivo). El plugin en sí no entra en tu repo: vive en `~/.claude/plugins`. facha-ui nunca edita el `.gitignore`.
5. **Diagnóstico:** *"¿cuántas violaciones tiene el proyecto?"* → `audit_project`.

## Demo

Guion sobre una pantalla de listado con estados, por ejemplo `/orders` en una app de pedidos:

1. Levantar la app (`npm run dev`) y, si la pantalla tiene login, iniciar sesión vos en la ventana de Playwright cuando la skill lo pida. facha-ui nunca escribe credenciales.
2. Pedir variantes:
   ```text
   /facha-ui:variants /orders "que se vea primero lo que espera revisión"
   ```
   Antes de generar, la skill avisa las brechas: por ejemplo, que no hay tokens de estado y que el badge "pendiente" usa colores literales. Después escribe las variantes A, B y C en `app/lab/orders/`, las valida con `check_ui` (hasta 3 intentos cada una) y saca capturas en light y dark.
3. Revisar las variantes en `http://localhost:3000/lab/orders/<a|b|c>` (agregá `?theme=dark` para el tema oscuro) y el run en `.facha-ui/runs/orders.json`, con hipótesis, intentos, decisiones con fuente y trade-offs.
4. Ajustar la que te gusta, si hace falta: `/facha-ui:variants orders b "<cambio>"`, o en vivo con `/facha-ui:variants orders live`, que muestra un panel en cada variante para pedir cambios, señalar elementos con un clic y probar paletas de colores para toda la app, con el contraste y los conflictos (y su solución) a la vista.
5. Aplicar la elegida:
   ```text
   /facha-ui:apply orders b
   ```
   Muestra el plan (archivos que cambian y que se borran, y la entrada de `decisions.md`) y pide tu confirmación y el motivo. La próxima vez que corras `variants`, esa decisión aparece en `get_design_system` → `decisions`.

## Qué garantiza

- **Nada se aplica sin vos:** `apply` tiene `disable-model-invocation: true` y además pide confirmación explícita. Un texto en el código o en la página que diga "aprobado" se reporta, no se obedece.
- **Escritura acotada:** `variants` escribe solo en el laboratorio y en `.facha-ui/`. `apply`, después de tu aprobación, escribe en la pantalla elegida y agrega al final de `decisions.md`. `init`, después de tu aprobación, agrega tokens y migra las líneas aprobadas; en modo `palette` cambia solo los valores de la paleta que aprobaste. El panel en vivo no aplica nada: existe solo en desarrollo, acepta pedidos solo del origen del lab y con el token de la sesión. Ninguna toca `package.json` ni lockfiles, y ninguna commitea.
- **El MCP no escribe ni usa red.** Hay tests que lo verifican sobre el código y sobre el bundle.
- **El laboratorio no llega a producción:** su layout responde `notFound()` cuando `NODE_ENV=production`.

## Usarlo desde otros clientes MCP

Solo el MCP. Las skills son de Claude Code. Apuntá el cliente al bundle de una copia del repo:

```json
{
  "mcpServers": {
    "facha-ui": { "command": "node", "args": ["/ruta/a/facha-ui/mcp/dist/facha-ui-mcp.js", "--root", "/ruta/al/frontend"] }
  }
}
```

## Desarrollo

```bash
cd mcp
npm ci
npm test
```

- `npm run typecheck`: TypeScript sin emitir.
- `npm run build`: genera `mcp/dist/facha-ui-mcp.js` con esbuild. **El bundle se commitea**: rehacelo y commitealo junto con cualquier cambio en `mcp/src`.
- `FACHA_UI_BANNED_TERMS="term1,term2" npm test`: activa MCP-7, que verifica que `mcp/src` y `skills/` no mencionen nombres ni valores de los proyectos donde probaste facha-ui. La lista es tuya y no se commitea.
- `claude plugin validate .`: valida los manifiestos del plugin.

## Licencia

[MIT](LICENSE) © 2026 Sebastian Adrover.
