# B-025 · Generador de design system, desde una marca o desde cero

> **Estado:** hecho (0.21.0) · **Rama:** `feat/design-generator` (mergeada) · **Ítem:** [BACKLOG.md](../../BACKLOG.md) ·
> **Origen:** [estudio de herramientas](../research/2026-10-15-herramientas-de-diseno.md) ·
> **Depende de:** B-024 (brief, hecho en 0.20.0) · **Última actualización:** 2026-10-15

## Por qué

Un proyecto sin diseño necesita un sistema completo y accesible, no valores sueltos. Hoy `init`
solo ordena los literales que ya están en el código. Las herramientas profesionales derivan el
sistema con un método (Radix Colors, Adobe Leonardo, Material Color Utilities), no a ojo. facha-ui
puede hacerlo **determinístico y con fuente en cada valor**, que es justo lo que ninguna herramienta
de IA ofrece (ver el estudio).

## Plan aprobado (2026-10-15)

### 1. Tool `propose_design_system` (MCP, solo lectura, sin red)

**Entrada** (todo opcional; lo que falta sale del brief, y si no, de un valor por defecto con
fuente): color de marca, densidad, modo oscuro, nivel de accesibilidad (AA o AAA), radio base y
cantidad de semillas cuando no hay marca. La salida dice de dónde salió cada entrada (argumento,
línea del brief o valor por defecto).

**Salida:**
- escalas de 12 pasos para acento, neutro, éxito, advertencia, peligro e información, en claro y
  oscuro, en OKLCH y hex;
- roles → tokens: superficies, textos, bordes (incluido el de controles y el anillo de foco),
  acento, texto sobre acento y estados (texto, fondo, borde, sólido); con los nombres de shadcn si
  el proyecto usa shadcn, o con nombres que facha-ui reconoce por rol;
- tipografía (familia, tamaño base, escala de 7 pasos, interlineados, pesos), espaciado (base 4px y
  altura de controles), radios y 3 sombras;
- **prueba de contraste**: cada par texto/fondo y cada borde de control, en los dos modos, con su
  razón y si pasa;
- ajustes (si el color de marca tuvo que moverse, cuánto y por qué) y conflictos con su solución;
- los bloques CSS listos por tema, y la lista de fuentes de cada regla.

### 2. Método de color

1. **Marca → OKLCH.** El paso 9 (sólido) es el color de marca, si cumple: texto sobre él ≥ 4.5:1
   (WCAG 1.4.3) y él contra el fondo ≥ 3:1 (WCAG 1.4.11). Si no, se busca la luminosidad más
   cercana que cumpla y se informa el ajuste.
2. **Cada otro paso** tiene la luminosidad que alcanza un **contraste objetivo contra el fondo**
   (como Leonardo) y un croma proporcional al de la marca, recortado al gamut sRGB. Los contrastes
   objetivo y las proporciones de croma por paso se **miden de las escalas publicadas de Radix
   Colors** (licencia MIT), en claro y en oscuro, y quedan en un archivo de constantes con su fuente
   y un test que las vuelve a medir.
3. **Neutros teñidos** con el tono de la marca y el croma bajo de los grises de Radix.
4. **Estados** con los tonos de Radix (verde, ámbar, rojo, azul). Si la marca se confunde con un
   estado (la medida `status-confusable` que ya usa facha-ui), se informa con su solución
   (etiqueta de texto e ícono, `ux:wcag-1.4.1`).
5. **Oscuro generado aparte**, con los objetivos medidos de las escalas oscuras de Radix; no se
   invierte el claro.
6. **Sin color de marca:** de 3 a 5 semillas tomadas de los acentos de Radix que no se confunden
   con los estados, separadas en tono. Cada semilla es un sistema completo (B-026 las mostrará sobre
   la pantalla real).
7. **Umbrales:** con AA, texto ≥ 4.5:1 y no texto ≥ 3:1; con AAA, texto ≥ 7:1 (WCAG 1.4.6).

### 3. Tipografía, espacio, radio y sombra (cada valor con fuente, a verificar en la tarea 1)

