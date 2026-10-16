# B-026 · Tres direcciones de diseño sobre la pantalla real

> **Estado:** hecho (0.22.0) · **Rama:** `feat/design-directions` (mergeada) · **Ítem:** [BACKLOG.md](../../BACKLOG.md) ·
> **Origen:** [estudio de herramientas](../research/2026-10-15-herramientas-de-diseno.md) ·
> **Depende de:** B-025 (generador, hecho en 0.21.0) · **Última actualización:** 2026-10-15

## Por qué

Elegir una paleta en abstracto es elegir a ciegas. Google Stitch muestra varias direcciones, pero
sobre maquetas; facha-ui puede mostrarlas **sobre la pantalla real, con los datos reales**, y además
con cada valor justificado. Hoy `/facha-ui:init system` muestra tablas de colores y escribe: el dev
no ve cómo queda su producto antes de decidir.

## Plan aprobado (2026-10-15)

### 1. Direcciones que se diferencian de verdad (MCP)

Hoy las direcciones del generador solo cambian la semilla, y con color de marca hay una sola. Cada
dirección pasa a ser **semilla (o marca) + estilo**, y el estilo fija parámetros publicados:

| Estilo | Radio | Neutro | Superficies | Fuentes |
|---|---|---|---|---|
| `sober` (Sobrio) | 4px | gris puro | capas: borde, sin sombra | Material 3 *extra-small*; Radix *gray*; modelo de capas de Carbon |
| `standard` (Estándar) | 8px | gris teñido con el tono | sombra sutil | Material 3 *small*; Radix grises teñidos; Fluent `shadow2` |
| `soft` (Suave) | 16px | gris teñido con el tono | sombra media | Material 3 *large*; Radix grises teñidos; Fluent `shadow8` |

- **Sin marca:** 3 direcciones, cada semilla con un estilo (índigo · estándar, ciruela · sobrio,
  cyan · suave). **Con marca:** la marca con los 3 estilos.
- Cada par de direcciones difiere en al menos dos de: tono, tinte del neutro, radio y elevación.
- `propose_design_system` suma `style`. Con `brandColor` y `style` devuelve una sola dirección:
  así se **mezcla** (la semilla de una con el estilo de otra).
- Tokens nuevos del estilo: `--radius` (el radio por defecto) y `--shadow-card` (la elevación de las
  tarjetas, `none` en sobrio).

### 2. El laboratorio muestra las direcciones (templates)

Todo dentro de `<lab.dir>/system/`, la carpeta propia de `init system` (nunca un run de variantes):

- **`directions.css`**: cada dirección en `html[data-facha-direction="<id>"]` y su oscuro en
  `html.dark[data-facha-direction="<id>"]`. Como el proyecto no tiene tokens, no pisa nada.
- **`lab-theme.tsx`** lee también `?direction=<id>` y lo pone en `<html>`.
- **Página de muestra** (`lab-specimen.tsx` + `lab-specimen.module.css`, compartida por Next y
  Vite), hecha solo con los tokens: tipografía, botones (normal, hover, foco, deshabilitado), campos
  (normal, foco, error, deshabilitado), estados, tabla, panel, estado vacío y de error, radios y
  sombras.
- **Copia de la pantalla real** de la tarea principal del brief, en `system/<slug>/`: la misma
  estructura y los mismos datos (con los providers del laboratorio), con cada color, tamaño y radio
  escrito a mano reemplazado por el token de su rol. No es un rediseño: es la pantalla de hoy
  vestida con cada dirección.
- **Rutas:** Next `/lab/system/specimen?direction=<id>` y `/lab/system/<slug>?direction=<id>` (un
  `layout.tsx` en `system/` importa `directions.css`); Vite `?system=specimen&direction=<id>` y
  `?system=<slug>&direction=<id>` (el CSS entra con un `import.meta.glob` que no falla si falta).
- **Comparar:** la página de comparación suma el modo `system`: columnas = direcciones de la URL
  (`?d=<id>,<id>,<id>&page=<slug|specimen>`), con tema, ancho y scroll sincronizado como hoy.
- `system` queda como nombre reservado: el índice del laboratorio lo saltea, el panel no lo toma por
  una variante y `variants` no lo usa como slug.

### 3. El flujo de `/facha-ui:init system` (`system.md`)

