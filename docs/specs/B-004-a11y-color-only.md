# B-004 · Regla `a11y-color-only`

> **Estado:** en spec · **Rama:** `feat/color-only` · **Ítem:** [BACKLOG.md](../../BACKLOG.md) ·
> **Origen:** SPEC §6 (reglas UX), `skills/_shared/ux-principles.md` ·
> **Última actualización:** 2026-10-16

## Por qué

Un estado que se distingue solo por color falla WCAG 1.4.1 (`ux:wcag-1.4.1`): quien no distingue rojo
de verde, o mira la pantalla al sol, no sabe si el pedido está pagado o vencido. Hoy solo lo ve la
revisión (`ux-principles.md`: "Not yet a guardian rule").

## Cómo funciona hoy (relevado el 2026-10-16)

- `status-confusable` (`health`) compara los colores de los estados entre sí (también con deuteranopía
  y protanopía simuladas), pero no mira si un estado se muestra **solo** con color.
- `STATUS_KINDS` (`visual.ts:19`) ya reconoce estados por nombre de clase o selector (`danger`,
  `paid`, `pending`, `success`…).
- El lector de JSX sabe si un elemento tiene texto o nombre accesible (`name`), pero no si tiene texto
  al lado (`<span class="dot" /> Pagado`), ni un ícono adentro, ni qué variable interpola su clase
  (`dot-${order.status}`).

## Plan (propuesto, pendiente de aprobación)

### 1. Lo que la regla necesita del JSX

Tres datos más por elemento, en `sources/jsx.ts` (ya prototipados, sin commit, con los 357 tests en
verde):
- `siblingText`: su padre tiene texto o una expresión entre sus hijos directos (una etiqueta al lado
  del punto);
- `graphic`: contiene un `svg` o un `img` (un ícono es una señal además del color);
- `classVars`: los nombres que interpola su `className` (`chip-${order.status}` → `order`, `status`).

### 2. La regla `a11y-color-only` (aviso)

Un elemento no interactivo (`span`, `div`, `i`, `b`, `small`, `td`, `li`, `mark`) que lleva un
estado por color:
- una clase cuyo nombre dice un estado (`STATUS_KINDS`: `dot-danger`, `chip-paid`, `status-error`);
- una utilidad o un `style` de color con un token de estado (`bg-success`, `text-destructive`,
  `bg-[var(--status-danger)]`);
- o un `className` que interpola un estado (`dot-${order.status}`: nombres `status`, `state`,
  `severity`, `health`, `result`).

…y nada más lo dice: sin texto propio ni al lado, sin `aria-label`, `title` ni `aria-labelledby`, y
sin ícono adentro. La solución que trae: un texto visible o solo para lectores de pantalla (`sr-only`),
o un ícono con nombre, junto al color. Fuente: WCAG 1.4.1, `ux:wcag-1.4.1`.

### 3. Principios, skills y docs

- `ux-principles.md`: `ux:wcag-1.4.1` pasa a "verificado por el guardián" (criterio del backlog).
- SPEC (§2.a, la tabla de reglas; §7.38), `docs/uso.md`, CHANGELOG.

### 4. Tests y prueba

- Fixture con positivos (el punto de estado sin texto, la clase interpolada con el estado, el chip
  con `bg-success` vacío) y negativos (el chip con texto, el punto con texto al lado, con ícono, con
  `aria-label`, con `aria-hidden`, un botón).
- 0 falsos positivos en los fixtures existentes y en las apps de prueba.

## Decisiones para confirmar

1. **Un elemento con `aria-hidden="true"` no avisa** (recomendado): quien lo marca dice que es
   decorativo, y en la práctica va al lado del texto que dice el estado. La alternativa es avisar
   igual, con más falsos positivos.
2. **Aviso, no error** (recomendado): el estado se infiere del nombre de una clase o variable, y puede
   equivocarse.
3. **Las filas o fondos de color con texto adentro quedan afuera** (recomendado): si la fila dice
   "Vencido", el color no es la única señal. Solo se marcan los elementos sin texto.

## Criterios de aceptación

- [ ] Positivos y negativos en un fixture.
- [ ] 0 falsos positivos en los fixtures existentes.
- [ ] `ux-principles.md` pasa `ux:wcag-1.4.1` a "verificado por el guardián".

## Tareas

- [ ] 1. Datos del JSX (`siblingText`, `graphic`, `classVars`)
- [ ] 2. Regla `a11y-color-only`, fixture y tests
- [ ] 3. Principios, SPEC, guía, CHANGELOG
- [ ] 4. Prueba real
- [ ] 5. Release

## Decisiones tomadas durante el trabajo

(ninguna todavía)

## Registro

- **2026-10-16:** relevado; prototipados los tres datos del JSX (sin commit); spec escrito y plan
  presentado, pendiente de aprobación.

## Cómo retomar

Esperar la aprobación del plan y de las tres decisiones. Con el OK: "Plan (propuesto…)" pasa a "Plan
aprobado (fecha)", el estado a `en curso`, y se arranca por la tarea 1 en `feat/color-only` (el
prototipo del JSX está sin commit en esa rama).
