# Changelog

Todos los cambios de facha-ui que importan a quien usa el plugin. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa
[versionado semántico](https://semver.org/lang/es/). Las referencias (§7.x) apuntan a
[SPEC.md](SPEC.md).

## [Unreleased]

### Added
- Modo rápido de `/facha-ui:variants` (`--rapido`, `--quick`, o "hacelo rápido"): una sola variante, la hipótesis que mejor resuelve el diagnóstico, con las mismas reglas duras, el guardián en 0 errores (hasta 2 intentos) y las citas de fuente; captura de escritorio y sin revisor independiente (§2.b.6).
- `/facha-ui:start`: primer vistazo sin configurar nada. Tu proyecto y su design system en palabras simples, el puntaje de UX, los 3 problemas más graves con su archivo, línea y principio, una sola recomendación de mayor impacto y lo que falta (config, líneas del `.gitignore`, dev server). Solo lee; también se activa con "¿cómo está la UI de mi proyecto?" (§2.e).
- Guardián automático: un hook del plugin chequea cada `.tsx`, `.jsx` o `.css` del proyecto que Claude escribe o edita, sin que lo pidas. Si hay problemas te avisa ("facha-ui ⚠ N problemas en …"), y Claude corrige lo que escribió en ese turno, una sola vez, e informa lo que ya estaba. Calla en el laboratorio, sin design system o con varios proyectos (§2.f).
- `"guard": "off" | "quiet" | "on"` en `facha-ui.config.json` para el guardián automático (por defecto `quiet`).

### Changed
- `start`, `learn` y `help` copian el registro de quien los usa (vos, tú o usted) en lugar de usar siempre el voseo.

### Security
- El guardián automático solo lee: mismo bundle sin escritura, red ni ejecución de código del proyecto; el texto del proyecto que le pasa a Claude va cortado a 200 caracteres y marcado como dato; cualquier error interno es silencio y nunca rompe la edición (§2.f).

## [0.15.0] - 2026-10-10

### Added
- Compatibilidad con shadcn/ui, con Tailwind 3 y 4: se reconoce por `components.json` o por sus pares de tokens `--x` / `--x-foreground` (§7.23).
- Roles de los tokens canónicos de shadcn: `--accent`, `--secondary` y `--muted` como fondos suaves, `--muted-foreground` como texto secundario, `--primary-foreground` como texto sobre la marca (§2.0.2).
- Colores escritos como canales HSL sueltos (`222.2 47.4% 11.2%`, también con alfa), cuando el proyecto los usa como `hsl(var(--x))` o es shadcn: con roles, contraste y sugerencias (§7.23).
- Tailwind 3: el mapeo de `tailwind.config` se lee de forma estática, así que `rounded-md` o `bg-primary` mapeados ya no se marcan; lo que no se puede leer (plugins, presets) se informa con su línea (§7.23).
- Opción `tailwind.mapped` en `facha-ui.config.json` para declarar utilidades mapeadas que no se pueden leer sin ejecutar código (§2.0.2).
- `CHANGELOG.md`: el historial de versiones en un solo lugar.

### Changed
- El README resume el estado en una línea (versión, stacks soportados y enlace a este archivo).

### Fixed
- Los tokens dentro de `@layer` (como `@layer base { :root {…} }`) se leen: un proyecto shadcn con Tailwind 3 ya no da `missing` (§7.23).
- Las clases dentro de `@layer components` se reconocen como clases del proyecto (§7.23).
- Los alias de `@theme inline` (`--color-x: var(--x)`) ya no generan avisos de tema faltante ni casi-duplicados repetidos (§7.23).
- Los radios con `calc()` (`calc(var(--radius) - 2px)`) se leen como radios con su valor en px (§7.23).
- `--primary-foreground` de shadcn ya no aparece como texto ilegible: se mide sobre la marca, no sobre las superficies (§7.23).

### Removed
- `docs/prompts/`: el registro de prompts de desarrollo ya no forma parte del repositorio.

### Security
- `tailwind.config` solo se parsea; nunca se importa ni se ejecuta, y `components.json` y el config se leen sin seguir symlinks ni salir del proyecto (§7.23).

## [0.14.0] - 2026-10-10

### Added
- Principios de UX con id estable (Nielsen, WCAG 2.2 AA, jerarquía, Gestalt, Fitts, Hick, Jakob, estados y escritura de interfaz) en `skills/_shared/ux-principles.md`, con cómo se verifica cada uno (§7.22).
- Diagnóstico UX en `/facha-ui:variants` antes de diseñar: quién usa la pantalla, su tarea y qué le cuesta hoy, con evidencia (§7.22).
- Cada hipótesis, hallazgo de la crítica y decisión cita su principio (`ux:*`); los hallazgos llevan severidad de Nielsen de 0 a 4 (§7.22).
- Revisor independiente `facha-ui:ux-reviewer`: un subagente de solo lectura que revisa las variantes sin conocer su razonamiento (§7.22).
- Nueva fuente de decisión `ux-principle`, que explica el porqué sin reemplazar al token o la clase (§7.22).

### Changed
- `/facha-ui:variants` se dividió en partes (`refine.md`, `live.md`, `lab.md`, `run-state.md`) que se leen en el paso que las usa (§7.22).
- Reglas duras de `variants` más explícitas: alcance de escritura con todo el andamiaje, el navegador solo captura y nunca se aplica nada desde la skill (§7.22).

## [0.13.0] - 2026-10-10

### Added
- Pestaña **Mejorar** en el panel en vivo: ver en escritorio, móvil o tablet, cambiar tema y estado, mejoras con un clic y decidir (§7.21).
- **Pedir que lo arregle** desde la vista Móvil o Tablet, con lo que midió el laboratorio como evidencia (§7.21).
- Las preguntas de Claude Code aparecen arriba del panel, con un botón por opción (la recomendada destacada) y una respuesta libre (§7.21).
- La vista del celular sigue el arreglo pedido hasta medir de nuevo y muestra los problemas de antes y los de ahora (§7.21).
- Los cambios fuera del laboratorio muestran la frase para confirmar en Claude Code, con un botón para copiarla (§7.21).

### Fixed
- La vista previa del celular ya no tapa la página: los resultados van al costado del teléfono (§7.21).
- Los botones del panel se ven siempre; sin modo en vivo aparecen deshabilitados, con el comando para activarlo (§7.21).
- El enlace "Comparar las variantes" del panel tenía bajo contraste (§7.21).

## [0.12.0] - 2026-10-10

### Added
- Puntaje de UX por pantalla (`ux_score`) y modo `score` para CI que falla si una pantalla empeora (§7.20).
- Regresión visual en `/facha-ui:apply`: capturas antes y después, diferencias marcadas y puntaje por categoría (§7.20).
- `/facha-ui:flow` y la tool `review_flow`: revisión de un recorrido entre pantallas, con crítica FL1–FL8 (§7.20).
- Página de comparación de variantes lado a lado, votos del equipo con motivo y un reporte HTML para compartir (§7.20).

### Fixed
- `review_flow` ya no marca los filtros como "formulario sin salida" ni lee comentarios como señales (§7.20).

## [0.11.0] - 2026-10-10

### Added
- La voz del producto en la config (`copy.voice`: vos, tú o usted; `copy.terms`) (§7.19).
- Reglas `copy-*` sobre los textos de la UI: etiquetas vagas, errores sin acción, mayúsculas, términos y tratamiento (§7.19).
- Punto **C10 · Microcopy** en la crítica de las variantes (§7.19).

### Fixed
- El panel de facha-ui tuteaba ("elige") en un producto que usa vos (§7.19).

## [0.10.0] - 2026-10-10

### Added
- Reglas `responsive-*`: anchos fijos, grillas que no colapsan, tablas sin scroll y `100vh` (§7.18).
- Medidor en la página del laboratorio (`?check=responsive`): desborde, ancho útil, elementos recortados, objetivos y textos chicos (§7.18).
- Capturas en celular (375) y tablet (768) y punto **C9 · Responsive** en la crítica (§7.18).
- Vista Móvil y Tablet en el panel en vivo (§7.18).

## [0.9.0] - 2026-10-10

### Added
- Reglas de accesibilidad `a11y-*` en el guardián: `alt`, etiquetas, nombres de botones, teclado, foco visible, objetivos de 24 px y orden de títulos (§7.17).
- Tool `review_ui`: señales de jerarquía y de estados para la crítica (§7.17).
- Crítica senior de cada variante (C1–C8), con un arreglo por hallazgo (§7.17).
- Estados completos en cada variante (cargando, vacío, error, datos extremos, sin permisos), visibles con `?state=` (§7.17).

## [0.8.0] - 2026-10-09

### Added
- `/facha-ui:learn`: curso guiado de 9 lecciones sobre el propio proyecto, de solo lectura (§7.16).

## [0.7.0] - 2026-10-09

### Added
- Modo en vivo (`/facha-ui:variants <slug> live`): un panel en el laboratorio para pedir cambios y verlos aplicados (§7.15).
- Señalar hasta 3 elementos de la página en un pedido (§7.15).
- Pestaña **Paleta**: probar paletas predefinidas o un color propio sobre toda la app, con conflictos y soluciones (§7.15).
- `/facha-ui:init palette`: adoptar una paleta propuesta, con plan y aprobación (§7.15).

### Changed
- README y manifiestos describen a facha-ui como un diseñador de UI senior.

### Security
- El endpoint del panel solo existe en desarrollo y acepta pedidos del mismo origen, en JSON y con el token de la sesión (§7.15).
- `variants` avisa si `.facha-ui/live/` (con el token de la sesión) no está en `.gitignore` (§7.15).

## [0.6.0] - 2026-10-09

### Added
- Ajustar una variante con `/facha-ui:variants <slug> <a|b|c> "<cambio>"`, con historial de revisiones en el run (§7.14).
- Fuente de decisión `request` y "Ajustes pedidos" en la entrada de `decisions.md` que escribe `apply` (§7.14).

## [0.5.0] - 2026-10-09

### Added
- Regla `tailwind-default-scale`: radios, sombras, tamaños de letra, tracking y leading por defecto de Tailwind (§7.13).
- Detección de paleta inflada en `health`: tokens, colores y pasos casi iguales (§7.13).

## [0.4.0] - 2026-10-09

### Added
- Regla `tailwind-palette-color`: colores de la paleta por defecto de Tailwind (§7.12).
- Reglas `custom` del equipo evaluadas: `forbid-token` y `forbid-class` (§7.12).

### Changed
- El schema de la config valida estrictamente cada tipo de regla `custom` y sus regex (§7.12).

## [0.3.0] - 2026-10-09

### Added
- Contraste por uso (`theme-contrast`), por clase (`class-contrast`) y de elementos no textuales (`non-text-contrast`), en cada tema (§7.11).
- Estados que se confunden por color, también con daltonismo simulado (`status-confusable` en `health`) (§7.11).

## [0.2.0] - 2026-10-09

### Added
- `/facha-ui:init`: propone tokens desde los valores que el proyecto ya usa y los agrega con aprobación (§7.10).
- Tool `scan_styles`: inventario de colores escritos a mano y propuesta de tokens por tema (§7.10).
- Descubrimiento del frontend en monorepos (`FACHA_UI_ROOT`, `MULTIPLE_PROJECTS`) (§7.10).

### Fixed
- Las capturas se guardan en `.facha-ui/screenshots/` del proyecto (§7.10).
- Los archivos automáticos de Playwright ya no se mezclan con las capturas (§7.10).

### Security
- `variants`, `apply` e `init` escriben solo con Write y Edit, un archivo por vez, para que se vea cada escritura (§7.10).

## [0.1.0] - 2026-10-09

### Added
- MCP `facha-ui` de solo lectura: `get_design_system`, `check_ui` y `audit_project`, con las reglas `color-literal`, `tailwind-arbitrary-value`, `unknown-token` e `inline-style` (§7.1).
- `/facha-ui:variants`: tres variantes de una pantalla en un laboratorio, validadas por el guardián (§7.1).
- `/facha-ui:apply`: aplica una variante válida con plan, aprobación y registro en `decisions.md` (§7.1).
- `/facha-ui:help`: comandos, tools y archivos del plugin.
- Plugin instalable desde GitHub, con Playwright MCP en versión fija para las capturas (§7.1).
- Guía de uso con imágenes de una demo y licencia MIT.

[Unreleased]: https://github.com/SebaFlockitDev/facha-ui/compare/v0.15.0...HEAD
[0.15.0]: https://github.com/SebaFlockitDev/facha-ui/compare/v0.14.0...v0.15.0
[0.14.0]: https://github.com/SebaFlockitDev/facha-ui/compare/v0.13.0...v0.14.0
[0.13.0]: https://github.com/SebaFlockitDev/facha-ui/compare/v0.12.0...v0.13.0
[0.12.0]: https://github.com/SebaFlockitDev/facha-ui/compare/v0.11.0...v0.12.0
[0.11.0]: https://github.com/SebaFlockitDev/facha-ui/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/SebaFlockitDev/facha-ui/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/SebaFlockitDev/facha-ui/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/SebaFlockitDev/facha-ui/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/SebaFlockitDev/facha-ui/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/SebaFlockitDev/facha-ui/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/SebaFlockitDev/facha-ui/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/SebaFlockitDev/facha-ui/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/SebaFlockitDev/facha-ui/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/SebaFlockitDev/facha-ui/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/SebaFlockitDev/facha-ui/releases/tag/v0.1.0
