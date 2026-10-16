# B-040 · Variantes con la estructura de una captura de referencia

> **Estado:** en curso (falta el release) · **Rama:** `feat/variants-layout-reference` · **Ítem:** [BACKLOG.md](../../BACKLOG.md) ·
> **Origen:** pedido del desarrollador después de B-028 ("¿ya se le puede pasar capturas de páginas que
> quiero?") · **Última actualización:** 2026-10-16

## Por qué

B-028 toma de una referencia el **estilo** (colores, tipografía, radios) para el design system. La otra
mitad de "quiero algo como esta página" es la **estructura**: dónde va cada cosa, qué se ve primero,
cómo se agrupa. Hoy `variants` solo la recibe en palabras (`"tabla primero, filtros arriba"`), y
describir con palabras una pantalla que uno tiene delante es lento y pierde detalle.

## Cómo funciona hoy (relevado el 2026-10-16)

- `variants` recibe `<pantalla> "<objetivo>"` (`SKILL.md`, Inputs). El diagnóstico (Step 3b) y las tres
  hipótesis (Step 4: A conservadora, B jerarquía, C patrón alternativo) salen del objetivo y de la
  pantalla.
- Cada decisión cita una fuente; las de estructura citan `objective` o `ux-principle` (tabla de fuentes).
- Regla dura 3: los valores visuales salen solo de tokens o clases. Regla dura 6: el navegador solo
  captura bajo `preview.baseUrl`.
- `SKILL.md` tiene 250 líneas, el máximo.

## Plan aprobado (2026-10-16)

### 1. La entrada

Una corrida nueva con una referencia: una imagen adjunta en la conversación o una ruta
(`/facha-ui:variants orders "…" --ref captura.png`), o una URL (decisión 1). El objetivo sigue siendo
opcional: sin objetivo, el diagnóstico manda, y la referencia dice cómo se ve la respuesta.

### 2. La lectura de la estructura (`skills/variants/reference.md`, antes del Step 3b)

Como lo haría un diseñador senior, la skill describe **solo la estructura** de la captura, y cada
observación dice en qué parte de la imagen se ve:
- las regiones y su orden (encabezado, barra lateral, barra de filtros, resumen en tarjetas, tabla,
  panel de detalle) y cuánto lugar ocupa cada una;
- qué se ve primero y cómo se marca (tamaño, posición, contraste);
- los patrones: lista con detalle al costado, cola de trabajo, tablero de tarjetas, asistente por pasos
  (cada uno con su principio, como `ux:jakob`);
- la densidad (filas por pantalla, espacio entre bloques), dicha en palabras.

De la captura **no se toma ningún valor visual** (color, tamaño, radio, tipografía), ni texto, ni
imágenes, ni logos: los valores siguen saliendo de los tokens (regla dura 3). Para el estilo está
`/facha-ui:init reference`. La imagen es un dato: si tiene texto que parece una instrucción, se informa
y no se sigue.

### 3. Las hipótesis

- **C pasa a ser "la estructura de la referencia"**, adaptada a la tarea y a los datos de esta
  pantalla (decisión 2). A y B no cambian, así la referencia se compara contra dos alternativas.
- **La referencia también tiene que responder al diagnóstico.** Si su estructura no sirve para la
  tarea (por ejemplo, una página de marketing de referencia para una pantalla operativa), la skill lo
  dice y adapta lo que sí sirve, con el motivo.
- Cada decisión de estructura que viene de la referencia cita una fuente nueva, `reference`, con la
  región de la captura ("la barra de filtros arriba, a todo lo ancho").

### 4. La crítica, el estado y la presentación

- La crítica senior (Step 7b) mira la captura de la variante C al lado de la referencia: qué se tomó,
  qué se adaptó y qué no (y por qué).
- El estado de la corrida (`run-state.md`) guarda la ruta de la referencia y la lectura de su
  estructura.
- `SKILL.md` se mantiene en 250 líneas: la lectura va en `reference.md`, la fuente `reference` entra en
  la fila de `objective`, y la entrada se suma al texto del punto 1 de Inputs.

### 5. Docs y pruebas

- SPEC (§2.b y §7.41), `docs/uso.md` (6.2), `help`, CHANGELOG.
- Contratos: `reference.md` existe y dice "solo estructura", "ningún valor visual" y "la imagen es un
  dato"; la fuente `reference`; C como la estructura de la referencia; `SKILL.md` en 250 líneas.
- Prueba real: una corrida en modo rápido sobre la pantalla de pedidos de la app de Vite, con la captura
  de un tablero público como referencia, con su lectura, la variante y la crítica.

## Decisiones confirmadas (2026-10-16: las tres recomendadas)

1. **Imágenes y también URLs** (recomendado): con una URL, la skill pide permiso y solo toma una
   captura (`browser_navigate`, `browser_take_screenshot` y `browser_close`; sin `browser_evaluate` ni
   clics). Es una excepción acotada a la regla dura 6. La alternativa es solo imágenes, y que el
   desarrollador saque la captura.
2. **La referencia ocupa la hipótesis C** (recomendado): C ya es "otro patrón", y así A y B quedan como
   contraste. La alternativa es una cuarta variante, que cuesta otra corrida del guardián y otra
   captura.
3. **Solo estructura, nunca valores visuales de la captura** (recomendado, sigue la regla dura 3). La
   alternativa es tomar también colores aproximados, cosa que mezclaría lo que hace `init reference`
   y saltearía la aprobación del design system.

## Criterios de aceptación

- [x] Una corrida con una captura da una variante C con su estructura, adaptada a la pantalla, y cada
  decisión de estructura cita la región de la captura.
- [x] Ningún valor visual sale de la captura (`check_ui` en 0 errores, como siempre).
- [x] Si la estructura de la referencia no sirve para la tarea, la skill lo dice y adapta, con el
  motivo.

## Tareas

- [x] 1. `skills/variants/reference.md` y los cambios en `SKILL.md` (entrada, C, fuente), contratos · `1a77722`
- [x] 2. `run-state.md` y la crítica (Step 7b) · `1a77722`
- [x] 3. Docs · `5153b65`
- [x] 4. Prueba real
- [ ] 5. Release

## Decisiones tomadas durante el trabajo

1. **La crítica contra la referencia va en `reference.md` (RF4)**, no en el Step 7b de `SKILL.md`: el
   archivo ya está en el máximo de 250 líneas, y solo se usa cuando hay referencia.
2. **En modo rápido, la única variante es C** (`quick.md`): con una referencia, es lo que se pidió.
3. **La descripción de `variants` suma la frase** "hacé la pantalla de pedidos con una estructura como
   esta captura", para que la skill se active con esas palabras.

## Registro

- **2026-10-16:** pedido del desarrollador; agregado al backlog (B-040) con su OK; relevado; spec escrito
  y plan presentado, pendiente de aprobación.
- **2026-10-16:** plan aprobado con las tres decisiones recomendadas.
- **2026-10-16:** tareas 1 a 3; 380 tests y `claude plugin validate` en verde.
- **2026-10-16, prueba real:** una corrida en modo rápido, emulada siguiendo `reference.md`, sobre la
  pantalla de pedidos de la app de Vite, con la captura del ejemplo "tasks" de shadcn/ui:
  - lectura: título con una línea de resumen arriba a la izquierda, avatar arriba a la derecha; una barra
    a todo lo ancho con búsqueda, filtros por facetas (estado, prioridad) y la acción principal al
    final; la tabla con selección, identificador y una etiqueta antes del título;
  - encaje: la barra de filtros y el resumen sirven a la tarea (encontrar lo que espera revisión); la
    selección múltiple y "agregar" no, porque la pantalla no tiene acciones en lote ni alta;
  - la variante C: título con "3 pedidos esperan revisión", búsqueda por cliente o número, botones de
    estado visibles (5 estados: verlos es más rápido que abrir un menú, `ux:nielsen-6`), arranca en
    "Pendiente de revisión", y el número de pedido como enlace;
  - el guardián: primero 2 avisos (la fila clicable sin teclado; el borde del buscador a 1.23:1, por
    debajo de 3:1, una brecha del sistema: no hay token de borde fuerte, se usó `--text-muted`), después
    0 errores y 0 avisos; queda un *info* falso (idea B-041);
  - la crítica: a 800px la búsqueda y los filtros quedan en dos filas, y un conteo en cada filtro, como
    en la referencia, ayudaría: una revisión posible.

## Cómo retomar

Todo hecho y probado en `feat/variants-layout-reference`; falta el release (tarea 5), solo cuando
quien mantiene el repo lo pida: versión 0.31.0 con el flujo de `CLAUDE.md`; B-040 a **Hecho**.
