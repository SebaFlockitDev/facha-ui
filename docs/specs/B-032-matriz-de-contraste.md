# B-032 · Matriz completa de contraste

> **Estado:** en spec · **Rama:** `feat/contrast-matrix` · **Ítem:** [BACKLOG.md](../../BACKLOG.md) ·
> **Origen:** [estudio de herramientas](../research/2026-10-15-herramientas-de-diseno.md); absorbe B-008 ·
> **Última actualización:** 2026-10-16

## Por qué

Hoy facha-ui controla el contraste de los pares que aparecen en el código, y en `health` el peor
caso de cada token de texto. Un sistema accesible garantiza **cada texto sobre cada fondo donde puede
aparecer**: quien diseña una pantalla nueva tiene que saber, antes de escribirla, qué textos puede poner
sobre qué fondos. Además, la sugerencia de contraste puede cambiar el significado de un texto (B-008).

## Cómo funciona hoy (relevado el 2026-10-16)

- **`health` (`token-contrast`)** mide los tokens `text.*` y los que el proyecto usa en `color`
  contra las superficies, y guarda solo la peor por tema. Los tokens `on-accent` (el texto de los
  botones) se saltean: `design-system.ts:74`, "measured against accents, not surfaces (roadmap)".
- **`theme-contrast` y `class-contrast`** miden cada uso contra su fondo real.
  `suggestReadable` (`visual.ts:211`) prefiere un token de la misma familia y, para un estado sin
  token legible, informa una brecha.
- **Prueba sobre un proyecto mínimo** (claro y oscuro, con estados) con la 0.25.0. Dos casos rompen el
  criterio de B-008:
  1. `.msg { color: #ef4444 }`, un rojo escrito a mano bajo un selector neutro, recibe `var(--text)`
     como sugerencia: el error pasa a verse como texto común;
  2. `.alert-error { color: var(--status-danger) }` (2.52:1), con un `--status-success` legible en el
     sistema, recibe **`var(--status-success)`**: un error pintado de "éxito". La familia se compara
     por la primera parte del rol (`status`), no por el estado.
- **Redondeo.** `contrast()` (`color.ts:88`) redondea a dos decimales y las reglas comparan ese
  valor: 4.497:1 pasa como 4.5:1. WCAG dice lo contrario: "the computed values should not be rounded
  (e.g., 4.499:1 would not meet the 4.5:1 threshold)"
  ([Understanding 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)).
