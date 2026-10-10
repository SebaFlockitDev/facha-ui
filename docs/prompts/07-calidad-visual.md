<!--
  Prompt 07 · Calidad visual medible: 0.3.0, 0.4.0 y 0.5.0
  Fecha: 2026-10-09 · Autor: Seba Adrover
  Resultado: contraste por uso, por clase y no textual, estados confundibles (0.3.0, SPEC §7.11); paleta de Tailwind y reglas custom (0.4.0, §7.12); escalas por defecto y paleta inflada (0.5.0, §7.13)
  Commits: fc506b7, 0ef99d8, c56bedd (0.3.0) · 2c9d33e, 9ec8983, 7cc56d5 (0.4.0) · e357b36, 828b5b7, cab77b0 (0.5.0)
  Origen: texto original, tomado de la transcripción de la sesión de Claude Code.
  Lo marcado [reconstruido] no es un prompt: es la lista a la que se refieren "el 1 y el 2", "el punto 3" y "el punto 4", armada a partir del SPEC y del historial de git.
-->

reglas que aún no se evalúan: paleta de Tailwind, escalas por defecto, contraste por uso y las reglas custom;,
conviene agregar cuestiones que tienen que ver con mejorar la interfas en colores siguiendo las pbuenas practicas de disenho ? apostando mas por lo visual ?

---

[reconstruido] La propuesta que siguió, en cuatro puntos:
1. contraste por uso: cada color de texto contra su fondo real, en cada tema (`theme-contrast`), y
   por clase en cada archivo que la usa (`class-contrast`);
2. contraste de lo que no es texto (bordes de controles, foco, íconos, WCAG 1.4.11) y estados que se
   confunden entre sí, también con daltonismo simulado (`status-confusable`);
3. paleta por defecto de Tailwind (`tailwind-palette-color`) y reglas `custom` del equipo;
4. escalas por defecto de Tailwind (`tailwind-default-scale`) y paleta inflada (tokens y colores
   casi iguales).

---

sí, arrancá por el 1 y el 2

---

seguí con el punto 3: paleta de Tailwind y reglas custom

---

seguí con el punto 4
