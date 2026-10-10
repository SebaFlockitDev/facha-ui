---
name: help
description: Lists the facha-ui commands, MCP tools and files, with examples. Only shows text; it never reads or changes the project.
argument-hint: "[variants|flow|apply|init|learn|tools|files]"
disable-model-invocation: true
---

# facha-ui · help

Show the reference below to the developer. Rules:

- **Do not call any tool** and do not read or write files: this command only shows text.
- If `$ARGUMENTS` is `variants`, `flow`, `apply`, `init`, `learn`, `tools` or `files`, show only that section,
  plus the last line ("Guía completa…").
  With no argument (or an unknown one), show everything.
- Show it in the developer's language. The text below is in Spanish; translate it if
  they write in another language. Keep commands, paths and tool names exactly as written.
- Do not add anything about the current project: no counts, no file names of theirs.

---

## facha-ui · comandos

Generás con IA variantes de una pantalla o de un componente, y facha-ui las ajusta hasta que respetan los tokens y las reglas de tu design system. Si el design system falta o está incompleto, te ayuda a armarlo.

| Comando | Para qué |
|---|---|
| `/facha-ui:variants <pantalla> "<objetivo>"` | Genera 3 variantes de una pantalla en el laboratorio, validadas con el guardián |
| `/facha-ui:variants <slug> <a\|b\|c> "<cambio>"` | Ajusta una variante que te gustó (por ejemplo, agregar o mover algo), con historial de revisiones |
| `/facha-ui:variants <slug> live [stop]` | Modo en vivo: pedís los cambios desde un panel en el navegador y los ves al instante |
| `/facha-ui:flow "<objetivo>" <pantalla> <pantalla>…` | Revisa un recorrido entre pantallas (nombres, confirmaciones, errores, salida, próximo paso) con capturas; no cambia código y te propone qué paso rediseñar |
| `/facha-ui:apply <slug> <a\|b\|c>` | Aplica la variante que elegiste (solo vos lo podés lanzar; pide aprobación y motivo) |
| `/facha-ui:init [colors\|scales\|all]` | Propone los tokens que faltan a partir de los valores que el proyecto ya usa, y los crea solo si aprobás (solo vos lo podés lanzar) |
| `/facha-ui:init palette <archivo>` | Adopta en toda la app una paleta que probaste en el panel en vivo, con contraste y conflictos verificados (solo vos lo podés lanzar) |
| `/facha-ui:learn [1-9\|<tema>]` | Curso práctico sobre tu propio proyecto: design system, IA y UI con criterio, en 9 lecciones. Solo lee |
| `/facha-ui:help [variants\|flow\|apply\|init\|learn\|tools\|files]` | Esta ayuda |

**Flujo en 4 pasos**

1. Levantá la app (`npm run dev`).
2. `/facha-ui:variants /orders "que se vean primero los pedidos pendientes de revisión"`
3. Mirá las variantes en `http://localhost:3000/lab/orders/<a|b|c>` (y con `?theme=dark`).
4. `/facha-ui:apply orders b` → revisá el plan, aprobalo con el motivo y commiteá vos.

Entre el 3 y el 4, si querés ajustar la que te gustó mientras la mirás: `/facha-ui:variants orders live`.

### variants

```text
/facha-ui:variants <pantalla> "<objetivo>"
```

- `<pantalla>`: una ruta (`/orders`), un archivo (`app/orders/page.tsx`) o un componente
  (`components/OrderCard.tsx`).
- `<objetivo>`: texto libre, por ejemplo "que se vea primero lo que espera revisión".
- Antes de generar te avisa las **brechas**: lo que el objetivo necesita y el design system
  no tiene, como un token de estado.
- Hace 3 hipótesis distintas:
  - **A, conservadora:** misma estructura, con el objetivo resuelto;
  - **B, jerarquía:** reorganiza la información;
  - **C, patrón alternativo:** otro patrón con piezas existentes.
