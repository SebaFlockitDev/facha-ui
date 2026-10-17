# B-045 · "¿Cuántas querés?" en el centro

> **Estado:** en spec · **Rama:** `feat/center-count` · **Ítem:** [BACKLOG.md](../../BACKLOG.md) ·
> **Origen:** el desarrollador pidió variantes desde el centro y recibió una sola sin haberlo elegido · **Última actualización:** 2026-10-16

## Por qué

En el formulario "Proponer variantes" del centro (B-042), la cantidad es una casilla **"Una sola variante (más
rápido)"** que viene **marcada de entrada** (`lab-center.tsx:284`, `useState(true)`), al final del formulario y en
negativo ("sin marcar, tres"). Pasan dos cosas:

- **El valor por defecto va contra el producto.** Lo que distingue a facha-ui es comparar tres direcciones con la
  revisión de un crítico independiente; el modo rápido lo saltea (`quick.md`). No debería pasar sin elegirlo
  (`ux:nielsen-5`).
- **La elección no se ve.** Quien pidió variantes recibió una y no supo por qué (`ux:nielsen-1`).

## Cómo funciona hoy (relevado el 2026-10-16)

- `lab-center.tsx:284`: `const [quick, setQuick] = useState(true)`; línea 377: la casilla; línea 317: `quick` va en el
  pedido `run`.
- El endpoint y la skill ya distinguen `quick: true` y `false` (B-042): no cambian.
- El panel guarda preferencias en `localStorage` con lectura y escritura protegidas (`lab-panel.tsx:348`).

## Plan propuesto

| Archivo | Cambio |
|---|---|
| `lab-center.tsx` | La casilla pasa a una pregunta visible, **"¿Cuántas querés?"**, con dos opciones grandes (un grupo de radio con su leyenda, `ux:wcag-1.3.1`): **"3 para comparar"** (tres direcciones distintas, capturas en todos los temas y tamaños y la revisión del crítico; tarda más) y **"1 rápida"** (la que mejor responde al diagnóstico, con el guardián y sin crítico; tarda menos). Va antes de la referencia, justo después del objetivo. **3 viene elegida.** El botón dice lo que va a pasar: "Proponer 3 variantes" o "Proponer 1 variante" (`ux:copy-verbs`). La última elección se recuerda en el navegador (`localStorage`, con lectura y escritura protegidas; si falla, vuelve a 3). |
| `mcp/test/plugin.test.ts` | Contrato: la pregunta, las dos opciones, 3 de entrada y el texto del botón. |
| Docs | `docs/uso.md`, SPEC §2.i y §7.45, CHANGELOG. |

## Decisiones (recomendación en negrita)

1. **Qué viene elegido.** **3 para comparar**: es lo que el producto promete y lo que la skill hace sin `--rapido`.
   El rápido queda a un clic y dice qué se pierde.
2. **Recordar la última elección.** **Sí, en ese navegador**: quien eligió 1 rápida una vez no tiene que volver a
   elegirla. La pregunta queda siempre a la vista, así que nada se esconde.
3. **Tiempos.** **Sin números** ("tarda más", "tarda menos"): dependen del proyecto y no tenemos una medida que los
   respalde.

## Criterios de aceptación

- [ ] Al proponer variantes, la cantidad es una pregunta visible con dos opciones, y 3 viene elegida.
- [ ] Cada opción dice qué incluye; el botón dice cuántas se van a proponer.
- [ ] La última elección se recuerda en el navegador, y sin almacenamiento disponible el formulario funciona igual.

## Tareas

- [ ] 1. La pregunta en el centro; contrato
- [ ] 2. Docs
- [ ] 3. Prueba real (proponer 3 desde el centro)
- [ ] 4. Release

## Decisiones tomadas durante el trabajo

(ninguna todavía)

## Registro

- **2026-10-16:** el desarrollador recibió una variante sin haberlo elegido y pidió poder elegir cuántas; agregado
  al backlog (B-045, junto con B-046) con su OK. Relevado; spec y plan escritos, pendientes de aprobación.

## Cómo retomar

Plan propuesto, esperando la aprobación del desarrollador.
