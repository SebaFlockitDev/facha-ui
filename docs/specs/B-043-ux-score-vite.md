# B-043 · `ux_score` con pantallas de Vite

> **Estado:** en curso (falta el release) · **Rama:** `feat/ux-score-vite` · **Ítem:** [BACKLOG.md](../../BACKLOG.md) ·
> **Origen:** prueba real de B-042 (el centro de una app Vite salía sin pantallas) · **Última actualización:** 2026-10-16

## Por qué

`ux_score` y `review_ui` reconocen una pantalla solo por su nombre de Next (`page.tsx`). En una app
Vite, `ux_score` devuelve `screens: []` aun pasándole el archivo, así que:

- el centro (B-042) muestra las pantallas sin puntaje y no puede ordenarlas de peor a mejor;
- el puntaje de CI (`facha-ui-mcp score --baseline`) no protege nada en Vite: siempre "0 pantallas";
- `review_ui` no aplica a las pantallas de Vite sus controles de pantalla (que tengan título y que
  muestren los estados de carga, vacío y error, `ux:states`).

Vite es uno de los dos frameworks de laboratorio soportados (SPEC §2.b.4).

## Cómo funciona hoy (relevado el 2026-10-16)

- `mcp/src/score.ts:23`: `SCREEN = /(^|\/)page\.[jt]sx$/`, en el listado de todo el proyecto y también
  en el archivo o la carpeta que se pasa.
- `mcp/src/review.ts:27`: el mismo patrón (`SCREEN_FILE`) decide los controles de pantalla (líneas 152-203).
- El fixture `mcp/test/fixtures/vite-react` tiene `src/pages/Orders.tsx`, que `App.tsx` monta con
  `<Route path="/orders" element={<Orders />} />` (React Router).

## Plan aprobado (2026-10-16, con las cuatro decisiones recomendadas)

| Archivo | Cambio |
|---|---|
| `mcp/src/screens.ts` (nuevo) | Qué es una pantalla. Next: `page.[jt]sx` (sin cambios). Vite: (1) los componentes que monta el router, leídos sin ejecutar: `<Route element={<X />}>`, `{ element: <X /> }` y `Component: X` de `createBrowserRouter`, y `lazy(() => import("./…"))`, resueltos por sus imports; con su ruta (`path`) cuando está escrita; (2) los archivos de `src/pages/`, `src/routes/`, `src/views/` y `src/screens/`, menos los de prefijo `_`, tests y stories. La config `screens` (globs) reemplaza a las dos. Un archivo pasado explícitamente siempre es una pantalla. Funciones `screenFiles(ctx)`, `isScreen(ctx, rel)` y `routeOf(ctx, rel)`. |
| `mcp/src/config.ts` | Opción `screens?: string[]` (globs relativos a la raíz), documentada. |
| `mcp/src/score.ts` | Usa `screenFiles` / `isScreen`; cada pantalla suma `route` cuando se conoce. |
| `mcp/src/review.ts` | `isScreen` en lugar de `SCREEN_FILE`. |
| `mcp/test/fixtures/vite-router/` (nuevo) | App Vite con `createBrowserRouter`, una pantalla `lazy`, una en `src/views/`, un componente en `src/components/` (no es pantalla) y un `src/pages/_layout.tsx` (tampoco). |
| `mcp/test/screens.test.ts` (nuevo) | Detección en los dos fixtures de Vite, en Next sin cambios, el archivo explícito, la config `screens`, las rutas; `ux_score` y el modo `score` de CI con pantallas en Vite; `review_ui` con controles de pantalla en Vite. |
| `skills/center/SKILL.md` | C3 vuelve a usar solo `ux_score` (se quita el plan B de B-042) y toma `route` de ahí. |
| Docs | `docs/uso.md` (la opción `screens`), SPEC (§ de `ux_score` y §7.43), CHANGELOG (Unreleased), BACKLOG. |
| `mcp/dist/facha-ui-mcp.js` | Rehecho. |

## Decisiones (recomendación en negrita)