| Qué | Regla | Fuente |
|---|---|---|
| Tamaño base | compacta 14px; equilibrada y aireada 16px | Carbon *productive* / *expressive*; Material 3 body |
| Escala | razón 1.125 / 1.2 / 1.25 según la densidad, 7 pasos, nunca < 12px | Utopia, escala modular; regla de texto chico de facha-ui |
| Interlineado | texto 1.5; títulos 1.25 | WCAG 1.4.8; Material 3 |
| Familia | la del brief; si no hay, la pila del sistema (facha-ui no instala dependencias) | regla de `init` |
| Espaciado | base 4px | Material (grilla de 4dp), Carbon (2/4/8) |
| Altura de controles | 32 / 40 / 48px según la densidad, objetivos ≥ 24px | Carbon (sm/md/lg), WCAG 2.5.8 |
| Radios | base 8px; escala base/2, base, 1.5×, 2×, completo | Material 3 (forma *small*) |
| Sombras | 3 niveles tomados de Fluent 2, con el tono del neutro | Fluent 2 (*shadow ramps*) |

### 4. Modo `/facha-ui:init system`

`skills/init/system.md` (nuevo): con brief y sin tokens, llama a la tool, muestra el sistema
(escalas, roles, prueba de contraste, tipografía, espacio, radios, sombras, ajustes, conflictos) y
**exactamente** qué escribe; con la aprobación y el motivo:
- agrega los bloques al archivo de tokens o, si no hay, al CSS global que carga la app;
- en Tailwind 4 agrega el mapeo `@theme inline` (convención de shadcn); en Tailwind 3 muestra el
  mapeo para que lo agregue el dev (`init` no edita `tailwind.config`);
- modo oscuro "sí" → bloque `.dark`; "más adelante" o "no" → solo claro, y el oscuro queda en
  `.facha-ui/proposals/system-<fecha>.json`;
- valida con `get_design_system` (`status: ok`) y registra `dec-<fecha>-system`.

Solo para proyectos sin tokens (`status: missing`); con tokens, el camino sigue siendo
`/facha-ui:init colors` o `palette`. Los literales de las pantallas no se migran (cambiaría el
diseño): el siguiente paso es `/facha-ui:variants`.

`SKILL.md` de `init` (en 250 líneas: hay que compactar), `start` y `brief.md` (con brief y sin
tokens, el siguiente paso pasa a ser `/facha-ui:init system`), `help`, contratos en
`plugin.test.ts`.

### 5. Decisiones confirmadas (2026-10-15: las cuatro, como se recomendaron)

1. **Incluir la escritura (`/facha-ui:init system`) en este ítem.** Recomendado: sin ella el
   generador no se puede usar hasta B-026. B-026 suma ver las direcciones en la pantalla real antes
   de escribir.
2. **APCA pasa a B-032.** No encontré una biblioteca con licencia clara, y WCAG 2.2 decide igual.
3. **Selector oscuro `.dark`** cuando no existe ninguno: el laboratorio lo puede forzar y es la
   convención de Tailwind y shadcn; con `@media` no se puede forzar (`lab.md`).
4. **Semillas sin marca desde los acentos de Radix**, no desde la personalidad: no hay una fuente
   que asigne adjetivos a tonos. La personalidad sí guía la elección del dev en B-026.

**Fuera de alcance:** las direcciones en la pantalla real (B-026), los perfiles por tipo de producto
más allá de la densidad (B-027), los controles del panel (B-031) y la migración de literales.

## Criterios de aceptación

- [x] Todo par texto/fondo pasa WCAG 2.2 AA en los dos modos (AAA si el brief lo pide), con test
  sobre varias marcas (fría, cálida, clara, oscura, saturada, apagada) y sin marca.
- [x] La misma entrada da la misma salida.
- [x] Sin red ni ejecución de código (S2), con test de imports.
- [x] Cada valor dice de qué regla y fuente sale; un test controla que ninguna constante quede sin
  fuente.
- [x] Los tokens generados, leídos por facha-ui, dan los roles esperados y `status: ok` (ida y
  vuelta).
- [x] La marca se conserva o el ajuste se informa; un conflicto con un estado se informa con su
  solución.
- [x] `/facha-ui:init system` escribe solo con aprobación, y solo los bloques mostrados.

## Fuentes verificadas (tarea 1, 2026-10-15)

Leídas de los paquetes publicados en unpkg; las constantes están en `mcp/src/standards.ts`, cada una con
su fuente, y las medidas de Radix se vuelven a medir en `mcp/test/standards.test.ts`.

