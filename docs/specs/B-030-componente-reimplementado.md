# B-030 · Componente reimplementado y cobertura del design system

> **Estado:** en curso (falta el release) · **Rama:** `feat/component-reuse` · **Ítem:** [BACKLOG.md](../../BACKLOG.md) ·
> **Origen:** [estudio de herramientas](../research/2026-10-15-herramientas-de-diseno.md) ·
> **Última actualización:** 2026-10-16

## Por qué

La IA suele rehacer a mano lo que el proyecto ya tiene como componente: un `<button>` con clases donde
existe `components/ui/button`. El resultado se ve casi igual pero no lo es (foco, estados, tamaños,
variantes), y cada copia se desvía con el tiempo. Lovable y v0 ya controlan que se use el sistema.

## Cómo funciona hoy (relevado el 2026-10-16)

- facha-ui conoce los **tokens** y las **clases CSS reutilizables** (`componentClasses`), pero no los
  **componentes React** del proyecto: nada sabe que existe `Button`.
- El lector de JSX (`sources/jsx.ts`) registra los elementos nativos (`<button>`, `<input>`…) con sus
  clases y atributos; los componentes con mayúscula no se registran.
- `ux_score` puntúa por categorías (consistencia, accesibilidad, responsive, textos, jerarquía) con las
  reglas del guardián; no mide cuánto de la UI usa el sistema.
- El fixture `shadcn-tw4` tiene un `<button className="bg-primary …">` a mano y ningún
  `components/ui/`.

## Plan aprobado (2026-10-16)

### 1. El inventario de componentes (sección `components` de `get_design_system`)

- **Dónde:** la carpeta de UI del proyecto: la de `components.json` (`aliases.ui`, o
  `aliases.components` + `/ui`, la convención de shadcn/ui) o, sin él, `components/ui` o
  `src/components/ui`.
- **Qué:** cada componente exportado, con su archivo, su import (con el alias del proyecto si lo hay)
  y los elementos nativos que dibuja, leídos de su JSX: `<button …>` o el patrón de shadcn
  `asChild ? Slot : "button"`.
- **Qué reemplaza:** solo elementos con significado propio (`button`, `input`, `textarea`, `select`,
  `label`, `table`, `hr`, `dialog`, `progress`), nunca `div` ni `span`: una `Card` que dibuja un
  `div` no convierte a cada `div` en una tarjeta. Los `input` de tipos especiales (checkbox, radio,
  range) van con el componente de ese nombre (`Checkbox`, `RadioGroup`, `Slider`), si existe.

### 2. La regla `ds-component-reuse` (aviso)

