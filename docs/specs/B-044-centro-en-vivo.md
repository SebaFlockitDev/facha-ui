# B-044 · Centro en vivo: escucha real, volver a medir, evolución y elegir

> **Estado:** hecho (0.34.0) · **Rama:** `feat/center-live` (mergeada) · **Ítem:** [BACKLOG.md](../../BACKLOG.md) ·
> **Origen:** revisión del centro (B-042) contra el mercado, pedida por el desarrollador · **Última actualización:** 2026-10-16

## Por qué

El centro (B-042) junta todo en una pantalla, pero tiene cuatro huecos:

1. **"Claude Code está escuchando" puede ser falso.** El indicador sale de que la sesión esté vigente, no de
   que alguien escuche. Si se cierra la conversación, o mientras se reactiva la escucha (el Monitor vence a
   los 30 minutos), sigue en verde y los pedidos esperan sin aviso (`ux:nielsen-1`).
2. **El estado se congela.** El puntaje es el de cuando se abrió el centro: no hay forma de volver a medir.
3. **No muestra la evolución.** Lighthouse CI y Chromatic muestran cómo cambia cada página; el centro solo
   muestra el número de hoy.
4. **No se decide desde ahí.** Las variantes se ven, pero elegir una no lleva a ningún lado; Chromatic deja
   aceptar o rechazar desde su panel.

## Cómo funciona hoy (relevado el 2026-10-16)

- `skills/variants/scripts/live-watch.mjs`: solo lee; imprime un pedido por línea y termina cuando la sesión
  se cierra. Nadie deja rastro de que está escuchando.
- `facha-live/live-core.ts` (`handleGet`): `active` sale de `session.json` (`active` y `expiresAt`).
- `lab-center.tsx:445`: `listening = live.active && live.scope === "project"`. El panel de cada variante
  (`lab-panel.tsx`) usa lo mismo.
- `center.json` lo escribe la skill una vez (C3); el endpoint lo sanea (`readCenter`). No tiene historia.
- El pedido `choose` existe (desde el panel, `live.md` L4): Claude marca `chosen` y muestra
  `/facha-ui:apply <slug> <x>`; nunca aplica.

## Plan aprobado (2026-10-16, con las cuatro decisiones recomendadas)

| Archivo | Cambio |
|---|---|
| `skills/variants/scripts/live-watch.mjs` | Escribe `.facha-ui/live/listener.json` (`{ "at": <ISO> }`) al arrancar y cada 10 s; al terminar, `{ "at", "stopped": true }`. Es su única escritura. Emite el pedido `measure`. |
| `facha-live/live-core.ts` | El `GET` suma `listening`: hay sesión y `listener.json` tiene menos de 45 s y no dice `stopped`. Pedido nuevo `measure` (solo en una sesión de proyecto, sin texto). `readCenter` suma `history` (hasta 24 puntos `{ at, score }`) y `previous` por pantalla (el puntaje de la medición anterior), saneados. |
| `lab-center.tsx` | **Indicador con tres estados:** escuchando (verde); sesión abierta pero sin escucha (ámbar: "Claude Code no está escuchando. Volvé a la conversación y decí *abrí facha-ui*; lo que pidas queda en cola"); sin sesión. **"Volver a medir"** con su estado (en cola → midiendo → listo). **Evolución:** la diferencia con la medición anterior en el puntaje del proyecto y en cada pantalla ("↑ 4", "↓ 2", con texto y no solo color, `ux:wcag-1.4.1`) y la fecha de la anterior. **"Elegir esta"** en cada variante: muestra `/facha-ui:apply <slug> <x>` para copiar y manda `choose`. |
| `lab-panel.tsx` | Su indicador usa `listening` (el mismo hueco). |
| `skills/center/SKILL.md` | C3 conserva la historia: la medición anterior pasa a `previous` y suma un punto a `history`. C5: `measure` repite C1 y C3; después de cada `run`, vuelve a medir. `choose`, como L4. |
| `skills/variants/live.md` | L2: el watcher deja `listener.json` y por qué. |
| Tests | `live.test.ts`: `listening` con señal fresca, vieja, `stopped` y sin sesión; `measure` solo en sesión de proyecto; `history` y `previous` saneados; el watcher escribe la señal y emite `measure`. `plugin.test.ts`: la página muestra el comando de `apply` y nunca manda `apply`. |
| Docs | `docs/uso.md`, SPEC §2.i y §7.44, CHANGELOG, `help`. |

## Decisiones (recomendación en negrita)

