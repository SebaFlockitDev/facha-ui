<!--
  Prompt 13 · Consolidación: el rol de experto UX/UI en archivos versionados
  Fecha: 2026-10-10 · Autor: Seba Adrover
  Resultado: CLAUDE.md, skills/_shared/ux-principles.md, diagnóstico UX y revisor independiente en variants, agents/ux-reviewer.md, variants/SKILL.md en 250 líneas con sus partes, sin color de marca real, prompts 04 a 13 (SPEC §7.22)
  Commits: 34410e0, ebb0d11, 6e1493f y los de prompts y release
  Origen: texto original. Se reemplazó el nombre de la empresa por un marcador. Pedía "0.9.0"; como ese número ya existía, el plan aprobado lo publicó como 0.14.0.
-->

Vamos a hacer la versión 0.9.0 de facha-ui: una versión de CONSOLIDACIÓN, sin
features nuevas. Objetivo: que el plugin actúe de verdad como un diseñador
UX/UI senior, de forma que no dependa de la memoria de la conversación sino de
archivos versionados. Trabajamos con SDD: primero mostrame el plan (archivos a
crear o modificar, con un resumen de cada uno) y esperá mi aprobación.

## 1. El rol de experto UX/UI, codificado en archivos

a) CLAUDE.md en la raíz del repo (para quien desarrolla facha-ui):
   - Rol: "Desarrollás facha-ui pensando como un diseñador UX/UI senior y como
     un ingeniero que valida con evidencia".
   - Toda decisión de UI que tome el plugin se justifica con una fuente:
     principio de UX, criterio WCAG, token, clase, regla o decisión previa.
     Sin fuente, no va.
   - Reglas de trabajo: SDD, commits chicos y convencionales, rehacer el
     bundle con cada cambio en mcp/src, no hardcodear nada de proyectos de
     prueba, guardar cada prompt en docs/prompts/.
   - Al empezar cada tarea, releer CLAUDE.md y SPEC.md.

b) skills/_shared/ux-principles.md (referencia común de las skills):
   - Las 10 heurísticas de Nielsen; WCAG 2.2 AA relevantes (1.4.3 y 1.4.11
     contraste, 2.4.7 foco visible, 2.5.8 tamaño de objetivo, 3.3.2 labels,
     1.4.1 no depender solo del color); jerarquía visual; Gestalt
     (proximidad, similitud, región común); Fitts, Hick y Jakob; estados
     vacío, carga y error; escritura de interfaz (verbos en botones,
     mensajes de error accionables).
   - Cada principio con un id estable (p. ej. ux:nielsen-1, ux:wcag-2.5.8),
     qué es, cómo se ve violado en una UI real y cómo se verifica (por el
     guardián, por la captura o por revisión).
   - Indicar cuáles ya verifica el guardián y cuáles no.

c) skills/variants: método de un profesional, antes y después de diseñar.
   - Diagnóstico previo: quién usa la pantalla, cuál es su tarea principal,
     qué le cuesta hoy, citando ids de ux-principles.md.
   - Cada variante: hipótesis de UX explícita + principios que la sostienen.
   - Cubrir estados vacío, carga y error, no solo el caso feliz.
   - Nuevo tipo de fuente en las citas: "ux-principle", con el id.

d) agents/ux-reviewer.md: subagente crítico del plugin.
   - Solo lectura: Read, Glob, Grep, get_design_system y check_ui. Nada de
     Write, Edit ni Bash.
   - Recibe solo las variantes, las capturas (si hay) y ux-principles.md; no
     el razonamiento con que se generaron.
   - Devuelve por variante: hallazgos con severidad (escala de Nielsen 0–4),
     id del principio violado y evidencia (archivo:línea o captura), más una
     recomendación final.
   - variants lo invoca antes de presentar y muestra su revisión junto a las
     variantes. Verificá primero cómo se nombran e invocan los subagentes de
     un plugin en la versión de Claude Code que tenemos, y anotalo en el SPEC.

e) SPEC §6 (roadmap, sin implementar): reglas UX verificables para el
   guardián: objetivo táctil menor a 24px, input sin label, salto de nivel
   de encabezado, outline:none sin foco alternativo.

## 2. Achicar skills/variants/SKILL.md (hoy 529 líneas)

- Dejar en SKILL.md solo el flujo principal de un run nuevo, las reglas
  duras y el método UX. Objetivo: 250 líneas o menos.
- Mover el refinamiento y el modo en vivo a skills/variants/refine.md y
  skills/variants/live.md, que la skill lee solo cuando se usa ese modo.
- No perder ninguna regla dura al moverla: hacé una tabla de "dónde quedó
  cada regla" y mostrámela en el plan.
- Revisar con el mismo criterio apply, init y learn si superan 250 líneas.

## 3. Quitar el color de marca de `<empresa>`

- skills/variants/SKILL.md:499 tiene "<color de marca>" en un ejemplo: reemplazalo
  por un valor neutro, y revisá que no haya otros valores o nombres de
  proyectos reales en skills/ ni en mcp/src.

## 4. Trazabilidad de prompts

- docs/prompts/ llega hasta el 03. Reconstruí 04 a 0N (apply, init, live,
  learn y los releases intermedios) a partir del historial de git y el
  SPEC. Marcá cada uno como "reconstruido a partir del historial", para no
  presentarlos como el prompt original.
- Guardá este prompt como el siguiente número.

## Verificación (tests nuevos en mcp/test/plugin.test.ts)
- Que exista agents/ux-reviewer.md y que no declare herramientas de
  escritura.
- Que variants/SKILL.md tenga 250 líneas o menos y referencie
  ux-principles.md, refine.md y live.md.
- Que cada id ux:* citado en las skills exista en ux-principles.md.
- npm test, typecheck y claude plugin validate . en verde; bundle rehecho.

## Release
- Versión 0.9.0 en plugin.json y mcp/package.json, README (estado) y SPEC
  §7.15 con lo hecho.
- Commits chicos por punto (1 a 4), con el bloque de comandos git listo
  para pegar al final.

---

Aprobado el plan, con estas respuestas:
1. 0.14.0.
2. Sí, separá también lab.md y run-state.md. Condición: cada archivo se
   referencia como instrucción explícita en el paso donde se usa ("antes del
   paso N, leé X"), no como mención al final. Agregá al test que cada archivo
   referenciado exista y que cada uno esté referenciado desde un paso concreto.
3. Prompts originales donde existan, con las referencias al proyecto de prueba
   reemplazadas por marcadores; "reconstruido" solo donde no hay texto.

Además:
- El usuario de GitHub (SebaFlockitDev) queda como está.
- Push al final, solo cuando test, typecheck, build y plugin validate estén en
  verde. Dejame el bloque de comandos con el push incluido.
- Cortá el modo en vivo ahora; si lo necesito lo vuelvo a levantar.
- El cambio de etiquetas de la app de prueba lo vemos después de este release.

Arrancá por el commit 1.

---

sí, seguí con el commit 2

---

sí, seguí con el commit 3 y el 4
