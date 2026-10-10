<!--
  Prompt 04 · T3: skill apply
  Fecha: 2026-10-09 · Autor: Seba Adrover
  Resultado: skills/apply (plan exacto, aprobación con motivo, aplicar una variante válida, limpiar el laboratorio y registrar la decisión)
  Commits: incluidos en 958f297 (feat: facha-ui 0.1.0)
  Origen: texto original, tomado de la transcripción de la sesión de Claude Code. Las referencias al proyecto de prueba se reemplazaron por marcadores.
  Lo marcado [reconstruido] no es un prompt: es el contexto que se aprobó, armado a partir del SPEC (§7.7) y del historial de git.
-->

Sí, commiteá el lab en `<rama de laboratorio>` y seguí con T3

---

[reconstruido] T3 era el tercer paso del plan del MVP (`docs/prompts/02-mvp-plan.md`): la skill
`apply`, que solo invoca quien desarrolla. Muestra el plan exacto (archivos que cambian, archivos
que se borran, decisión a registrar), pide aprobación con un motivo, rechaza variantes con
errores del guardián, aplica la variante sobre la pantalla real, limpia el laboratorio y agrega la
entrada a `decisions.md`. Las decisiones de implementación quedaron en SPEC §7.7.
