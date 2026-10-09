<!--
  Prompt 03 · T2: skill variants
  Fecha: 2026-10-09 · Autor: Seba Adrover
  Resultado: skills/variants + laboratorio de una pantalla del proyecto de prueba
  El texto de abajo es el prompt original. Solo se reemplazaron las referencias al proyecto de prueba (privado) por marcadores genéricos.
-->

Aprobado T0 y T1, excelente. Aprobada también la decisión de §7.5
(text-[var(--token)] = info). Ya traje los commits del bundle.

Seguí con T2 (skill variants). Ajustes:
- Ahora sí podés escribir en `<proyecto de prueba>` (rama de laboratorio), pero SOLO:
  frontend/facha-ui.config.json (usá el del Anexo B), frontend/app/lab/** y
  frontend/.facha-ui/**. Nada más. El .gitignore ya lo actualicé yo.
- Caso de demo: /facha-ui:variants /<pantalla> "que se vea primero lo que espera
  revisión". Es ideal porque toca la brecha del estado "pendiente de revisión": la skill tiene
  que avisarla antes de generar.
- El backend y el front están levantados en localhost:3000; el login lo hago yo
  (preview.auth manual).
- Si Playwright MCP no puede abrir el navegador o llegar a localhost desde tu
  entorno, no insistas más de 2 intentos: dejá las variantes generadas y
  validadas con check_ui, y avisame para tomar las capturas a mano.
- Commit al terminar T2. Mostrame el resumen de las 3 variantes (hipótesis,
  intentos del guardián, decisiones con fuente) antes de pasar a T3.
- Guardá este prompt en docs/prompts/03-variants.md.
