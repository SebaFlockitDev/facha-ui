# B-029 · Reglas contra el "look genérico de IA"

> **Estado:** en curso · **Rama:** `feat/generic-look-rules` · **Ítem:** [BACKLOG.md](../../BACKLOG.md) ·
> **Origen:** [estudio de herramientas](../research/2026-10-15-herramientas-de-diseno.md) ·
> **Última actualización:** 2026-10-16

## Por qué

Los generadores de UI tienden al promedio de la web. Las defensas que existen (la skill
frontend-design de Anthropic, Impeccable) son instrucciones en el prompt, con listas de cosas a
evitar, y nadie las verifica. Un guardián determinístico que las verifique es un diferencial claro de
facha-ui. Pero las reglas de facha-ui necesitan una fuente: una señal que solo es gusto no puede ser
una regla.

## Las siete señales del backlog, contra las fuentes (verificadas el 2026-10-16)

| Señal | Qué hay detrás | Decisión |
|---|---|---|
| Texto gris sobre fondo de color | Radix diseña sus pasos de texto (11 y 12) para ir sobre fondos de la **misma escala**, y sobre los sólidos (paso 9) usa texto blanco u oscuro ([understanding the scale](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale)) | **Regla** `ux-gray-on-color` |
| Degradados de fondo decorativos | El problema verificable es el texto encima: WCAG pide el contraste contra todo el fondo detrás de las letras ([G18](https://www.w3.org/WAI/WCAG22/Techniques/general/G18), con el ejemplo de un degradado; falla [F83](https://www.w3.org/WAI/WCAG22/Techniques/failures/F83)) | **Regla** `a11y-gradient-text` |
| Animación de entrada en cada sección | WCAG 2.3.3 ([Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)): el movimiento se tiene que poder desactivar; técnica [C39](https://www.w3.org/WAI/WCAG22/Techniques/css/C39) (`prefers-reduced-motion`); variantes `motion-safe`/`motion-reduce` de [Tailwind](https://tailwindcss.com/docs/hover-focus-and-other-states) | **Regla** `a11y-motion` |
| Tarjetas dentro de tarjetas | Ninguna fuente dice que se eviten: Carbon dice que un *tile* puede contener componentes anidados; Laws of UX solo explica que un borde agrupa ([common region](https://lawsofux.com/law-of-common-region/)) | **Señal de revisión** (`review_ui`, no bloquea), con `ux:gestalt-common-region` |
| Neutros grises puros con color de marca | Radix: el gris puro "va bien con cualquier" color ([composing a palette](https://www.radix-ui.com/colors/docs/palette-composition/composing-a-palette)); Carbon lo usa; el estilo sobrio de facha-ui también | **Afuera**: no es un error |
| El mismo radio y sombra en todos los bloques | Sin fuente, y no se puede ver archivo por archivo | **Afuera** (queda como idea para la revisión) |
| Una sola tipografía sin escala | Ya lo cubren `tailwind-default-scale`, los tokens de tamaño y `review_ui` (más de 4 tamaños) | **Ya cubierto** |

## Plan aprobado (2026-10-16)

### 1. Tres reglas del guardián (severidad: aviso)

- **`ux-gray-on-color`**: texto de un gris medio (croma OKLCH < 0.045, luminosidad entre 0.3 y 0.85; el umbral subió de 0.03 en la prueba real, ver el registro)
  sobre un fondo de color (croma ≥ 0.06), en la misma regla CSS o el mismo elemento. Sugerencia: el
  texto de la misma familia (`--color-primary-strong`, `--color-*-text`) o, sobre un sólido, el texto
  sobre acento (`--color-on-*`). No marca texto casi negro ni casi blanco, ni fondos apenas teñidos.
- **`a11y-gradient-text`**: texto con un degradado de fondo (`linear-`, `radial-`, `conic-gradient`)
  en la misma regla: el contraste se mide contra **cada** parada del degradado, y avisa si alguna
  queda bajo el mínimo, con la parada y la razón. Cubre el hueco de hoy: con un degradado,
  `theme-contrast` no puede medir y calla.
- **`a11y-motion`**: una animación CSS (`animation`, `animation-name`) cuando ningún CSS del
  proyecto tiene `@media (prefers-reduced-motion: reduce)`, o una clase `animate-*` de Tailwind sin
  `motion-safe:` ni un `motion-reduce:` en el mismo elemento. Las transiciones (`transition`) no
  cuentan.

Las tres viven en un módulo nuevo (`mcp/src/look.ts`) y se registran como las demás (`rules.ts`,
`types.ts`, configurables en `rules`).

### 2. Una señal de revisión

`review_ui` suma **`nested-surfaces`** (info, nunca bloquea): un elemento con aspecto de tarjeta
(radio y borde o sombra, por utilidades de Tailwind o por una clase del proyecto) dentro de otro.
Pide confirmar que el borde interior agrupa algo; si no, sacarlo (`ux:gestalt-common-region`).

### 3. Principios (`skills/_shared/ux-principles.md`)

- `ux:text-on-color` (nuevo): texto sobre un fondo de color, de su misma familia o el texto sobre
  acento (Radix). Verificado por el guardián.
- `ux:wcag-2.3.3` (nuevo): movimiento que se puede desactivar (`prefers-reduced-motion`). Verificado
  por el guardián.
- `ux:wcag-1.4.3`: suma `a11y-gradient-text` a su línea de verificación.
- La tabla de cobertura se actualiza.

### 4. Tests

- Fixture `mcp/test/fixtures/generic-look/` con casos positivos y negativos de cada regla y de la señal.
- **0 falsos positivos** en los fixtures existentes, en los templates del laboratorio y en un sistema
  generado por `propose_design_system` (la muestra de B-026).

### 5. Docs y skills

SPEC (§2.a.4, reglas; §7.34), `docs/uso.md` (tabla de reglas), `CHANGELOG.md`; `help` lista las
reglas nuevas. Las skills no cambian: el guardián y `review_ui` ya se usan en cada paso.

### 6. Prueba real y release

## Decisiones confirmadas (2026-10-16: las dos recomendadas)

1. **Tres reglas, una señal de revisión y tres señales afuera**, según la tabla. Recomendado: una
   regla sin fuente sería gusto disfrazado de verificación, lo mismo que facha-ui critica de las
   otras herramientas.
2. **Severidad de aviso** para las tres, como pide el backlog. Ninguna bloquea, aunque
   `a11y-gradient-text` podría ser error cuando una parada falla: se deja en aviso porque no se
   sabe sobre qué parte del degradado cae el texto.

## Criterios de aceptación

- [x] Positivos y negativos en un fixture para cada regla y para la señal.
- [x] Severidad de aviso.
- [x] 0 falsos positivos en los fixtures existentes, en los templates del laboratorio y en la muestra
  con un sistema generado.
- [x] Cada regla figura en `ux-principles.md` como verificada por el guardián (test).
- [x] Cada regla cita su fuente.

## Tareas

- [x] 0. Fuentes verificadas (tabla de arriba)
- [x] 1. `look.ts` (tres reglas), registro, tests con el fixture, bundle · `9369c18`
- [x] 2. Señal `nested-surfaces` en `review_ui`, tests · `9369c18`
- [x] 3. Principios · `9369c18`
- [x] 4. Docs y `help` · `e190393`
- [x] 5. Prueba real
- [ ] 6. Release

## Decisiones tomadas durante el trabajo

- **`theme-contrast` deja de medir degradados.** `colorOf` tomaba el primer color de un degradado
  como si fuera un fondo sólido, contra lo que dice el comentario de `textContrast` ("no se adivina").
  Ahora `textContrast` devuelve `null` con un degradado y lo mide `a11y-gradient-text`, contra
  todas las paradas. Un caso que antes podía ser error pasa a aviso (anotado en el CHANGELOG).
- **`siblingBackgroundImage`** en los usos de CSS: un degradado puede venir en `background-image`.
- **`ancestorClassLists`** en los elementos JSX: la señal `nested-surfaces` mira las clases de cada
  ancestro por separado, para que un borde de uno y un radio de otro no parezcan una tarjeta.
- **Umbral de gris en 0.045** (antes 0.03): la prueba real mostró que el `slate-500` de Tailwind, el
  gris típico de lo generado, tiene croma 0.041 y quedaba afuera. Un azul grisáceo de verdad (0.063)
  sigue contando como color.
- **Las tres reglas, la señal y los principios entraron en un solo commit** (`9369c18`): comparten
  el fixture y los tests.

## Registro

- **2026-10-16:** fuentes verificadas; de siete señales, tres son reglas, una es señal de revisión,
  dos quedan afuera (contradicen a Radix y Carbon, o no tienen fuente) y una ya estaba cubierta.
  Spec escrito y plan presentado, pendiente de aprobación.
- **2026-10-16:** plan aprobado. Tareas 1 a 4 (`9369c18`, `e190393`); 317 tests.
- **2026-10-16 · prueba real:** el guardián completo sobre las dos apps de prueba: 0 hallazgos de las
  reglas nuevas (sin falsos positivos). Sobre una landing "de manual" generada por IA (hero con
  degradado y texto blanco, banner con gris sobre la marca, animación de entrada en cada sección,
  `animate-bounce`, tarjetas anidadas): detectó el degradado (1.23:1 contra `#e0e7ff`), las dos
  animaciones y las tarjetas anidadas, pero **no** el gris sobre la marca: era `slate-500`, croma
  0.041, y el umbral estaba en 0.03. Subido a 0.045, con un caso nuevo en el fixture; ahora salen las
  cuatro reglas y las apps reales siguen en 0.

## Cómo retomar

**Estado al 2026-10-16:** tareas 0 a 5 hechas en `feat/generic-look-rules`, sin push. Falta el release
(tarea 6), con el OK de quien mantiene el repo: versión menor (0.24.0), con el flujo de `CLAUDE.md`;
B-029 pasa a Hecho y el primero de Siguiente sube a Ahora.
