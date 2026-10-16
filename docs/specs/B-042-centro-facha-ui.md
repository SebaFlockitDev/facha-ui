# B-042 · Centro facha-ui (etapa 1)

> **Estado:** en spec · **Rama:** `feat/center` · **Ítem:** [BACKLOG.md](../../BACKLOG.md) ·
> **Origen:** pedido del desarrollador ("manejar todo esto de manera sencilla, sin memorizar comandos,
> desde una pantalla, con subida de imágenes") · **Última actualización:** 2026-10-16

## Por qué

facha-ui ya se usa con palabras, pero hay que **saber qué pedir**: no se ve de un vistazo qué pantallas
hay, cuáles están peor, qué variantes quedaron abiertas ni qué puede hacer el plugin. Una pantalla
resuelve eso mejor que un chat: reconocer en lugar de recordar (`ux:nielsen-6`), con el estado siempre
a la vista (`ux:nielsen-1`). Los comandos quedan para quien ya los conoce (`ux:nielsen-7`).

## Cómo funciona hoy (relevado el 2026-10-16)

- **El laboratorio** tiene una portada mínima solo en Vite (`LabHome` en `main.tsx`): la lista de
  pantallas con variantes, sin estado ni acciones. En Next no hay portada.
- **El modo en vivo** es por pantalla: `session.json` tiene un `slug`, y el endpoint rechaza pedidos de
  otra pantalla (`live-core.ts:351`). Los pedidos son `change`, `choose`, `palette` y `vote`; el cuerpo
  es JSON de hasta 64 KB (`facha-live-plugin.ts`).
- **Claude escucha** con `live-watch.mjs` (Monitor) mientras dura la sesión.
- **`init` y `apply` solo los arranca el desarrollador** (`disable-model-invocation`): cambian el código,
  y por eso no los dispara la IA. El panel ya muestra una frase para copiar en el chat cuando hace falta
  una confirmación (`ChatConfirm`).

## Plan (propuesto, pendiente de aprobación)

### 1. Una puerta de entrada: la skill `center`

`/facha-ui:center`, o con palabras ("abrí facha-ui", "abrí el centro"):
1. arma el laboratorio si no existe (como `variants`, `lab.md`) y la página del centro;
2. escribe `.facha-ui/live/center.json` con el estado del proyecto, leído con las herramientas de
   siempre: `ux_score` (puntaje, pantallas de peor a mejor con su peor hallazgo y su cobertura),
   `get_design_system` (estado del sistema, salud, resumen de contraste) y las corridas de
   `.facha-ui/runs/`;
3. abre una sesión **para todo el proyecto** (decisión 2) y empieza a escuchar, como el modo en vivo;
4. dice la URL del centro.

### 2. La página del centro

En `<lab.dir>/` (la portada de Vite pasa a ser el centro; en Next, una `page.tsx` nueva). Con los
estilos propios del panel (no usa ni toca el design system del proyecto) y accesible:
- **El estado del proyecto**, en palabras: el puntaje y qué mide, el design system (completo, parcial o
  sin tokens), el contraste y la cobertura, cada uno con su número y una frase.
- **Las pantallas**, de peor a mejor, con su puntaje y su peor problema. Cada una con **"Proponer
  variantes"**: un campo opcional para el objetivo, el modo rápido o completo, y una **zona para
  arrastrar una captura** de referencia (o pegar una URL), que va a `variants --ref` (B-040).
- **Las variantes en curso**: abrir cada una, comparar y votar (los enlaces que ya existen), y el estado
  de cada pedido (en cola, aplicando, listo), como en el panel.
- **El design system**: si no hay, "Crear uno" y "Como esta página" (con la misma zona de captura o una
  URL). Estas acciones usan `init`, que solo arranca el desarrollador: el centro muestra el comando
  exacto para pegar en Claude Code, con un botón de copiar (decisión 4).
- Cuando una acción pide una confirmación (aplicar, cambiar código fuera del laboratorio), el centro
  muestra la frase para el chat, como el panel. Nada se aprueba desde el navegador.

### 3. El endpoint

- **Sesión de proyecto:** con `scope: "project"`, acepta pedidos de cualquier pantalla. El panel de cada
  variante funciona igual dentro de esa sesión.
- **Un pedido nuevo, `run`:** `{ screen, goal?, quick?, reference? }`, validado (la pantalla debe estar en
  `center.json`; textos acotados).
- **Subida de imágenes:** `upload`, solo PNG, JPEG o WebP de hasta 5 MB, comprobados por sus primeros
  bytes y no por el nombre; se guardan en `.facha-ui/references/<fecha>-<n>.<ext>` y el endpoint
  devuelve la ruta. Solo en desarrollo, con las mismas reglas de origen y token del modo en vivo
  (decisión 3).
- `GET` suma el `center.json`.

### 4. Lo que hace Claude con cada pedido

- **`run`:** sigue `variants` (`SKILL.md`, y `reference.md` si trae una referencia) para esa pantalla.
  Al terminar, actualiza `center.json`.
- **Los pedidos del panel** (`change`, `palette`…): como el modo en vivo (`live.md`).
- **`init` y `apply`:** nunca. El centro ya mostró el comando.

### 5. Docs y pruebas

- SPEC (§2.i y §7.42), `docs/uso.md` (un capítulo nuevo al principio: "La forma fácil"), `help`,
  `start` (sugiere abrir el centro al final), CHANGELOG.
- Tests:
  - el endpoint: sesión de proyecto, `run`, `upload` (tipos, bytes, tamaño, nombre, origen, token, 404
    en producción), `center.json` en el `GET`;
  - los contratos de la skill (escucha, nunca `init` ni `apply`, la frase para copiar);
  - el andamiaje copia la página del centro (Next y Vite).
- Prueba real: el centro en la app de Vite, una corrida pedida desde el centro con una captura
  arrastrada, y el comando de `init reference` copiado desde ahí.

## Decisiones para confirmar

1. **Una skill nueva, `center`** (recomendado): `start` sigue siendo un análisis de solo lectura, y el
   centro necesita escribir el laboratorio y escuchar. La alternativa es sumarlo a `start`, que dejaría
   de ser de solo lectura.
2. **Una sesión para todo el proyecto** (recomendado): un solo "abrí facha-ui" sirve para todas las
   pantallas y sus paneles. La alternativa es mantener una sesión por pantalla, que obliga a abrir el
   modo en vivo de cada una.
3. **Subida de imágenes acotada** (recomendado): PNG, JPEG o WebP, hasta 5 MB, comprobados por sus
   bytes, guardados en `.facha-ui/references/`, solo en desarrollo y con origen y token. La alternativa
   es no subir y pedir la ruta del archivo, que es más incómodo.
4. **`init` y `apply` siguen siendo del desarrollador** (recomendado): el centro muestra el comando
   exacto para copiar. La alternativa es dispararlos desde el centro, lo que rompería la regla de que
   lo que cambia el código solo lo arranca quien lo mantiene.

## Fuera de esta etapa (etapa 2, un ítem aparte)

El brief y la creación del design system como formularios en el centro; un historial de decisiones
navegable.

## Criterios de aceptación

- [ ] Con "abrí facha-ui", el centro muestra el estado del proyecto y las pantallas de peor a mejor.
- [ ] Desde el centro se piden variantes de una pantalla, con objetivo y con una captura arrastrada.
- [ ] La subida solo acepta imágenes reales y acotadas, en desarrollo, con origen y token.
- [ ] `init` y `apply` nunca se disparan desde el centro: se muestra el comando.

## Tareas

- [ ] 1. Endpoint: sesión de proyecto, `run`, `upload`, `center.json`; tests
- [ ] 2. La página del centro (Vite y Next) y el andamiaje
- [ ] 3. La skill `center`; contratos
- [ ] 4. Docs (`docs/uso.md`, SPEC, `help`, `start`, CHANGELOG)
- [ ] 5. Prueba real
- [ ] 6. Release

## Decisiones tomadas durante el trabajo

(ninguna todavía)

## Registro

- **2026-10-16:** pedido del desarrollador; agregado al backlog (B-042) con su OK; relevado; spec de la
  etapa 1 escrito y plan presentado, pendiente de aprobación.

## Cómo retomar

Esperar la aprobación del plan y de las cuatro decisiones. Con el OK: "Plan (propuesto…)" pasa a "Plan
aprobado (fecha)", el estado a `en curso`, y se arranca por la tarea 1 en `feat/center`.