- Cada variante diseña sus estados (cargando, vacío, error, datos extremos): los ves con `?state=…` en la URL del laboratorio.
- Cada variante pasa por `check_ui` hasta tener 0 errores, con un máximo de 3 intentos. Incluye accesibilidad: `alt`, etiquetas, nombres de botones, teclado, foco visible, objetivos de 24 px y orden de títulos.
- Microcopy: los textos siguen la voz del producto (`copy.voice` y `copy.terms` en la config); el guardián marca etiquetas vagas ("Click aquí", "OK"), errores que no dicen qué pasó ni qué hacer, textos en mayúsculas y palabras o tratamientos fuera de la voz.
- Responsive: el guardián marca anchos fijos, grillas que no colapsan, tablas sin scroll y `100vh`; además captura cada variante en celular (375) y tablet (768) y mide la página real con `?check=responsive` (desborde, contenido aplastado, objetivos y textos chicos).
- Después, una crítica senior con `review_ui` y las capturas: arregla lo que puede y te deja lo demás con su recomendación.
- Saca capturas en light y dark con Playwright, o te lista las URLs.
- Escribe solo en el laboratorio (`app/lab/<slug>/`) y en `.facha-ui/`. No aplica nada.
- **Ajustar una variante:** `/facha-ui:variants orders b "agregá un contador al lado del título"`, o pedíselo en la misma conversación. Cambia esa variante y nada más, avisa brechas antes de tocar, vuelve a pasar el guardián, saca capturas nuevas y guarda cada ajuste como revisión (r1, r2…) con tu pedido. Si preferís conservar la original, pedí el ajuste "como variante nueva" (b2).
- **Comparar y votar:** `http://localhost:3000/lab/compare/<slug>` muestra las variantes lado a lado (escritorio, tablet o móvil, cualquier tema y estado); con el modo en vivo, cada persona vota con un motivo. Pedile a Claude el reporte HTML para compartir.
- **Modo en vivo:** `/facha-ui:variants orders live`. El panel abre en **Mejorar**: ver la variante en escritorio, móvil o tablet, cambiar tema y estado, mejoras con un clic (arreglar en el celular, accesibilidad, textos, estados, revisión senior completa), comparar y elegir. En la vista Móvil, **Pedir que lo arregle** manda el pedido con lo que midió el laboratorio. En cada variante aparece un panel **facha-ui** abajo a la derecha: escribís el cambio, Claude lo aplica como revisión y la página se recarga sola. "Elegir esta variante" no aplica nada: te pide confirmar con `/facha-ui:apply` en Claude Code. Dura 2 horas o hasta `/facha-ui:variants orders live stop`. Necesita la sesión de Claude Code abierta y la app corriendo.
  - **⌖ Señalar:** hacés clic en hasta 3 elementos y los nombrás [1], [2], [3] en el pedido; Claude sabe qué componente los dibuja.
  - **Paleta:** probás con un clic paletas predefinidas o tu color sobre toda la app, solo en tu navegador, con el contraste y los conflictos (y su solución) a la vista. *Proponer* la guarda para `/facha-ui:init palette`.
  - **Ver en Móvil 375 / Tablet 768:** abre la variante a ese ancho, con el medidor de responsive encendido.
  - El panel se arrastra, se ajusta de tamaño, se minimiza (–) o se oculta (×; Alt+Shift+F lo trae).

### flow

```text
/facha-ui:flow "<objetivo del recorrido>" <pantalla> <pantalla> [<pantalla>…]
```

- Revisa el recorrido completo, en orden: que la misma acción se llame igual en cada paso, que lo destructivo pida confirmación, que haya una salida, que después de cada acción se vea qué pasó, que los errores se puedan resolver y que siempre esté claro el próximo paso.
- Captura cada paso en escritorio y celular, mide cada pantalla (guardián, `review_ui`, puntaje) y hace una crítica de 8 puntos (FL1–FL8), cada hallazgo con su arreglo.
- No cambia código: deja un reporte en `.facha-ui/flows/` y te propone el comando de `variants` para el paso que más lo necesita.
- Si no sabés qué pantallas son, describí el flujo ("revisá el alta de pedidos"): las busca y te las confirma.

### apply

```text
/facha-ui:apply <slug> <a|b|c>
```

- Solo lo podés lanzar vos: Claude no puede invocarlo por su cuenta.
- Antes de escribir, verifica que la variante sea `valid`, vuelve a correr el guardián y
  revisa con git si la pantalla cambió desde el run.
- Te muestra un plan exacto:
  - archivos que cambian y que se borran;
  - la entrada que se agrega a `decisions.md`.
- Aplica solo si respondés nombrando la variante y el motivo, por ejemplo "Sí, aplicá la B:
  deja lo urgente arriba". Una respuesta ambigua se repregunta.
- Si la app corre, captura la pantalla antes y después y marca las diferencias (posibles regresiones), y muestra el puntaje de UX antes y después. Si el equipo votó, te muestra los votos.
- Valida que no haya errores nuevos, limpia el laboratorio y registra la decisión.
  No commitea.

### init

```text
/facha-ui:init [colors|scales|all]
/facha-ui:init palette <archivo>
```