1. **De dónde sale "escuchando".** **A (recomendada): del watcher**, que escribe una señal cada 10 s. El watcher
   vive mientras viva el Monitor de la conversación, así que es la prueba real. B: que Claude la escriba en cada
   pedido; no sirve, porque cuando no hay pedidos no hay señal.
2. **Sin escucha, ¿se puede pedir?** **Sí, con aviso:** el pedido queda en cola y el watcher lo vuelve a emitir al
   arrancar (ya lo hace). Bloquear los botones haría perder lo escrito.
3. **Dónde vive la historia.** **En `center.json`**: 24 puntos del proyecto y la medición anterior por pantalla.
   Alcanza para la tendencia y no suma archivos. Un historial completo queda para la etapa 2.
4. **"Elegir esta".** **Muestra el comando y manda `choose`**, así Claude lo confirma en la conversación (L4) y la
   tarjeta recuerda la elección. Nunca aplica: `apply` lo arranca quien desarrolla.

## Fuera de este ítem

- La etapa 2 del centro: el brief y el design system como formularios, y el historial de decisiones navegable.
- Revisar un recorrido (`flow`) desde el centro.

## Criterios de aceptación

- [x] Con la conversación cerrada o la escucha caída, el centro y el panel lo dicen en menos de un minuto, y los pedidos quedan en cola.
- [x] "Volver a medir" actualiza el estado del proyecto y de cada pantalla.
- [x] El centro muestra la diferencia con la medición anterior, con texto y no solo color.
- [x] "Elegir esta" muestra el comando exacto de `apply` y nunca aplica.

## Tareas

- [x] 1. Watcher y endpoint (`listening`, `measure`, `history`, `previous`); tests
- [x] 2. El centro y el panel; contratos
- [x] 3. La skill `center`, `live.md` y las docs
- [x] 4. Prueba real (cerrar la escucha y ver el aviso; volver a medir; elegir)
- [x] 5. Release 0.34.0

## Decisiones tomadas durante el trabajo

- **Lo que detecta la caída es la señal vieja, no `stopped`.** En Windows, cortar el Monitor mata el proceso
  sin que corra su manejador de señales, así que `stopped` no llega a escribirse; la señal envejece y el
  endpoint deja de decir `listening` a los 45 s. `stopped` queda para el cierre normal (la sesión termina).
- **Sin escucha, el diseño del sistema y el pedido de variantes siguen disponibles**: lo que se pide queda en
  cola (decisión 2); antes, el design system se ocultaba sin escucha.
- **Regresión de 0.33.0 arreglada en este ítem** (`ec3651d`): `review_ui` no trataba como pantalla a una
  variante del laboratorio, y en Next perdía el control de estados. La vio la corrida rápida que llegó desde el
  centro durante el trabajo. Un test la cubre en Vite y en Next.

## Registro

- **2026-10-16:** salió de comparar el centro con el mercado; el desarrollador pidió agregarlo (B-044) y
  arrancarlo. Relevado; spec y plan escritos, pendientes de aprobación.
- **2026-10-16:** plan aprobado con las cuatro decisiones recomendadas. Tarea 1 (`17a3d2a`): watcher con señal,
  `listening`, `measure`, `history` y `previous`. Tarea 2 (`a4e7e65`): el centro y el panel, con sus contratos.
  Tarea 3 (`85085ef`): la skill, `live.md` y las docs. 415 tests en verde.
- **2026-10-16 · prueba real** en la app Vite de prueba, con el servidor reiniciado (el endpoint se carga con
  `vite.config`): el centro en verde con la señal; "Volver a medir" llegó como `measure` por el watcher, se
  midió y el estado guardó la historia ("= sin cambios desde el 16/10/2026"); "Elegir esta" en la A mandó
  `choose`, la tarjeta mostró "Elegida" y `/facha-ui:apply orders a`; con el Monitor cortado, a los 40 s el
  endpoint dijo `listening: false` y el centro pasó a ámbar con el aviso; al reactivarlo volvió a verde. Durante
  el trabajo llegó del centro un pedido real de variantes (`orders`, rápido): se preguntó antes de descartar
  las anteriores y se hizo la variante A (0 errores).

- **2026-10-16 · release 0.34.0:** versión en `plugin.json`, `mcp/package.json`, el lockfile y el
  server; CHANGELOG con fecha y enlaces; SPEC §7.44; B-044 a Hecho.

## Cómo retomar

Terminado en 0.34.0. Sin ideas nuevas.