1. **Qué cuenta como pantalla en Vite.**
   - **A (recomendada):** lo que monta el router, más las carpetas por convención; la config `screens`
     reemplaza a las dos. El router es la fuente real de qué es una pantalla. Las carpetas cubren las
     apps cuyo router no se puede leer sin ejecutar.
   - B: solo carpetas por convención. Es más simple, pero pierde las pantallas que viven en
     `src/features/x/XPage.tsx`.
   - C: solo la config. Es exacta, pero obliga a configurar, y el plugin promete funcionar sin
     configuración (`start`).
2. **Un archivo pasado explícitamente.** **Siempre cuenta como pantalla**, en cualquier framework. Hoy
   en Next, pasar un componente da `screens: []`, que confunde.
3. **`review_ui` comparte la misma noción.** **Sí**: el título y los estados se piden también a las
   pantallas de Vite. Esto puede bajar el puntaje de esas pantallas la primera vez; va en el CHANGELOG
   ("ahora se miden").
4. **Next** queda igual.

## Fuera de este ítem

- Routers basados en archivos de TanStack Router o de Remix: cubiertos por la carpeta `src/routes/`, sin
  leer su configuración (B-017).

## Criterios de aceptación

- [x] En una app Vite, `ux_score` sin argumentos mide las pantallas que monta el router y las de las carpetas por convención, con su ruta cuando está escrita.
- [x] Un archivo pasado a `ux_score` siempre se mide.
- [x] El modo `score` de CI falla cuando baja una pantalla de Vite.
- [x] `review_ui` aplica sus controles de pantalla en Vite.
- [x] Next no cambia: las mismas pantallas y los mismos puntajes (suma `route`).

## Tareas

- [x] 1. `screens.ts` y la config `screens`; tests
- [x] 2. `ux_score` y `review_ui` con la noción nueva; fixture `vite-router`; tests
- [x] 3. El centro (C3) y las docs
- [x] 4. Prueba real (el centro de la app Vite de prueba, con puntajes)
- [ ] 5. Release

## Decisiones tomadas durante el trabajo

- **`route` también en Next**, desde las carpetas (`app/(grupo)/orders/page.tsx` → `/orders`; los grupos y los
  slots `@x` no cuentan). El campo es nuevo y no cambia ningún puntaje; el centro lo usa en los dos frameworks.
- **Rutas de layout:** un objeto de ruta con `children` o un `<Route>` que no se cierra solo envuelve otras rutas
  y no es una pantalla (el `Shell` del fixture aparecía como pantalla en `/`).
- **La ruta más específica gana:** una pantalla montada en `/` y en `/orders` queda con `/orders`. Una ruta
  relativa (hija de otra) o un `index` quedan con `route: null`: componer rutas anidadas queda afuera.
- **Tareas 1 y 2 en un commit:** `screens.ts` sin `ux_score` no tenía uso ni forma de probarse de punta a punta.
- **La 0.32.0 salió con el frontmatter de `center` roto** (`: ` dentro de la descripción sin comillas): la skill
  cargaba sin descripción y "abrí facha-ui" no la abría. Lo encontró `claude plugin validate` al verificar
  este ítem; la verificación anterior miraba solo su última línea. Arreglado en `fix/center-frontmatter`
  (`eba5279`, mergeado acá) con un test que parsea el frontmatter de cada skill y del agente.

## Registro

- **2026-10-16:** visto en la prueba de B-042 y anotado como idea; el desarrollador pidió arrancarlo.
  Relevado; spec y plan escritos, pendientes de aprobación.
- **2026-10-16:** plan aprobado con las cuatro decisiones recomendadas. Tareas 1 y 2 (`1cba4dc`): `screens.ts`, la
  config `screens`, `ux_score` y `review_ui`, el fixture `vite-router` y 9 tests. Tarea 3 (`9011aab`): el
  centro toma sus pantallas solo de `ux_score`; SPEC §7.43, uso, CHANGELOG y la descripción de la herramienta.
  406 tests en verde.
- **2026-10-16 · prueba real:** `ux_score` sobre las tres apps Vite de prueba: `src/pages/Orders.tsx` en `/orders`
  con 98, 98 y 95 (antes, `screens: []`). El centro abierto en la primera mostró el 98 sin recargar.

## Cómo retomar

En `feat/ux-score-vite`, tareas 1 a 4 hechas. Falta la 5 (release 0.33.0, que lleva también el arreglo de `center`), solo cuando el desarrollador lo pida.