- Para cuando el design system no existe o le faltan roles, como los colores de estado.
- Solo lo podés lanzar vos. Primero propone, sin escribir nada:
  - tokens con su valor por tema y su contraste, sacados de los colores que el proyecto ya usa;
  - escalas de tamaños y radios;
  - un plan para reemplazar los literales.
- Los valores son los que ya están en uso. Para los otros temas, reusa lo que el proyecto ya
  declara o los deriva con contraste verificado, y te dice cómo.
- Creás todo o una parte, y elegís si migrar los literales. Aprobás con un motivo.
- Agrega los tokens, valida el antes y el después con `audit_project` y registra la decisión.
  Nunca cambia ni borra tokens existentes (salvo los valores que aprobás en modo `palette`). No commitea.
- **Paleta:** `/facha-ui:init palette <archivo>` adopta una paleta propuesta desde el panel en vivo. Muestra cada token antes y después, el contraste y los conflictos con su solución; cambia solo esos valores después de tu aprobación y registra la decisión.

### learn

```text
/facha-ui:learn [1-9|<tema>]
```

- Un curso guiado, una lección por vez, con ejemplos reales de tu proyecto: qué es el design system y cómo lo ve la IA, por qué inventa valores y cómo se evita, el guardián, contraste y accesibilidad, cómo armar el design system si falta, cómo pedir diseño (objetivos, no valores), ajustar en vivo, aplicar con motivo y un método de trabajo.
- Cada lección: la idea, la demostración en tu proyecto, qué mirar, cómo se resuelve y un ejercicio con devolución.
- Solo lee: nunca escribe archivos ni corre `variants`, `apply` o `init` por vos; te muestra el comando.
- Sin argumento muestra el mapa del curso y te recomienda por dónde empezar.

### tools

Las tools del MCP `facha-ui` son de solo lectura. No hace falta nombrarlas: alcanza con pedírselo a Claude.

| Tool | Pedido de ejemplo | Devuelve |
|---|---|---|
| `get_design_system` | "¿Qué design system tiene este proyecto?" · "¿Qué color uso para X?" | Tokens por tema, clases, roles que faltan, literales sin token, contraste por tema, guidelines y decisiones |
| `check_ui` | "Revisá `app/orders/page.tsx`" · "Corré check_ui sobre lo que cambiaste" | Violaciones con archivo:línea, severidad y token sugerido, incluido el contraste de textos, bordes, foco e íconos en cada tema, los colores y escalas por defecto de Tailwind y las reglas propias del equipo (`custom`) |
| `audit_project` | "¿Cuántas violaciones tiene el proyecto?" | Totales por severidad, regla y archivo |
| `scan_styles` | "¿Qué tokens le faltan a este proyecto?" | Propuesta de tokens desde los valores en uso, con valor por tema, contraste y plan de migración |
| `review_ui` | "¿Qué mejorarías de esta pantalla?" · "Revisala como un senior" | Acciones primarias que compiten, acentos, tamaños de texto, títulos y estados que faltan, con por qué importa y cómo arreglarlo. No bloquea |
| `ux_score` | "¿Qué puntaje de UX tiene cada pantalla?" | De 0 a 100 por pantalla en consistencia, accesibilidad, responsive, microcopy y jerarquía, con los hallazgos que más cuestan. También para CI: `facha-ui-mcp.js score --baseline …` |
| `review_flow` | "Revisá el flujo de alta" | Nombres distintos para la misma acción, borrados sin confirmación, formularios sin salida, feedback o error, pasos sin acción principal |

### files

| Archivo | Qué es |
|---|---|
| `facha-ui.config.json` | Config del proyecto (opcional: sin ella, autodetecta) |
| `app/lab/<slug>/<a\|b\|c>/` | Variantes. Existen solo en desarrollo; `apply` las borra |
| `.facha-ui/runs/<slug>.json` | Estado del run: hipótesis, intentos, decisiones con fuente, brechas |
| `.facha-ui/screenshots/` | Capturas por variante y tema |
| `.facha-ui/live/` | Modo en vivo: sesión (con su token), pedidos y estados. No lo versiones |
| `.facha-ui/proposals/` | Paletas propuestas desde el panel en vivo |
| `.facha-ui/reports/` | Reportes para compartir las variantes con el equipo |
| `.facha-ui/flows/` | Revisiones de flujos |
| `design-system/decisions.md` | Memoria de decisiones aprobadas; la próxima corrida las cita |

Guía completa: https://github.com/SebaFlockitDev/facha-ui/blob/main/docs/uso.md