1. Genera las 3 direcciones.
2. **Antes de mostrar tablas, las muestra:** arma el laboratorio si no existe (`lab.md`, andamiaje),
   escribe `system/` y captura con Playwright (regla dura 6 de `variants`): la muestra y la pantalla
   en cada dirección, en escritorio, en claro, y en oscuro si el brief lo pide.
   `<screenshotsDir>/system/<id>-<page>-desktop-<theme>.png`.
3. Presenta la página de comparar, las capturas y, por dirección, su estilo con fuentes, la prueba de
   contraste, los ajustes y conflictos. El dev elige una, o mezcla (otra llamada a la tool).
4. Sigue como hoy con la elegida: plan exacto, aprobación con motivo, escritura de los tokens.
5. Con los tokens ya escritos, `check_ui` sobre la muestra y la copia de la pantalla da 0 errores;
   después borra `<lab.dir>/system/` (y el andamiaje si nada más lo usa, con la misma regla que
   `apply`). Las capturas quedan y se citan en la decisión.

Sin laboratorio posible (`framework: unknown`), el flujo sigue como en 0.21.0: tablas, sin capturas.

### 4. Otros archivos

- `skills/variants/lab.md`: sección "Vista de direcciones" (rutas, `system/`, capturas).
- `skills/apply/SKILL.md`: `system/` no es un run ni cuenta como pantalla para borrar el andamiaje.
- `skills/variants/SKILL.md`: `system` es un slug reservado (sin pasar de 250 líneas).
- Tests: estilos (radio, neutro, sombra, diferencias entre direcciones, mezcla), la muestra pasa
  `check_ui` con 0 errores contra un sistema generado (en Next y en Vite), contratos de los
  templates (dirección en `lab-theme`, rutas, modo `system` de comparar, índice y panel que saltean
  `system`), el test de imports del andamiaje con los archivos nuevos, contratos de las skills.
- Docs: SPEC §2.h y §7.32, `docs/uso.md`, `CHANGELOG.md`.

### 5. Decisiones confirmadas (2026-10-15: las cuatro recomendadas, "lo que sea mejor")

1. **Direcciones = semilla + estilo**, con los tres estilos de la tabla. Recomendado: con marca
   también hay tres direcciones de verdad, y cada parámetro tiene fuente.
2. **El criterio de aceptación cambia "densidad" por "elevación"**: la densidad sale del brief (es
   una decisión de producto, no de estilo) y no debería variar entre direcciones.
3. **La copia de la pantalla es conservadora** (misma estructura, solo tokens). Recomendado: así se
   comparan los sistemas y no los rediseños; rediseñar es lo que sigue, con `variants`.
4. **Se borra `system/` al terminar** y quedan las capturas. Alternativa: dejar la muestra como guía
   de estilo viva del proyecto (más adelante, junto con B-034).

## Criterios de aceptación

- [x] Cada par de direcciones difiere en al menos dos de: tono, tinte del neutro, radio y elevación
  (con marca y sin marca), con test.
- [x] La página de muestra pasa `check_ui` con 0 errores contra un sistema generado (test en Vite y
  Next con cada estilo; y en la prueba real, 0 errores y 0 avisos).
- [x] Hay capturas de las 3 direcciones, de la muestra y de la pantalla real (en la prueba real,
  tomadas con el panel del navegador; la skill las guarda con Playwright).
- [x] Fuera del laboratorio no se escribe nada sin aprobación (regla en `system.md`, contrato en
  `plugin.test.ts`).

## Fuentes verificadas (tarea 1, 2026-10-15)

- Carbon: `@carbon/themes` 11.83, `layer-01/02/03` alternan `#f4f4f4` y `#ffffff` sobre un fondo
  `#ffffff`; la sombra es un token aparte para lo que flota.
- Radix *gray*: croma 0 en los 12 pasos; el paso 1 tiene luminosidad 0.991 en claro y 0.178 en
  oscuro (re-medido en `standards.test.ts`).
- Radios 4, 8 y 16 (Material 3) y sombras 2 y 8 (Fluent 2): ya verificados en B-025.

## Tareas

- [x] 1. Fuentes; estilos en `standards.ts` y `generate.ts`; `style` en la tool; tests; bundle · `ab9f3b5`
- [x] 2. Templates: `lab-theme` con dirección, muestra, rutas de `system/` en Next y Vite, comparar
  direcciones (componente propio), índice y panel; tests · `1d95961`