- **APCA**, que el backlog pedía informar como dato orientativo:
  - **No está en WCAG 3.** El Editor's Draft del 8 de abril de 2026 dice "The contrast algorithm used
    in WCAG 3 is yet to be determined", y APCA salió del borrador en julio de 2023
    ([Adrian Roselli, abril de 2026](https://adrianroselli.com/2026/04/wcag3-contrast-as-of-april-2026.html)).
    Su recomendación: cumplir WCAG 2 igual.
  - **Su licencia no sirve para facha-ui.** `apca-w3` usa una "Limited W3 License"
    ([LICENSE](https://github.com/Myndex/apca-w3/blob/master/LICENSE.md)): prohíbe el uso comercial sin
    un contrato firmado, obliga a seguir cada versión mayor y trata una implementación que no esté al
    día como violación de copyright. facha-ui es MIT y lo usan equipos de empresas.

## Plan (propuesto, pendiente de aprobación)

### 1. La matriz: sección `contrast` de `get_design_system`

Cada par se mide en cada tema, con su mínimo y su fuente:

| Clase | Qué pares | Mínimo | Fuente |
|---|---|---|---|
| **Texto** | cada token `text.*` sobre cada superficie (`surface.*`, o `contrast.surfaces` si el equipo las declaró) | 4.5:1 | WCAG 1.4.3 |
| **Pares por nombre** | `X-foreground`, `on-X` o `X-fg` sobre `X`; `X-text` sobre `X-bg` o `X-subtle` | 4.5:1 | WCAG 1.4.3; convenciones de shadcn/ui (`X`/`X-foreground`), Material (`on-X`) y Radix (texto del paso 11 sobre los fondos 1 a 5), que usa el generador |
| **Estados** | el texto de cada estado sobre las superficies y sobre el fondo de su mismo estado | 4.5:1 | WCAG 1.4.3 |
| **Usados** | color y fondo declarados en la misma regla del proyecto (con `archivo:línea`) | 4.5:1 | el propio proyecto |
| **No texto** | bordes de controles (`border.*` de inputs, controles o "strong", o usados en bordes de partes interactivas) y el anillo de foco, sobre las superficies | 3:1 | WCAG 1.4.11 |

Para cada par y tema: la razón (truncada a dos decimales, ver el punto 2) y el nivel:
- **AAA** (7:1, WCAG 1.4.6);
- **AA** (4.5:1);
- **solo texto grande**: de 3:1 a 4.5:1, válido solo con 24px o más, o 18.66px en negrita (14pt);
  WCAG 1.4.3;
- **no pasa**.

Un par pasa cuando llega al mínimo en **todos** los temas. Si el equipo pidió otro mínimo
(`contrast.minRatio`), ese decide.

La salida, pensada para quien va a escribir UI:
- `bySurface`: para cada fondo, los textos que pasan en todos los temas, los que solo sirven para texto
  grande y los que no pasan. Es la respuesta a "¿qué texto pongo sobre este panel?";
- `pairs`: todos los pares, compactos (color, fondo, clase, razón y nivel por tema, usos);
- `summary`: cuántos pares hay, cuántos no pasan y cuántos son solo para texto grande, por clase.

La sección va en las de siempre (sin pedirla): para un sistema generado son unos 25 pares.

### 2. Se decide sin redondear

En todas las reglas que miden contraste (la matriz, `health`, `theme-contrast`, `class-contrast`,
`non-text-contrast`, `a11y-gradient-text`), pasa o no pasa con la razón sin redondear. El número que se
muestra se trunca, así un 4.497 se lee 4.49 y nunca "4.5:1, necesita 4.5:1". Fuente: Understanding
1.4.3. Los tests con razones exactas se revisan uno por uno (cambia el último decimal en algunos).

### 3. Sugerencias que conservan el significado (B-008)

En `suggestReadable`:
- **El estado se compara entero.** Para `status.danger` solo valen tokens `status.danger`. Si ninguno
  llega, es una brecha, como hoy.
- **Un color escrito a mano** sin token gemelo y bajo un selector que no dice su estado (caso 1) toma
  el significado del color del sistema con el tono más cercano, a 40° o menos. Ese es el mismo criterio
  de familia que usa el panel en vivo (`lab-palette.ts`). Solo aplica a un color con croma de 0.06 o más,
  el umbral de "fondo con color" de `ux-gray-on-color`. La sugerencia sale de esa familia o es una
  brecha: **un color nunca recibe un gris**.
- Un gris escrito a mano sigue recibiendo el token de texto más cercano.

### 4. `health`: el texto sobre color

Los tokens `on-accent` se miden contra el fondo con el que forman par (punto 1, pares por nombre), como
`token-contrast` con su `against`. Así sale de *roadmap* el comentario de `design-system.ts:74`.

### 5. Skills y docs

- `variants` (250 líneas, el máximo): la fila de `health` de la tabla de fuentes pasa a citar también
  `contrast`. El texto para cada fondo sale de `bySurface`, y un texto "solo grande" va solo en
  títulos de 24px o más. Se reescribe la línea: no se suma ninguna.
- SPEC (§2.a, `get_design_system` y `health`; §7.36), `docs/uso.md`, `help` y CHANGELOG.

### 6. Tests y prueba

- Fixture `contrast-matrix` con:
  - claro y oscuro;
  - textos y superficies;
  - estados con `-bg` y `-text`;
  - pares `on-X` y `X-foreground`;
  - un borde de input;
  - una regla con color y fondo;
  - un par en 4.497:1.
- El criterio de B-008: el rojo escrito a mano recibe un token de error o una brecha; el error que no
  llega, con un éxito legible, recibe una brecha y no el éxito; un gris sigue recibiendo un texto.
- El redondeo: 4.497:1 no pasa en ninguna regla.
- La matriz en los fixtures existentes (shadcn con Tailwind 3 y 4, un sistema generado).
- Prueba real en las apps de prueba.

## Decisiones para confirmar

1. **APCA queda afuera** (recomendado). No está en WCAG 3, que todavía no eligió algoritmo, y su
   licencia prohíbe el uso comercial sin contrato. WCAG 2.2 es lo que se exige hoy. La alternativa es
   informarlo igual con la dependencia `apca-w3`, con el riesgo de licencia para cada equipo que use
   facha-ui.
2. **La sección `contrast` va en las de siempre** (recomendado). Es chica, y `variants` la recibe sin
   pedir nada distinto. La alternativa es pedirla aparte, lo que sumaría una línea a `variants`, que ya
   está en el máximo.
3. **Un color escrito a mano nunca recibe un gris** (recomendado): recibe un token de su familia o una
   brecha. La alternativa es limitarlo a los textos con un estado en el selector (`.error`, `.alert`),
   que deja abierto el caso 1.
4. **Sin redondeo en todas las reglas** (recomendado), no solo en la matriz. Si no, la matriz y el
   guardián podrían no coincidir sobre el mismo par.

## Criterios de aceptación

- [ ] La matriz sale en `get_design_system` (`contrast`), con cada texto sobre cada fondo donde puede
  aparecer, en cada tema.
- [ ] Un texto de error con contraste bajo recibe un token de error legible o una brecha, nunca un
  gris (criterio de B-008), ni el token de otro estado.
- [ ] 4.497:1 no pasa el mínimo de 4.5:1.
- [ ] 0 cambios de resultado en los fixtures existentes salvo los que la matriz o el redondeo explican.

## Tareas

- [ ] 1. Contraste sin redondear (`color.ts` y las reglas), tests
- [ ] 2. La matriz (`contrast.ts`, sección `contrast`), fixture y tests
- [ ] 3. Sugerencias con significado (`visual.ts`), tests de B-008
- [ ] 4. `health` mide `on-accent`
- [ ] 5. `variants`, SPEC, guía, `help`, CHANGELOG
- [ ] 6. Prueba real
- [ ] 7. Release

## Decisiones tomadas durante el trabajo

(ninguna todavía)

## Registro

- **2026-10-16:** relevado el contraste de hoy; prueba sobre un proyecto mínimo con los dos casos que
  rompen B-008; investigados el redondeo (Understanding 1.4.3) y APCA (estado en WCAG 3 y licencia);
  spec escrito y plan presentado, pendiente de aprobación.

## Cómo retomar

Esperar la aprobación del plan y de las cuatro decisiones. Con el OK: "Plan (propuesto…)" pasa a "Plan
aprobado (fecha)", el estado a `en curso`, y se arranca por la tarea 1 en `feat/contrast-matrix`.
