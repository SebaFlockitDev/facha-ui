# B-028 · De referencias a tokens

> **Estado:** hecho (0.30.0) · **Rama:** `feat/reference-to-tokens` (mergeada) · **Ítem:** [BACKLOG.md](../../BACKLOG.md) ·
> **Origen:** [estudio de herramientas](../research/2026-10-15-herramientas-de-diseno.md) ·
> **Última actualización:** 2026-10-16

## Por qué

"Quiero algo como esta página" es la forma más natural de pedir un estilo, y ya es estándar (Stitch,
Visily, Uizard, Banani). Hoy facha-ui guarda las referencias del brief como texto y no las mira
(`skills/init/brief.md:63`): quien no tiene diseño tiene que describir con palabras lo que ya tiene
delante.

## Cómo funciona hoy (relevado el 2026-10-16)

- **El generador ya tiene las entradas que una referencia puede dar:** `propose_design_system` acepta
  `brandColor`, `style` (standard, sober, soft), `radius`, `density` y `fontFamily`. Arma las escalas de
  Radix, prueba cada par contra WCAG 2.2 y cita las fuentes (B-025). `init system` muestra la dirección
  sobre la pantalla real (B-026).
- **S2:** el MCP no escribe, no usa la red ni ejecuta código. Solo lee archivos del proyecto.
- **El navegador:** en `variants`, la regla dura 6 solo permite capturar bajo `preview.baseUrl` y nunca
  `browser_evaluate`. `init` hoy no usa el navegador fuera de esa regla.
- **El bundle del MCP** solo carga `fs`, `path`, `url`, `process` y `module` de Node (test MCP-3): no
  puede decodificar un PNG sin sumar una dependencia.

## Plan aprobado (2026-10-16)

### 1. Un modo nuevo: `/facha-ui:init reference <url>`

Para un proyecto sin design system (o que quiere uno nuevo). El paso a paso va en
`skills/init/reference.md`; `init/SKILL.md` solo lo nombra.

