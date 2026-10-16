# B-027 · Perfiles por tipo de producto, con fuentes

> **Estado:** en curso · **Rama:** `feat/product-profiles` · **Ítem:** [BACKLOG.md](../../BACKLOG.md) ·
> **Origen:** [estudio de herramientas](../research/2026-10-15-herramientas-de-diseno.md) ·
> **Depende de:** B-025 y B-026 (hechos en 0.21.0 y 0.22.0) · **Última actualización:** 2026-10-16

## Por qué

"Profesional" depende del producto: un panel de datos, una tienda y un sitio de contenido no tienen
la misma densidad, ni el mismo tamaño de texto, ni las mismas reglas para números o párrafos. El
brief ya guarda el tipo de producto (B-024), pero hoy el generador no lo usa: solo mira la
densidad. Los design systems de referencia ya resolvieron estas diferencias; citarlos evita decidir
por gusto.

## Fuentes verificadas (2026-10-16, en la documentación primaria)

| Id | Fuente | Qué dice |
|---|---|---|
| `carbonStyleStrategies` | Carbon, [Style strategies](https://carbondesignsystem.com/elements/typography/style-strategies/) y [Type sets](https://carbondesignsystem.com/elements/typography/type-sets/) | El set productivo (base 14px) se hizo para diseño de producto; el expresivo (base 16px), para páginas editoriales |
| `carbonTableRows` | Carbon, [Data table · usage](https://carbondesignsystem.com/components/data-table/usage/) | Filas de 24 (muy denso), 32 ("interfaces compactas"), 40, 48 y 64px |
| `wcag255` | [WCAG 2.2 SC 2.5.5](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html) | Objetivos de al menos 44×44px, pensado para pantallas táctiles |
| `wcag148` | [WCAG 2.2 SC 1.4.8](https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation.html) | Líneas de no más de 80 caracteres; párrafos separados al menos 1.5 veces el interlineado |
| `baymardLineLength` | Baymard, [Readability: The Optimal Line Length](https://baymard.com/blog/line-length-readability) (2022) | La línea óptima de texto mide 50 a 75 caracteres (pruebas de e-commerce) |
| `govukTableNumbers` | GOV.UK Design System, [Table](https://design-system.service.gov.uk/components/table/) | Al comparar columnas de números, alinearlos a la derecha |
| `mdnTabularNums` | MDN, [font-variant-numeric](https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric) | `tabular-nums`: cifras del mismo ancho, para alinearlas como en tablas |

**Sin fuente, queda afuera:** el "croma moderado" de fintech que nombraba el backlog. Si aparece una
fuente, se suma.

## Plan aprobado (2026-10-16)

### 1. Perfiles (`mcp/src/standards.ts`)

| Tipo de producto | Densidad por defecto | Escala tipográfica | Alto de controles | Tokens propios | Pautas |
|---|---|---|---|---|---|
| `saas-dashboard`, `internal-tool` | compacta | Carbon productiva (14px) | 32px | `--size-row: 32px`, `--numerals: tabular-nums` | números a la derecha y tabulares; filas compactas |
| `fintech` | equilibrada | Carbon productiva (14px) | 40px | `--numerals: tabular-nums` | números a la derecha y tabulares |
| `ecommerce`, `consumer-app` | equilibrada | Material 3 (16px) | 48px (≥ 44 táctil) | `--measure: 75ch` (solo e-commerce) | objetivos táctiles de 44px; descripciones de 50 a 75 caracteres |
| `content`, `marketing` | aireada | Material 3 (16px) | 48px | `--measure: 75ch` | líneas de 50 a 75 caracteres; párrafos separados 1.5 veces el interlineado |
| `other` | sin perfil: lo de hoy | | | | |

- La **densidad del brief manda**; el perfil solo la completa cuando falta. El alto de controles es el
  mayor entre el de la densidad y el del perfil.
- La escala sale del **tipo de producto** cuando hay perfil (Carbon productivo para producto,
  Material 3 para lo editorial y táctil); sin perfil, de la densidad, como hoy.
- Cada valor de un perfil nombra su fuente; un test falla si alguno no la tiene.

### 2. Generador y tool

- `proposeSystem` recibe `productType`; la salida suma `profile` (tipo, valores aplicados con su
  fuente y pautas).
- `propose_design_system` toma el tipo del brief, y `inputs` dice el origen de cada valor (argumento,
  brief, perfil o valor por defecto).

### 3. Las pautas se pueden citar (`skills/_shared/ux-principles.md`)

Tres principios nuevos, con qué son, cómo se violan y cómo se verifican: `ux:line-length` (WCAG
1.4.8 y Baymard), `ux:numeric-alignment` (GOV.UK y MDN) y `ux:wcag-2.5.5` (objetivos táctiles). Las
pautas de cada perfil los citan, así `variants` y el revisor los usan como fuente.

### 4. `get_design_system` → `profile`

Una sección nueva, derivada del brief: el perfil del producto con sus pautas. `variants` la usa en el
diagnóstico (paso 3b) y en las hipótesis.

### 5. Skills y docs

- `system.md`: S3 muestra el perfil y sus valores con fuente.
- `brief.md`: el campo Producto dice qué implica cada tipo.
- `variants/SKILL.md`: el diagnóstico cita las pautas del perfil (sin pasar de 250 líneas).
- SPEC (sección de perfiles y §7.33), `docs/uso.md`, `CHANGELOG.md`.

### 6. Prueba real y release

En `facha-ui-pruebas/vite-sin-diseno` (brief `internal-tool`): el sistema sale con escala productiva,
filas de 32px y cifras tabulares; `get_design_system` devuelve el perfil.

## Criterios de aceptación

- [x] Cada valor de un perfil cita su fuente, verificada en la documentación primaria (tabla de
  arriba); un test controla que ninguno quede sin fuente.
- [x] El generador usa el perfil del brief (test por tipo de producto), y la densidad del brief
  manda sobre la del perfil.
- [x] Las pautas se citan con ids `ux:*` existentes (test).

## Tareas

- [x] 0. Fuentes verificadas (tabla de arriba)
- [x] 1. Perfiles en `standards.ts`, `productType` en `generate.ts` y en la tool, sección `profile`,
  tests, bundle · `8bf2fb7`
- [x] 2. Principios nuevos en `ux-principles.md` · `8bf2fb7`
- [x] 3. Skills: `system.md`, `brief.md`, `variants`; contratos · `313cd38`
- [x] 4. Docs: SPEC, `docs/uso.md`, `CHANGELOG.md` · `fbf25e4`
- [x] 5. Prueba real
- [ ] 6. Release

## Decisiones tomadas durante el trabajo

- **Solo se fija lo que tiene fuente para ese tipo de producto.** Fintech no fija densidad ni
  controles; la app de consumo no fija escala (ninguna fuente verificada dice qué tamaño de texto
  corresponde): ahí decide la densidad, como antes.
- **La escala sale del perfil** cuando lo tiene (Carbon productiva para producto, Material 3 para
  lo editorial), aun con otra densidad: fintech queda en 14px con densidad equilibrada. La salida
  dice de dónde salió (`typography.scaleFrom`).
- **Las pautas van en inglés** en el MCP, como el resto de sus mensajes (B-010 los traduce); las
  skills las dicen en el idioma del dev.
- **`--numerals: tabular-nums`** como token propio (no `font-*`, que facha-ui leería como
  familia), y `--measure: 75ch`, el tope de Baymard dentro del máximo de WCAG 1.4.8.

## Registro

- **2026-10-16:** fuentes verificadas en la documentación primaria; spec escrito y plan presentado,
  pendiente de aprobación. Polaris y Material 3 no se pudieron leer sin un navegador (sus páginas se
  arman con JavaScript); no se usan.
- **2026-10-16:** plan aprobado. Tareas 1 a 4 (`8bf2fb7`, `313cd38`, `fbf25e4`); 309 tests. Prueba
  real en `facha-ui-pruebas/vite-sin-diseno` (brief `internal-tool`, densidad compacta) por el
  bundle y stdio: `get_design_system` → `profile` con 2 pautas y 6 fuentes; `propose_design_system`
  toma el tipo del brief, escala productiva de Carbon (`scaleFrom: profile internal-tool`),
  `--size-row: 32px`, `--numerals: tabular-nums`, controles de 32px; 62/62 pares en las tres
  direcciones.

## Cómo retomar

**Estado al 2026-10-16:** tareas 0 a 5 hechas en `feat/product-profiles`, sin push. Falta el release
(tarea 6), con el OK de quien mantiene el repo: versión menor (0.23.0), con el flujo de `CLAUDE.md`;
B-027 pasa a Hecho y el primero de Siguiente sube a Ahora.
