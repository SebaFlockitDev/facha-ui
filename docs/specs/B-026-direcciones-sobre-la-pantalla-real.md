# B-026 · Tres direcciones de diseño sobre la pantalla real

> **Estado:** en spec · **Rama:** `feat/design-directions` · **Ítem:** [BACKLOG.md](../../BACKLOG.md) ·
> **Origen:** [estudio de herramientas](../research/2026-10-15-herramientas-de-diseno.md) ·
> **Depende de:** B-025 (generador, hecho en 0.21.0) · **Última actualización:** 2026-10-15

## Por qué

Elegir una paleta en abstracto es elegir a ciegas. Google Stitch muestra varias direcciones, pero
sobre maquetas; facha-ui puede mostrarlas **sobre la pantalla real, con los datos reales**, y además
con cada valor justificado. Hoy `/facha-ui:init system` muestra tablas de colores y escribe: el dev
no ve cómo queda su producto antes de decidir.

## Plan (propuesto, pendiente de aprobación)

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

### 5. Decisiones a confirmar

1. **Direcciones = semilla + estilo**, con los tres estilos de la tabla. Recomendado: con marca
   también hay tres direcciones de verdad, y cada parámetro tiene fuente.
2. **El criterio de aceptación cambia "densidad" por "elevación"**: la densidad sale del brief (es
   una decisión de producto, no de estilo) y no debería variar entre direcciones.
3. **La copia de la pantalla es conservadora** (misma estructura, solo tokens). Recomendado: así se
   comparan los sistemas y no los rediseños; rediseñar es lo que sigue, con `variants`.
4. **Se borra `system/` al terminar** y quedan las capturas. Alternativa: dejar la muestra como guía
   de estilo viva del proyecto (más adelante, junto con B-034).

## Criterios de aceptación

- [ ] Cada par de direcciones difiere en al menos dos de: tono, tinte del neutro, radio y elevación
  (con marca y sin marca), con test.
- [ ] La página de muestra pasa `check_ui` con 0 errores contra un sistema generado.
- [ ] Hay capturas de las 3 direcciones, de la muestra y de la pantalla real.
- [ ] Fuera del laboratorio no se escribe nada sin aprobación.

## Fuentes a verificar (tarea 1)

Modelo de capas de Carbon (superficies sin sombra), escala gris pura de Radix (luminosidad del paso 1
en claro y oscuro), y que los radios 4, 8 y 16 y las sombras 2 y 8 son los que ya están verificados
en `standards.ts`.

## Tareas

- [ ] 1. Fuentes; estilos en `standards.ts` y `generate.ts`; `style` en la tool; tests; bundle
- [ ] 2. Templates: `lab-theme` con dirección, muestra, rutas de `system/` en Next y Vite, comparar en
  modo `system`, índice y panel; tests
- [ ] 3. Skills: `system.md`, `lab.md`, `apply`, `variants`, `help`; contratos
- [ ] 4. Docs: SPEC §2.h y §7.32, `docs/uso.md`, `CHANGELOG.md`
- [ ] 5. Prueba real en `facha-ui-pruebas/vite-sin-diseno`: tres direcciones sobre la pantalla de
  pedidos y la muestra, capturas, comparar, elegir, escribir, `check_ui` y limpieza
- [ ] 6. Release

## Decisiones tomadas durante el trabajo

(ninguna todavía)

## Registro

- **2026-10-15:** spec escrito y plan presentado, pendiente de aprobación. Al relevar el laboratorio
  apareció que el `allowed-tools` de `variants` no incluye Write, Edit ni las herramientas de
  Playwright que usa (funcionan con permiso en cada uso); no se cambia acá.

## Cómo retomar

Esperar la aprobación del plan (sección 5: cuatro decisiones). Con el OK, "Plan (propuesto…)" pasa
a "Plan aprobado (fecha)", el estado a `en curso`, y se arranca por la tarea 1 en la rama
`feat/design-directions`.