| Fuente | Qué se tomó |
|---|---|
| Radix Colors 3.0.0 (MIT), 25 acentos y 6 grises, claro y oscuro (`test/fixtures/radix-colors-3.0.0.json`) | Contraste mediano de cada paso contra el paso 1; croma de cada paso respecto del 9; luminosidad y croma de los grises teñidos; el paso 9 es igual en claro y oscuro; texto blanco salvo en las 5 escalas brillantes (paso 9 con L ≥ 0.854; las otras ≤ 0.691) |
| `@carbon/type` 11.69 (Apache-2.0) | Escala productiva 12, 14, 16, 20, 28, 32, 42 (densidad compacta) |
| `@carbon/layout` 11.61 (Apache-2.0) | Espaciado 2, 4, 8, 12, 16, 24, 32, 40, 48, 64; controles sm 32, md 40, lg 48 |
| `@material/web` 2.5.0 (Apache-2.0) | Escala 12, 14, 16, 22, 28, 36, 45 (equilibrada y aireada); radios 0, 4, 8, 12, 16, 28, completo; títulos 32/40 = 1.25 |
| `@fluentui/tokens` 1.0.0-alpha.22 (MIT) | `createShadowTokens`: sombras 2, 8 y 16, ambiente 0.12 y clave 0.14 en claro, 0.24 y 0.28 en oscuro |
| WCAG 2.2 | 1.4.3 (4.5:1), 1.4.6 (7:1), 1.4.11 (3:1), 1.4.1, 1.4.8 (interlineado 1.5), 2.5.8 (24px) |

## Tareas

- [x] 1. Verificar las fuentes; fixture con las escalas de Radix y test que mide las constantes
- [x] 2. `mcp/src/standards.ts` (constantes con fuente) y `mcp/src/generate.ts` (escalas, roles,
  tipografía, espacio, radios, sombras, CSS), con tests · `7f1b4c8`
- [x] 3. Tool `propose_design_system` (`server.ts`, descripción también en SPEC §2.a.3), tests por el
  MCP y de imports, bundle · `8f62453`
- [x] 4. `skills/init/system.md`, `init`, `start`, `brief.md`, `help` y contratos · `3ae47b7`
- [x] 5. Docs: SPEC §2.h y §7.31, `docs/uso.md`, `CHANGELOG.md` · `354673c`
- [x] 6. Prueba real en `facha-ui-pruebas/vite-sin-diseno` (brief de B-024): generar, escribir,
  `status: ok`, contraste y `check_ui`; más una revisión visual · `715f093`, `53fcd39`, `ff88bbc`
- [x] 7. Release 0.21.0

## Decisiones tomadas durante el trabajo

- **Escalas tipográficas publicadas tal cual**, no una razón modular: compacta = escala productiva de
  Carbon; equilibrada y aireada = escala de Material 3. Así cada tamaño tiene fuente directa.
- **Nombres con los espacios de Tailwind 4** (`--color-*`, `--text-*`, `--radius-*`, `--shadow-*`,
  `--font-sans`), que facha-ui lee por rol: el mismo sistema va en `:root` (CSS) o en `@theme`
  (Tailwind 4) sin mapeo. Un test escribe el CSS en un proyecto y comprueba roles y `status: ok`.
- **Sin nombres de shadcn:** un proyecto shadcn sin tokens casi no existe (`shadcn init` los
  escribe); esos proyectos siguen con `palette` y `colors`.
- **Borde de controles y anillo de foco como roles propios** resueltos a 3:1 (WCAG 1.4.11): el paso
  8 de Radix, que se usa para eso, mide 2.3:1 en claro.
- **Marca contra el fondo:** con menos de 3:1 no se ajusta, se informa: un botón con texto no
  necesita borde (WCAG 1.4.11); un control solo con ícono, sí.
- **Texto sobre el sólido como en Radix:** blanco, salvo en colores brillantes (luminosidad > 0.773,
  el punto medio medido). Si no llega al mínimo, el sólido se mueve lo menos posible en
  luminosidad; así el peligro queda rojo con texto blanco (`#d83b43`).
