# Estudio de herramientas de diseño con IA y de design systems

> **Fecha:** 2026-10-15 · **Dio origen a:** B-024 a B-034 en [BACKLOG.md](../../BACKLOG.md).
> Lo armaron dos investigaciones con búsquedas web. Las cifras y afirmaciones salen de las fuentes
> citadas y **no se verificaron una por una**: cada ítem las confirma en la documentación primaria
> antes de fijar un valor.

## Pregunta

¿Qué hace el mercado cuando alguien no tiene ningún diseño definido, cómo evita el "look genérico de
IA", cómo trabaja sobre un código existente, y qué estándares usan los profesionales para armar un
design system completo? ¿Qué puede adoptar o hacer mejor facha-ui?

## Herramientas que generan UI

| Herramienta | Sin diseño definido | Con un design system existente | Fuente |
|---|---|---|---|
| Google Stitch | La más fuerte: entrevista (objetivos, sensación, inspiración), varias direcciones, extrae un sistema de una URL; formato `DESIGN.md` con la intención de cada regla | — | https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-updates/ , https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-design-md/ |
| Readdy | Tres preguntas (tipo de sitio, estilo, marca) y referencias | — | https://readdy.ai/blog/readdy-ai-gpts-guide-simplifying-website-creation |
| Banani, UX Pilot, Uizard, Visily | Generan temas o sistemas desde texto, capturas o URLs | Importan librerías de Figma | https://www.banani.co/product/ai-design-system-generator , https://uxpilot.ai/ai-design-systems-generator |
| v0 (Vercel) | Sin camino propio: arranca con shadcn por defecto | "Design Systems 2.0": importa repo, npm, Figma o Storybook y no usa nada que no pueda confirmar | https://v0.app/docs/design-systems-2 |
| Lovable | Sacó su panel de temas por poco uso | Importa el sistema y **revisa cada generación** (literales de color, valores sueltos, componentes copiados) y reintenta | https://docs.lovable.dev/features/design-systems |
| Bolt.new | — | Agentes que eligen componentes existentes | https://bolt.new/blog/introducing-design-system-agents |
| Figma Make | Estilos genéricos sin librería | Extracción de tokens incompleta; crea componentes parecidos en lugar de usar los reales | https://help.figma.com/hc/en-us/articles/33024539096471 |
| Builder.io Fusion | — | Indexa el repo (componentes, íconos, tokens) y trabaja en una rama con PR | https://www.builder.io/c/docs/fusion-design-system-intelligence |
| Claude Design (Anthropic) | Prototipos desde un prompt, controles generados al vuelo | Lee el código y los archivos de diseño, y pasa el trabajo a Claude Code | https://www.unite.ai/anthropic-launches-claude-design-for-visual-prototyping-and-presentations/ |
| Skill frontend-design (Anthropic) | Exige un plan antes del código (paleta de 4 a 6 colores, tipografía, layout) y confirmar sujeto, público y tarea | — | https://claude.com/resources/articles/improving-frontend-design-through-skills |

**Patrones:**

- **Proyecto sin diseño:** nadie cubre el camino completo (entrevistar, generar un sistema completo y
  verificarlo).
- **Look genérico de IA:** Anthropic lo explica como "convergencia distribucional". Las defensas son
  instrucciones en el prompt (frontend-design, Impeccable); **nadie lo verifica de forma
  determinística**.
- **Código existente:** todos piden importar el sistema a su plataforma. **Nadie deduce tokens de un
  código desordenado** ni trabaja con los datos reales de la app.
- **Riesgo:** Claude Design se superpone. La diferencia de facha-ui tiene que ser explícita: vive en el
  repo, usa datos reales, verifica sin depender del modelo y no aplica nada sin aprobación.

## Estándares para armar un design system