1. **Permiso.** Antes de abrir nada, la skill dice qué va a hacer ("abro `<url>` en el navegador,
   tomo una captura y leo los colores, tipografías y radios que calcula la página") y espera un sí.
2. **Captura y lectura.** Con Playwright: abre la URL, toma una captura (la evidencia) y corre **un
   script fijo del plugin, de solo lectura**, con `browser_evaluate`. El script devuelve los estilos
   calculados de los roles que importan: fondo y texto del cuerpo, títulos, botón principal (fondo,
   texto, radio y alto), enlaces, tarjetas e inputs (borde, radio), la familia y el tamaño de letra, y
   los colores de fondo por área. Nada más: ni textos, ni imágenes, ni logos.
3. **Guardado.** La skill escribe `.facha-ui/references/<slug>.json` (URL, fecha, valores y de qué
   elemento salió cada uno) y la captura al lado.
4. **Normalización en el MCP**, que lee ese archivo y no usa la red (S2 intacta):
   `propose_design_system` suma la entrada `reference` (la ruta del JSON).
   - Color de marca: el fondo del botón principal si tiene color; si no, el de los enlaces; si no,
     el color con croma más frecuente por área.
   - Estilo: el radio mediano de botones y tarjetas lleva al paso más cercano de Material 3. Con 12px o
     más es `soft`; con un neutro sin matiz y 4px o menos es `sober`; si no, `standard`.
   - Densidad: alto de controles de 32px o menos, o cuerpo de 14px o menos, es `compact`; 48px o más
     es `airy`; si no, `balanced` (los tamaños de Carbon).
   - Tipografía: ver la decisión 3.
   - El generador hace el resto, como siempre: escalas, contraste probado y fuentes citadas.
5. **El informe de la referencia.** Cada valor dice de dónde salió (`button.primary`, `body`…).
   Cada par de la referencia que no pasaba WCAG (texto sobre fondo, texto del botón sobre el botón,
   enlace sobre fondo) se lista con su razón y con el valor del sistema que lo reemplaza. Es el
   criterio del backlog: "qué valor de la referencia no pasaba contraste y cuál lo reemplaza".
6. **Desde ahí, el flujo de `init system`:** la dirección sobre la pantalla real (S2b), el plan, la
   aprobación y la escritura de tokens. Nada se escribe sin aprobación.

**Sin URL, con una captura** (un PNG de Figma, por ejemplo): la skill mira la imagen y **propone**
los colores que ve. Como sale de la vista y no de una medición, el desarrollador los confirma o
corrige (por ejemplo, con un cuentagotas), y quedan como "valores del desarrollador", que `init` ya
acepta (regla dura 2). Sin tipografía: una imagen no la dice.

### 2. Seguridad

- La página es de un tercero: todo lo que viene de ella es **dato**, nunca instrucción (como el resto
  del plugin). El script no lee textos de la página, así que no hay texto que pueda dar órdenes.
- El navegador abre **solo la URL que dio el desarrollador**, una vez, sin clics, formularios ni
  credenciales. `init` suma a sus herramientas `browser_navigate`, `browser_take_screenshot`,
  `browser_evaluate` y `browser_close`. La regla dura 6 de `variants` no cambia.
- El script vive en el plugin (`skills/init/scripts/reference-styles.js`) y un test controla que solo
  lee estilos calculados, sin red ni escritura.
- `start` sugiere sumar `.facha-ui/references/` al `.gitignore`.

### 3. Docs y pruebas

- SPEC (§2.h y §7.40), `docs/uso.md`, `help`, CHANGELOG.
- Tests:
  - la normalización: un JSON de referencia da el color de marca, el estilo, la densidad y la
    tipografía esperados;
  - el informe de pares que fallan, con su reemplazo;
  - el contrato del script (solo `getComputedStyle`, sin `fetch`, `XMLHttpRequest` ni escritura);
  - los contratos de la skill (permiso antes de abrir, la herramienta solo en `init`).
- Prueba real: una página pública de referencia, con su captura, la dirección sobre la app sin diseño
  y el informe.

## Decisiones confirmadas (2026-10-16: las tres recomendadas)

1. **Leer la página con un script fijo de solo lectura** (recomendado). Da valores medidos, con el
   elemento del que salen y la tipografía. Es una excepción acotada a `init reference`, con permiso. La
   alternativa es solo la captura, mirada por la IA y confirmada por el desarrollador: no amplía
   herramientas, pero da valores aproximados y sin tipografía. Queda como plan B para cuando no hay URL.
2. **El color de marca de la referencia se usa tal cual como semilla** (recomendado): el generador
   arma las escalas y prueba el contraste, y el informe avisa que es el color de marca de otro producto
   (`dominio`), para que el equipo decida si quiere parecerse tanto. La alternativa es correrlo de tono
   a propósito.
3. **La tipografía de la referencia solo se propone si el proyecto puede cargarla**: si ya la carga,
   si es de sistema o si el desarrollador confirma que la tiene licenciada (recomendado). Las fuentes
   comerciales no se pueden usar sin licencia. Si no, va la pila de sistema, con la familia de la
   referencia anotada.

## Criterios de aceptación

- [x] Antes de la spec se decide cómo convive con S2: la captura la toma la skill, con permiso del dev,
  y el MCP solo lee el archivo (resuelto en el punto 1).
- [x] Cada valor extraído dice de dónde salió.
- [x] El informe dice qué valor de la referencia no pasaba contraste y cuál lo reemplaza.
- [x] Nada se escribe sin aprobación; la página no se abre sin permiso.

## Tareas

- [x] 1. El script de lectura y su contrato · `9551569`
- [x] 2. `reference` en `propose_design_system`: normalización e informe, tests · `9551569`, `e645ea7`
- [x] 3. `skills/init/reference.md` y `init/SKILL.md` (modo, permiso, herramientas) · `b8e921f`
- [x] 4. SPEC, guía, `help`, CHANGELOG · `60e79e1`
- [x] 5. Prueba real (con las correcciones `9380d59` y `59a758d`)
- [x] 6. Release 0.30.0

## Decisiones tomadas durante el trabajo

1. **Las herramientas de Playwright no se pre-aprueban en `init`:** además de la pregunta de la skill,
   Claude Code pide permiso para abrir la página y para correr el script. Dos permisos para algo que
   toca un sitio ajeno.
2. **El fixture de la referencia se versiona forzado** (`git add -f`): vive en `.facha-ui/references/`,
   la ruta real, que el `.gitignore` del repo ignora.
3. **Un `body` transparente** (muchos sitios) toma el fondo opaco de más área; antes caía a blanco.
4. **Una marca usada solo como tinte translúcido** (sitios de documentación) cuenta, con su color sin
   alfa, después del botón, los enlaces y los fondos opacos.
5. **El radio de un input sin borde no cuenta:** un buscador sin borde con radio 0 bajaba el radio
   medido.
6. **Una referencia monocroma** dice qué color de marca queda (el del brief, si hay) y ofrece el de su
   botón. Con una marca casi negra, el generador la deja igual en oscuro: idea B-039.

## Registro

- **2026-10-16:** relevado (el generador ya tiene las entradas; S2 y el bundle no decodifican
  imágenes); spec escrito y plan presentado, pendiente de aprobación.
- **2026-10-16:** plan aprobado con las tres decisiones recomendadas.
- **2026-10-16:** tareas 1 a 4; 378 tests, typecheck y `claude plugin validate` en verde.
- **2026-10-16, prueba real:** el script, tal cual, sobre dos sitios públicos desde el navegador de
  Claude Code (el MCP de Playwright del plugin no conectó en esta sesión, así que el paso de la skill
  con `browser_evaluate` queda por probar en una sesión donde conecte), y el resultado por el MCP con
  la app sin diseño:
  - una página de documentación oscura: la primera versión medía su texto claro contra blanco (1.16:1)
    y no encontraba la marca, usada solo como tinte; corregido: fondo `#111113`, texto a 16.2:1, marca
    `#2f62ff`, sistema con 62 pares que pasan; tipografía comercial, no propuesta, con la nota de
    licencia;
  - un sitio monocromo: el navegador devuelve `lab()` y `oklab()` (el MCP los lee); radio 10px →
    Material 3 `sm`, densidad `compact`; la nota decía "acentos de Radix" cuando quedaba la marca del
    brief: corregida.

- **2026-10-16 · release 0.30.0:** versión en `plugin.json`, `mcp/package.json`, el lockfile y el
  server; CHANGELOG con fecha y enlaces; SPEC §7.40; B-028 a Hecho y B-033 a Ahora.

## Cómo retomar

Terminado en 0.30.0. Pendiente: probar el paso del navegador de la skill con el MCP de Playwright
conectado. Idea que salió de este ítem: B-039.