- **Info sigue a la marca** cuando se confunden (todo azul o violeta queda bajo ΔE 10 con
  deuteranopía): es el estado menos crítico y siempre lleva texto. Las semillas sin marca se
  filtran solo contra éxito, advertencia y peligro: quedan índigo, ciruela y cyan.
- **Estados separados en luminosidad** cuando se confunden con daltonismo (el rojo y el verde de
  Radix: ΔE 3.9 con deuteranopía). Peligro no se mueve; los demás buscan hacia arriba y hacia
  abajo el menor cambio que los separa con texto legible. El primer intento (solo oscurecer)
  dejaba el éxito casi negro (`#003916`): descartado tras revisarlo a ojo.
- **Conflicto de marca contra la familia del estado:** la marca tal como la dio el dev y la
  ajustada, contra el estado ajustado y su semilla de Radix (una marca verde se lee como éxito).
- **El paso 11 (texto de acento) nunca es más claro que la marca** en claro (ni más oscuro en
  oscuro): en Radix siempre contrasta al menos como el 9.
- **Hover a la distancia de Radix:** el paso 10 se aleja del 9 al menos ΔE 2.961 en claro y 4.074
  en oscuro (mediana medida); con el método por contraste quedaba bajo ΔE 2 y no se notaba
  (`ux:nielsen-1`).
- **Info como alias** de la marca cuando la sigue (`--color-info: var(--color-primary)`), y los
  alias se declaran también en `.dark`: un `var()` en `:root` se resuelve ahí, con el valor claro,
  y `.dark` hereda ese valor (lo encontró la revisión visual: el chip de info salía claro en oscuro).
- **El bloque `.dark` repite todos los colores**, aunque no cambien, para que facha-ui no los marque
  como `theme-missing`.
- **Casi duplicados entre roles distintos** (fondo y panel, blanco del texto sobre acento y fondo)
  son esperables en un sistema generado: la skill los explica en S5 y la mejora de la regla quedó
  como B-037 en Ideas.

## Registro

- **2026-10-15:** spec escrito; plan presentado, pendiente de aprobación. Al revisar el panel en vivo
  apareció que sus paletas predefinidas traen afirmaciones sin fuente ("El más usado en bancos y
  fintech", `lab-panel.tsx:196`): anotado como B-036 en Ideas.
- **2026-10-15:** plan aprobado con las cuatro decisiones. Tarea 1: fuentes verificadas en los
  paquetes publicados. Tarea 2: generador y constantes (`7f1b4c8`), 265 tests en verde. La ida y
  vuelta por facha-ui encontró que el rojo y el verde de Radix se confunden con deuteranopía; la
  revisión a ojo encontró peligro con texto oscuro, éxito casi negro y texto de acento más claro
  que la marca. Corregido (ver decisiones).
- **2026-10-15:** tareas 3 a 5 (tool, skill, docs). Tarea 6, prueba real en
  `facha-ui-pruebas/vite-sin-diseno` con el brief de B-024, por el bundle y stdio:
  - entradas tomadas del brief, cada una con su línea; 62/62 pares pasan; ajustes: éxito
    `#30a46c → #38aa72` (separado del rojo con daltonismo) y peligro `#e5484d → #d83b43` (texto
    blanco legible); info sigue a la marca;
  - escrito el tema por defecto (el brief dice oscuro "más adelante"): `status: ok`; `check_ui` sin
    errores en el bloque escrito y los mismos 19 de antes en los colores de la pantalla;
  - la salud mostró `theme-missing` (con el oscuro escrito), un hover casi invisible y casi
    duplicados entre roles: los dos primeros corregidos (`715f093`), el tercero explicado en S5 y
    anotado como B-037;
  - **revisión visual** de una página de muestra (botones, hover, campos con foco, estados, tabla
    y panel, en claro y oscuro): encontró el chip de info claro en el modo oscuro (alias resuelto
    en `:root`), corregido con su test (`53fcd39`). 284 tests en verde.
- **2026-10-15 · release 0.21.0:** versión en `plugin.json`, `mcp/package.json`, el lockfile y el
  server; CHANGELOG con fecha y enlaces; SPEC §7.31 con la versión; B-025 a Hecho.

## Cómo retomar

Terminado en 0.21.0. Sigue B-026 (tres direcciones sobre la pantalla real), que usa las
`directions` de `propose_design_system` y una página de muestra en el laboratorio.