- **Color:**
  - Radix Colors: escalas de 12 pasos con un uso fijo por paso (fondos, estados, bordes, rellenos,
    texto).
  - Adobe Leonardo: la luminosidad de cada paso se calcula para alcanzar un contraste objetivo.
  - Material Color Utilities: espacio HCT, paletas tonales desde una semilla, niveles de contraste y
    variantes.
  - Tailwind v4: paleta en OKLCH.
  - Fuentes: https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale ,
    https://github.com/adobe/leonardo ,
    https://api.flutter.dev/flutter/package-material_color_utilities_dynamiccolor_dynamic_scheme/DynamicScheme-class.html
- **Método recomendado:**
  1. Llevar el color de marca a OKLCH.
  2. Armar 12 pasos con los roles de Radix, con la luminosidad resuelta por contraste.
  3. Usar neutros del mismo tono con muy poco croma.
  4. Generar claro y oscuro por separado (no invertidos).
  5. Sacar los colores de estado de rangos de tono fijos.
  6. Mapear todo a las variables de shadcn.
  7. Verificar cada par con WCAG 2.2.
- **Contraste:** WCAG 2.2 es la base legal. APCA salió del borrador de WCAG 3 y se usa solo como dato
  orientativo. https://adrianroselli.com/2026/04/wcag3-contrast-as-of-april-2026.html
- **Tipografía y espaciado:**
  - Carbon: un set *productive* (base 14px, apps densas) y uno *expressive* (base 16px, contenido).
  - Material 3: 15 estilos de texto.
  - Utopia: escalas fluidas con chequeo de zoom al 200%.
  - Espaciado en múltiplos de 4 u 8.
  - Fuentes: https://carbondesignsystem.com/elements/typography/type-sets/ , https://utopia.fyi/
- **Elevación:** Atlassian empareja cada superficie con su sombra; en modo oscuro la profundidad se
  marca aclarando la superficie. https://atlassian.design/foundations/elevation
- **Formato de tokens:** W3C DTCG 2025.10 es la primera versión estable.
  https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/
- **Linters:**
  - `ensure-design-token-usage` de Atlassian, con arreglo automático al token más cercano.
  - `no-unnecessary-arbitrary-value` de eslint-plugin-tailwindcss.
  - Figma Design Lint.
  - axe-core, que detecta cerca del 57% de los problemas de WCAG.
- **Evidencia en lugar de gusto:** Baymard (más de 700 guías de e-commerce), Laws of UX, NN/g y
  Mobbin (pantallas reales). Una forma práctica es tomar un design system de referencia por tipo de
  producto y citarlo.

## Qué adoptó facha-ui

| Ítem | Idea | De dónde viene |
|---|---|---|
| B-024 | Brief ya completado desde el código, más pocas preguntas | Stitch, Readdy, frontend-design |
| B-025 | Generador determinístico: OKLCH, escalas por contraste, claro y oscuro por separado | Radix, Leonardo, Material, Tailwind v4 |
| B-026 | Tres direcciones sobre la pantalla real con datos reales, más una página de muestra | Direcciones de Stitch; revisión previa de v0 |
| B-027 | Perfiles por tipo de producto, con fuentes | Carbon, Polaris, Baymard, Utopia |
| B-028 | De referencias (captura o URL) a tokens accesibles | Stitch, Visily, Uizard, Banani |
| B-029 | Reglas determinísticas contra el look genérico de IA | frontend-design, Impeccable (que solo usan el prompt) |
| B-030 | Componente reimplementado y cobertura del sistema | Lovable, Atlassian |
| B-031 | Controles de diseño en el panel en vivo | Claude Design, Realtime Colors, tweakcn, Material |
| B-032 | Matriz completa de contraste (WCAG decide, APCA orienta) | WCAG 2.2, APCA, Radix |
| B-033 | axe-core sobre el laboratorio | axe-core, Storybook |
| B-034 | `DESIGN.md` y DTCG: recibir sistemas de otras herramientas y verificarlos | Stitch, W3C DTCG |