- Un elemento nativo que el sistema ya tiene como componente, fuera de la carpeta de UI, es un aviso
  con el import exacto: "`<button>` hecho a mano: el proyecto tiene `Button` (`import { Button } from
  "@/components/ui/button"`)". Fuente: `ux:nielsen-4` (consistencia y estándares) y el propio
  componente (`archivo:línea`).
- No avisa sobre `<input type="hidden">` ni dentro de los archivos del componente.
- Vale también para el laboratorio: las variantes tienen que usar los componentes del sistema.

### 3. La cobertura en `ux_score`

Junto al puntaje de cada pantalla y del proyecto, un bloque `coverage`:
- **componentes:** de los elementos que el sistema tiene como componente, cuántos usan el componente y
  cuántos están hechos a mano;
- **tokens:** de los valores de color escritos (CSS, `style` y clases de Tailwind), cuántos salen de
  un token y cuántos son literales o de la paleta por defecto.

### 4. Skills y docs

- `variants`: la línea que dice de dónde salen los valores ("tokens or classes reported by
  `get_design_system`") suma los componentes. Se reescribe, sin sumar líneas (está en 250).
- `start`: la cobertura en el resumen del proyecto, si cabe en una línea.
- SPEC (§2.a, la regla y la sección; §7.37), `docs/uso.md`, `help`, CHANGELOG.

### 5. Tests y prueba

- `shadcn-tw4` suma `components/ui/button.tsx` e `input.tsx` (como los de shadcn) y una pantalla que
  usa `<Button>`: el `<button>` a mano de la pantalla actual da el aviso con el import; la que usa
  `<Button>` no.
- Negativos: `type="hidden"`, el propio `button.tsx`, un `div` con la `Card` existente.
- `ux_score` con la cobertura (test).
- Prueba real en las apps de prueba.

## Decisiones confirmadas (2026-10-16: las cuatro recomendadas)

1. **Avisa sobre todo elemento hecho a mano que tenga componente, con clases o sin ellas**
   (recomendado). Un `<button>` sin clases también se ve distinto del sistema. La alternativa es
   avisar solo cuando tiene clases o `style`, como decía el backlog.
2. **Aviso, no error** (recomendado). Hay usos legítimos (un `select` nativo por rendimiento en
   móvil); el equipo puede subirlo a error en la config.
3. **La cobertura se informa al lado del puntaje y no lo cambia** (recomendado): los baselines de CI
   siguen siendo comparables, y la regla nueva ya pesa en la categoría de consistencia. La alternativa
   es sumarla a la fórmula del puntaje.
4. **El inventario va en las secciones de siempre** (recomendado), así `variants` lo recibe sin pedir
   nada distinto.

## Criterios de aceptación

- [x] Positivo y negativo en el fixture de shadcn.
- [x] La cobertura sale en `ux_score` (test).
- [x] El aviso trae el import exacto del componente (con el alias de `components.json`, o relativo).
- [x] 0 avisos nuevos en los fixtures sin carpeta de UI.

## Tareas

- [x] 1. Inventario (`components.ts`, sección `components`), tests · `79c16d4`
- [x] 2. Regla `ds-component-reuse`, fixture y tests · `79c16d4`
- [x] 3. Cobertura en `ux_score`, tests · `75f11d3`
- [x] 4. Skills y docs · `eb983cf`
- [x] 5. Prueba real
- [ ] 6. Release (cuando lo pida quien mantiene el repo)

## Decisiones tomadas durante el trabajo

1. **El inventario y la regla van en un mismo commit:** el fixture que los prueba es el mismo.
2. **Qué reemplaza cada componente sale de los nombres de shadcn/ui** (`Button`, `Input`, `Checkbox`…),
   no de lo que dibuja: el `Select` de shadcn dibuja Radix y no un `<select>`, pero es el select del
   sistema. Un componente con otro nombre (`Card`) queda en el inventario sin reemplazar nada.
3. **Sin alias, el import es relativo** al archivo que avisa (`../components/ui/button`).
4. **La cobertura cuenta los usos de un componente cuando está importado de la carpeta de UI**, para no
   contar un `Button` ajeno con el mismo nombre.

## Registro

- **2026-10-16:** relevado lo que existe (tokens y clases, sin componentes React); spec escrito y plan
  presentado, pendiente de aprobación.
- **2026-10-16:** plan aprobado con las cuatro decisiones recomendadas.
- **2026-10-16:** tareas 1 a 4; 358 tests, typecheck y `claude plugin validate` en verde.
- **2026-10-16, prueba real:**
  - `audit_project` en las dos apps de prueba y en `next-visual` (sin carpeta de UI): los mismos totales
    que la 0.26.0;
  - una copia de la app de Vite con `src/components/ui/button.tsx` y sin `components.json`: el
    inventario la toma por convención y un `<button>` a mano en otra pantalla da el aviso con
    `import { Button } from "../components/ui/button";`; el propio `button.tsx` no avisa;
  - en `shadcn-tw4`, la cobertura da 0 para la pantalla con el botón a mano y 1 para la que usa
    `Button` e `Input`.

## Cómo retomar

Todo hecho y probado en `feat/component-reuse`; falta el release (tarea 6), solo cuando quien
mantiene el repo lo pida: versión 0.27.0 con el flujo de `CLAUDE.md`; B-030 a **Hecho** y el primero
de **Siguiente** a **Ahora**.