- [x] 3. Skills: `system.md`, `lab.md`, `apply`, `variants`, `help`; contratos · `f223dca`
- [x] 4. Docs: SPEC §2.h y §7.32, `docs/uso.md`, `CHANGELOG.md`
- [x] 5. Prueba real en `facha-ui-pruebas/vite-sin-diseno`: tres direcciones sobre la pantalla de
  pedidos y la muestra, capturas, comparar, elegir, escribir, `check_ui` y limpieza · `d149f04`
- [x] 6. Release 0.22.0

## Decisiones tomadas durante el trabajo

- **Comparar direcciones con un componente propio** (`system/lab-directions.tsx`) en lugar de
  sumar un modo a la comparación de variantes: esa página está atada a los runs (votos, endpoint
  en vivo, revisiones), y la de direcciones vive y se borra con `system/`.
- **Vite carga `system/` con globs** (`import.meta.glob`), que no fallan cuando la carpeta no está:
  el andamiaje no cambia de lista y un laboratorio sin vista de direcciones sigue respondiendo.
- **El generador entrega `css.lab`** (cada dirección ya acotada a
  `html[data-facha-direction="<id>"]`), para que la skill no transforme CSS a mano.
- **`check_ui` en S5 va sobre la copia y la muestra**, no sobre todo `system/`: `directions.css`
  guarda los valores (218 "color literal" en la prueba) y `lab-directions.tsx` es UI de facha-ui.
- **Con marca, las direcciones pueden parecerse sobre la pantalla** (cambian radio, gris y
  elevación, y una tabla muestra poco de eso): la skill lo dice y remite a la muestra. No se
  forzaron diferencias sin fuente.

## Registro

- **2026-10-15:** spec escrito y plan presentado, pendiente de aprobación. Al relevar el laboratorio
  apareció que el `allowed-tools` de `variants` no incluye Write, Edit ni las herramientas de
  Playwright que usa (funcionan con permiso en cada uso); no se cambia acá.
- **2026-10-15:** plan aprobado ("lo que sea mejor": las cuatro decisiones recomendadas).
  Tareas 1 a 3 (`ab9f3b5`, `1d95961`, `f223dca`); 299 tests.
- **2026-10-15 · prueba real** en `facha-ui-pruebas/vite-sin-diseno` (Vite 5, React Query, router;
  brief con marca `#4f46e5`, densidad compacta), emulando `system.md` con el bundle de la rama:
  - S2: tres direcciones (`brand-standard`, `brand-sober`, `brand-soft`), 62/62 pares cada una;
  - S2b: andamiaje de Vite creado, `system/` escrito, copia de la pantalla de pedidos con tokens;
    `check_ui` sobre la copia: solo `unknown-token` (27), como se espera antes de escribir;
  - la vista funciona con los datos reales en las tres direcciones, la muestra y la comparación
    lado a lado, en claro y oscuro;
  - S4–S5: escrita la dirección sobria; `status: ok`; copia y muestra con 0 errores; laboratorio
    borrado;
  - hallazgos corregidos (`d149f04`): `check_ui` sobre todo `system/` no tenía sentido
    (`directions.css` son los valores), la muestra tenía un enlace «Enlace» (WCAG 2.4.4) y `100vh`
    dejaba ver el fondo de la app; y sobre la tabla las tres direcciones se parecen: la skill lo
    dice y remite a la muestra;
  - límite: la ruta de Next no se probó en ejecución (no hay una app Next de prueba); la cubren los
    tests de contrato y el de `check_ui` de la muestra en un proyecto Next.
- **2026-10-16 · release 0.22.0:** versión en `plugin.json`, `mcp/package.json`, el lockfile y el
  server; CHANGELOG con fecha y enlaces; SPEC §7.32 con la versión; B-026 a Hecho y B-027 a Ahora.

## Cómo retomar

Terminado en 0.22.0. El bloque "diseño desde cero" sigue con B-027 (perfiles por tipo de producto):
el brief ya guarda el tipo y la densidad, y el generador ya tiene estilos; los perfiles fijarían base,
escala, croma y estilo por tipo de producto, con fuente.
