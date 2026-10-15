# B-025 · Generador de design system, desde una marca o desde cero

> **Estado:** en spec · **Rama:** `feat/design-generator` · **Ítem:** [BACKLOG.md](../../BACKLOG.md) ·
> **Origen:** [estudio de herramientas](../research/2026-10-15-herramientas-de-diseno.md) ·
> **Depende de:** B-024 (brief, hecho en 0.20.0) · **Última actualización:** 2026-10-15

## Por qué

Un proyecto sin diseño necesita un sistema completo y accesible, no valores sueltos. Hoy `init`
solo ordena los literales que ya están en el código. Las herramientas profesionales derivan el
sistema con un método (Radix Colors, Adobe Leonardo, Material Color Utilities), no a ojo. facha-ui
puede hacerlo **determinístico y con fuente en cada valor**, que es justo lo que ninguna herramienta
de IA ofrece (ver el estudio).

## Plan (propuesto, pendiente de aprobación)

### 1. Tool `propose_design_system` (MCP, solo lectura, sin red)

**Entrada** (todo opcional; lo que falta sale del brief, y si no, de un valor por defecto con
fuente): color de marca, densidad, modo oscuro, nivel de accesibilidad (AA o AAA), radio base y
cantidad de semillas cuando no hay marca. La salida dice de dónde salió cada entrada (argumento,
línea del brief o valor por defecto).

**Salida:**
- escalas de 12 pasos para acento, neutro, éxito, advertencia, peligro e información, en claro y
  oscuro, en OKLCH y hex;
- roles → tokens: superficies, textos, bordes (incluido el de controles y el anillo de foco),
  acento, texto sobre acento y estados (texto, fondo, borde, sólido); con los nombres de shadcn si
  el proyecto usa shadcn, o con nombres que facha-ui reconoce por rol;
- tipografía (familia, tamaño base, escala de 7 pasos, interlineados, pesos), espaciado (base 4px y
  altura de controles), radios y 3 sombras;
- **prueba de contraste**: cada par texto/fondo y cada borde de control, en los dos modos, con su
  razón y si pasa;
- ajustes (si el color de marca tuvo que moverse, cuánto y por qué) y conflictos con su solución;
- los bloques CSS listos por tema, y la lista de fuentes de cada regla.

### 2. Método de color

1. **Marca → OKLCH.** El paso 9 (sólido) es el color de marca, si cumple: texto sobre él ≥ 4.5:1
   (WCAG 1.4.3) y él contra el fondo ≥ 3:1 (WCAG 1.4.11). Si no, se busca la luminosidad más
   cercana que cumpla y se informa el ajuste.
2. **Cada otro paso** tiene la luminosidad que alcanza un **contraste objetivo contra el fondo**
   (como Leonardo) y un croma proporcional al de la marca, recortado al gamut sRGB. Los contrastes
   objetivo y las proporciones de croma por paso se **miden de las escalas publicadas de Radix
   Colors** (licencia MIT), en claro y en oscuro, y quedan en un archivo de constantes con su fuente
   y un test que las vuelve a medir.
3. **Neutros teñidos** con el tono de la marca y el croma bajo de los grises de Radix.
4. **Estados** con los tonos de Radix (verde, ámbar, rojo, azul). Si la marca se confunde con un
   estado (la medida `status-confusable` que ya usa facha-ui), se informa con su solución
   (etiqueta de texto e ícono, `ux:wcag-1.4.1`).
5. **Oscuro generado aparte**, con los objetivos medidos de las escalas oscuras de Radix; no se
   invierte el claro.
6. **Sin color de marca:** de 3 a 5 semillas tomadas de los acentos de Radix que no se confunden
   con los estados, separadas en tono. Cada semilla es un sistema completo (B-026 las mostrará sobre
   la pantalla real).
7. **Umbrales:** con AA, texto ≥ 4.5:1 y no texto ≥ 3:1; con AAA, texto ≥ 7:1 (WCAG 1.4.6).

### 3. Tipografía, espacio, radio y sombra (cada valor con fuente, a verificar en la tarea 1)

| Qué | Regla | Fuente |
|---|---|---|
| Tamaño base | compacta 14px; equilibrada y aireada 16px | Carbon *productive* / *expressive*; Material 3 body |
| Escala | razón 1.125 / 1.2 / 1.25 según la densidad, 7 pasos, nunca < 12px | Utopia, escala modular; regla de texto chico de facha-ui |
| Interlineado | texto 1.5; títulos 1.25 | WCAG 1.4.8; Material 3 |
| Familia | la del brief; si no hay, la pila del sistema (facha-ui no instala dependencias) | regla de `init` |
| Espaciado | base 4px | Material (grilla de 4dp), Carbon (2/4/8) |
| Altura de controles | 32 / 40 / 48px según la densidad, objetivos ≥ 24px | Carbon (sm/md/lg), WCAG 2.5.8 |
| Radios | base 8px; escala base/2, base, 1.5×, 2×, completo | Material 3 (forma *small*) |
| Sombras | 3 niveles tomados de Fluent 2, con el tono del neutro | Fluent 2 (*shadow ramps*) |

