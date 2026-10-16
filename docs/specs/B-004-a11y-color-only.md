# B-004 · Regla `a11y-color-only`

> **Estado:** en curso (falta el release) · **Rama:** `feat/color-only` · **Ítem:** [BACKLOG.md](../../BACKLOG.md) ·
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

## Plan aprobado (2026-10-16)

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

## Decisiones confirmadas (2026-10-16: las tres recomendadas)

1. **Un elemento con `aria-hidden="true"` no avisa** (recomendado): quien lo marca dice que es
   decorativo, y en la práctica va al lado del texto que dice el estado. La alternativa es avisar
   igual, con más falsos positivos.
2. **Aviso, no error** (recomendado): el estado se infiere del nombre de una clase o variable, y puede
   equivocarse.
3. **Las filas o fondos de color con texto adentro quedan afuera** (recomendado): si la fila dice
   "Vencido", el color no es la única señal. Solo se marcan los elementos sin texto.

## Criterios de aceptación

- [x] Positivos y negativos en un fixture.
- [x] 0 falsos positivos en los fixtures existentes.
- [x] `ux-principles.md` pasa `ux:wcag-1.4.1` a "verificado por el guardián".

## Tareas

- [x] 1. Datos del JSX (`siblingText`, `graphic`, `classVars`) · `2245d29`
- [x] 2. Regla `a11y-color-only`, fixture y tests · `a677f36`
- [x] 3. Principios, SPEC, guía, CHANGELOG · `b679840`
- [x] 4. Prueba real
- [ ] 5. Release

## Decisiones tomadas durante el trabajo

1. **La regla vive en su propio archivo (`color-only.ts`)**, como `look.ts`: necesita el contexto (los
   roles de los tokens), que `a11y.ts` no recibe.
2. **Un elemento con `{...props}` no avisa:** puede recibir un `aria-label` que no se ve.

## Registro

- **2026-10-16:** relevado; prototipados los tres datos del JSX (sin commit); spec escrito y plan
  presentado, pendiente de aprobación.
- **2026-10-16:** plan aprobado con las tres decisiones recomendadas.
- **2026-10-16:** tareas 1 a 3; 361 tests, typecheck y `claude plugin validate` en verde.
- **2026-10-16, prueba real:** `audit_project` en las dos apps de prueba y en `next-visual`,
  `shadcn-tw4`, `next-ux` y `vite-react`: los mismos totales que la 0.27.0 (la tabla de pedidos de la
  app de Vite muestra el estado con texto en el chip, y no avisa). En el fixture, los tres positivos y
  ninguno de los ocho negativos.

## Cómo retomar

Todo hecho y probado en `feat/color-only`; falta el release (tarea 5), solo cuando quien mantiene
el repo lo pida: versión 0.28.0 con el flujo de `CLAUDE.md`; B-004 a **Hecho** y el primero de
**Siguiente** a **Ahora**.