### 4. Modo `/facha-ui:init system`

`skills/init/system.md` (nuevo): con brief y sin tokens, llama a la tool, muestra el sistema
(escalas, roles, prueba de contraste, tipografía, espacio, radios, sombras, ajustes, conflictos) y
**exactamente** qué escribe; con la aprobación y el motivo:
- agrega los bloques al archivo de tokens o, si no hay, al CSS global que carga la app;
- en Tailwind 4 agrega el mapeo `@theme inline` (convención de shadcn); en Tailwind 3 muestra el
  mapeo para que lo agregue el dev (`init` no edita `tailwind.config`);
- modo oscuro "sí" → bloque `.dark`; "más adelante" o "no" → solo claro, y el oscuro queda en
  `.facha-ui/proposals/system-<fecha>.json`;
- valida con `get_design_system` (`status: ok`) y registra `dec-<fecha>-system`.

Solo para proyectos sin tokens (`status: missing`); con tokens, el camino sigue siendo
`/facha-ui:init colors` o `palette`. Los literales de las pantallas no se migran (cambiaría el
diseño): el siguiente paso es `/facha-ui:variants`.

`SKILL.md` de `init` (en 250 líneas: hay que compactar), `start` y `brief.md` (con brief y sin
tokens, el siguiente paso pasa a ser `/facha-ui:init system`), `help`, contratos en
`plugin.test.ts`.

### 5. Decisiones a confirmar

1. **Incluir la escritura (`/facha-ui:init system`) en este ítem.** Recomendado: sin ella el
   generador no se puede usar hasta B-026. B-026 suma ver las direcciones en la pantalla real antes
   de escribir.
2. **APCA pasa a B-032.** No encontré una biblioteca con licencia clara, y WCAG 2.2 decide igual.
3. **Selector oscuro `.dark`** cuando no existe ninguno: el laboratorio lo puede forzar y es la
   convención de Tailwind y shadcn; con `@media` no se puede forzar (`lab.md`).
4. **Semillas sin marca desde los acentos de Radix**, no desde la personalidad: no hay una fuente
   que asigne adjetivos a tonos. La personalidad sí guía la elección del dev en B-026.

**Fuera de alcance:** las direcciones en la pantalla real (B-026), los perfiles por tipo de producto
más allá de la densidad (B-027), los controles del panel (B-031) y la migración de literales.

## Criterios de aceptación

- [ ] Todo par texto/fondo pasa WCAG 2.2 AA en los dos modos (AAA si el brief lo pide), con test
  sobre varias marcas (fría, cálida, clara, oscura, saturada, apagada) y sin marca.
- [ ] La misma entrada da la misma salida.
- [ ] Sin red ni ejecución de código (S2), con test de imports.
- [ ] Cada valor dice de qué regla y fuente sale; un test controla que ninguna constante quede sin
  fuente.
- [ ] Los tokens generados, leídos por facha-ui, dan los roles esperados y `status: ok` (ida y
  vuelta).
- [ ] La marca se conserva o el ajuste se informa; un conflicto con un estado se informa con su
  solución.
- [ ] `/facha-ui:init system` escribe solo con aprobación, y solo los bloques mostrados.

## Fuentes a verificar (tarea 1)

Antes de fijar cualquier constante se confirma en la documentación primaria y se anota acá con su
URL: escalas claras y oscuras de Radix Colors (contrastes y croma medidos), tamaños de Carbon
(*type sets* y *field sizes*), forma y tipografía de Material 3, sombras de Fluent 2, criterios WCAG
1.4.3, 1.4.6, 1.4.8, 1.4.11 y 2.5.8.

## Tareas

- [ ] 1. Verificar las fuentes; fixture con las escalas de Radix y test que mide las constantes
- [ ] 2. `mcp/src/standards.ts` (constantes con fuente) y `mcp/src/generate.ts` (escalas, roles,
  tipografía, espacio, radios, sombras, CSS), con tests
- [ ] 3. Tool `propose_design_system` (`server.ts`, descripción también en SPEC §2.a.3), tests por el
  MCP y de imports, bundle
- [ ] 4. `skills/init/system.md`, `init`, `start`, `brief.md`, `help` y contratos
- [ ] 5. Docs: SPEC §2.h y §7.31, `docs/uso.md`, `CHANGELOG.md`
- [ ] 6. Prueba real en `facha-ui-pruebas/vite-sin-diseno` (brief de B-024): generar, escribir,
  `status: ok`, contraste y `check_ui`
- [ ] 7. Release

## Decisiones tomadas durante el trabajo

(ninguna todavía)

## Registro

- **2026-10-15:** spec escrito; plan presentado, pendiente de aprobación. Al revisar el panel en vivo
  apareció que sus paletas predefinidas traen afirmaciones sin fuente ("El más usado en bancos y
  fintech", `lab-panel.tsx:196`): anotado como B-036 en Ideas.

## Cómo retomar

Esperar la aprobación del plan (sección 5: cuatro decisiones). Con el OK, el título "Plan
(propuesto…)" pasa a "Plan aprobado (fecha)", el estado a `en curso` y se arranca por la tarea 1.
