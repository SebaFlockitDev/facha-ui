# Guía de uso del plugin facha-ui

Pasos para instalar facha-ui y usarlo en un proyecto React, desde la instalación hasta aplicar una variante. Para qué es y qué garantiza: [README](../README.md). Detalle técnico: [SPEC](../SPEC.md).

**Resumen del flujo:**

1. Instalar el plugin.
2. Verificar que los servidores MCP conecten.
3. Preparar el proyecto (raíz, config, `.gitignore`).
4. Diagnosticar el design system y las violaciones.
5. `/facha-ui:variants <pantalla> "<objetivo>"` → revisar las 3 variantes.
6. `/facha-ui:apply <slug> <a|b|c>` → aprobar el plan → revisar y commitear vos.

---

## 1. Requisitos

| Qué | Para qué |
|---|---|
| Claude Code con soporte de plugins | Skills y servidores MCP |
| Node ≥ 20 | Corre el MCP de facha-ui y Playwright MCP |
| Git | `apply` lo usa para saber si la pantalla cambió desde el run |
| Google Chrome (o `npx playwright install chromium`) | Capturas de las variantes |
| Proyecto Next.js con App Router | Único framework soportado en 0.1.0 |
| Tokens como CSS custom properties (`--panel`, `--text`, …) | Con o sin Tailwind 4 |

---

## 2. Instalar el plugin

Elegí una de estas tres opciones.

**A. Desde GitHub.** Dentro de Claude Code:

```text
/plugin marketplace add SebaFlockitDev/facha-ui
/plugin install facha-ui@facha-ui
```

**B. Desde una copia local del repo.** Dentro de Claude Code:

```text
/plugin marketplace add C:\ruta\a\facha-ui
/plugin install facha-ui@facha-ui
```

**C. Solo para una sesión, sin instalar nada:**

```bash
claude --plugin-dir "C:\ruta\a\facha-ui"
```

**Para todo el equipo:** commitear en el repo del proyecto `.claude/settings.json`. Cada dev recibe el plugin al abrir Claude Code en ese repo.

```json
{
  "extraKnownMarketplaces": { "facha-ui": { "source": { "source": "github", "repo": "SebaFlockitDev/facha-ui" } } },
  "enabledPlugins": { "facha-ui@facha-ui": true }
}
```

---

## 3. Verificar la instalación

1. Abrí Claude Code **en la carpeta del frontend** (ver el paso 4.1 si es un monorepo).
2. Corré `/mcp`. Tienen que aparecer dos servidores conectados:
   - `plugin:facha-ui:facha-ui`, el guardián;
   - `plugin:facha-ui:playwright`, para las capturas. La primera vez tarda un poco más, porque descarga `@playwright/mcp@0.0.83`.
3. Escribí `/facha-ui:` y tiene que aparecer `variants`. Si escribís `/facha-ui:apply` entero, también funciona: está oculta para el modelo, no para vos.
4. Preguntale a Claude: *"¿qué design system tiene este proyecto?"*. Tiene que llamar a `get_design_system` y responder con los tokens, los temas y lo que falta.

Si algo de esto falla, mirá [Problemas frecuentes](#9-problemas-frecuentes).

---

## 4. Preparar el proyecto

### 4.1 Raíz del proyecto

facha-ui trabaja sobre la carpeta donde está el `package.json` del frontend. La resuelve en este orden:

1. la variable `FACHA_UI_ROOT` (absoluta, o relativa a la carpeta donde abriste Claude Code);
2. la carpeta donde abriste Claude Code.

En un monorepo, abrí Claude Code en el frontend o definí la variable antes de lanzarlo:

```powershell
$env:FACHA_UI_ROOT = "frontend"; claude
```

```bash
FACHA_UI_ROOT=frontend claude
```

### 4.2 Config (`facha-ui.config.json`)

Es opcional: sin config, facha-ui autodetecta e informa los supuestos que hizo. Conviene crearla en la raíz del frontend en cuanto los supuestos estén bien. Esta es la mínima:

```json
{
  "version": 1,
  "tokens": { "sources": ["app/globals.css"] },
  "preview": { "baseUrl": "http://localhost:3000" }
}
```

Claves útiles:

| Clave | Para qué | Default |
|---|---|---|
| `tokens.sources` | Archivos CSS con los tokens | Autodetectado |
| `tokens.themes` | Selector de cada tema, p. ej. `{ "light": ":root", "dark": "html.dark" }` | Autodetectado (`:root`, `.dark`, `html.dark`, `[data-theme=…]`) |
| `include` / `exclude` | Qué archivos audita `audit_project` | `app/**`, `components/**`, … |
| `contrast.surfaces` | Superficies contra las que se mide el contraste del texto | Autodetectado |
| `guidelines` | Reglas del equipo en texto libre; guían el diseño de las variantes | `[]` |
| `lab.dir` | Carpeta del laboratorio | `app/lab` |
| `preview.baseUrl` | URL del dev server (tiene que ser `localhost`, `127.0.0.1` o `::1`) | `http://localhost:3000` |
| `preview.auth` | `manual` si la app pide login (lo hacés vos) | `none` |
| `memory.decisionsFile` | Dónde `apply` registra las decisiones | `design-system/decisions.md` |

Ejemplo completo: SPEC, Anexo A. Si la config tiene un error, las tools responden `CONFIG_INVALID` con la ruta exacta del campo.

### 4.3 `.gitignore`

facha-ui nunca edita el `.gitignore`. Agregá a mano lo que no quieras versionar:

```gitignore
app/lab/
.facha-ui/
```

El laboratorio igual devuelve 404 en producción, pero no conviene que llegue a `main`.

---

## 5. Diagnosticar

Antes de pedir variantes, conviene saber en qué estado está el design system. Ejemplos de pedidos:

| Pedido | Tool | Qué devuelve |
|---|---|---|
| *"¿Qué design system tiene este proyecto?"* | `get_design_system` | Tokens por tema, clases reutilizables, `coverage` (roles que faltan), `gaps` (literales sin token), `health` (contraste por tema), `guidelines` y `decisions` |
| *"¿Qué color uso para X?"* | `get_design_system` | El token, o la aclaración de que no existe y cuál es la alternativa |
| *"Revisá `app/orders/page.tsx`"* | `check_ui` | Violaciones con archivo:línea, severidad y sugerencia de token |
| *"¿Cuántas violaciones tiene el proyecto?"* | `audit_project` | Totales por severidad, por regla y por archivo |

`status` puede tener tres valores:

- **`ok`:** el proyecto cumple el contrato mínimo.
- **`partial`:** faltan roles opcionales. `variants` funciona igual y avisa lo que falta.
- **`missing`:** no hay tokens. `variants` se niega a generar, porque sin tokens la IA solo podría inventar.

---

## 6. Generar variantes

### 6.1 Antes de empezar

1. Levantá la app (`npm run dev`) en la URL de `preview.baseUrl`.
2. Si la app pide login, poné `"auth": "manual"` en `preview` en la config: vas a iniciar sesión vos cuando aparezca la ventana de Playwright.
3. Si la pantalla toma datos de una API, asegurate de que haya datos que muestren el caso. Las variantes usan los datos reales, no mocks.

### 6.2 Pedirlas

```text
/facha-ui:variants <pantalla> "<objetivo>"
```

- `<pantalla>` puede ser una ruta (`/orders`), un archivo (`app/orders/page.tsx`) o un componente (`components/OrderCard.tsx`).
- `<objetivo>` es texto libre: *"que se vea primero lo que espera revisión"*.

Ejemplo:

```text
/facha-ui:variants /orders "que se vean primero los pedidos atrasados"
```

### 6.3 Qué hace la skill

1. **Preflight:** lee el design system. Si no hay tokens, si el framework no es Next o si ya hay un run sin aplicar de esa pantalla, frena y te pregunta.
2. **Línea base:** lee la pantalla y sus dependencias, y corre `check_ui` sobre el original.
3. **Brechas, antes de generar:** si el objetivo necesita algo que no tiene token (p. ej. un color de estado), te lo dice con evidencia y explica cómo lo van a resolver las variantes con tokens existentes. Crear tokens es una decisión del equipo; la skill nunca lo hace.
4. **Tres hipótesis distintas:**
   - **A, conservadora:** misma estructura, con el objetivo resuelto y la línea base corregida;
   - **B, jerarquía:** reorganiza la información según el objetivo;
   - **C, patrón alternativo:** otro patrón armado con piezas existentes.
5. **Escritura en el laboratorio:** `app/lab/<slug>/<a|b|c>/page.tsx`, con el código compartido en `_shared/`. La primera vez agrega el andamiaje (`app/lab/layout.tsx` y `lab-theme.tsx`). Cada escritura pasa por los permisos de Claude Code: la ves y la aprobás.
6. **Guardián:** cada variante pasa por `check_ui` hasta tener 0 errores, con un máximo de 3 intentos. Si no lo logra, queda como `failed` y no se puede aplicar.
7. **Capturas:** en light y en cada tema extra, con Playwright. Si Playwright no llega a la app después de 2 intentos, la skill te pasa las URLs para que las mires a mano.
8. **Presentación:** para cada variante, hipótesis, resultado del guardián, decisiones con su fuente (token, clase, guideline, decisión previa…) y trade-offs.

### 6.4 Revisar el resultado

- **Variantes en el navegador:** `http://localhost:3000/lab/<slug>/<a|b|c>`. Para el tema oscuro, agregá `?theme=dark` (o el nombre del tema).
- **Run:** `.facha-ui/runs/<slug>.json`, con hipótesis, intentos del guardián, decisiones con fuente, brechas y hallazgos.
- **Capturas:** `.facha-ui/screenshots/`.

Si no te convence ninguna, podés pedir ajustes en la misma conversación ("en la B, el resumen va arriba de los filtros"). La skill los valida de nuevo con el guardián.

---

## 7. Aplicar una variante

### 7.1 Pedirlo

```text
/facha-ui:apply <slug> <a|b|c>
```

Ejemplo: `/facha-ui:apply orders b`. Solo lo podés lanzar vos: Claude no puede invocarla por su cuenta.

### 7.2 Qué pasa

1. **Verificaciones, sin escribir nada:**
   - el run tiene que estar sin aplicar y la variante tiene que ser `valid`;
   - el guardián se corre de nuevo sobre la variante;
   - git dice si la pantalla original tiene cambios sin commitear o cambió después del run.
2. **Plan exacto:**
   - archivos que cambian (con resumen del diff) y archivos que se crean;
   - archivos que se borran (el lab de esa pantalla y las capturas descartadas);
   - la entrada completa que se agrega a `decisions.md`.
3. **Tu aprobación y el motivo.** Respondé nombrando la variante y diciendo por qué, por ejemplo: *"Sí, aplicá la B: deja lo urgente arriba sin esconder la tabla"*. Una respuesta ambigua ("ok", "dale") se repregunta. Si el plan cambia, te lo vuelve a mostrar.
4. **Aplicación y validación:** porta la variante a la pantalla real y corre `check_ui`. No puede haber errores nuevos respecto de la línea base. Si los hay, no limpia nada y te ofrece revertir.
5. **Limpieza:** borra el lab de esa pantalla, las capturas descartadas y el andamiaje si no quedan otros runs.
6. **Memoria:** agrega la decisión al final de `decisions.md` (por ejemplo, `dec-2026-10-20-orders`) y marca el run como `applied`.

### 7.3 Después de aplicar

- Revisá el diff y probá la pantalla. **facha-ui no commitea**: el commit lo hacés vos.
- La próxima vez que corras `variants` sobre cualquier pantalla, la decisión aparece en `get_design_system` → `decisions`, y las variantes pueden citarla como fuente.

### 7.4 Descartar sin aplicar

La versión 0.1.0 no tiene `--discard`. Tenés dos formas:

- volver a correr `/facha-ui:variants` sobre la misma pantalla y aceptar descartar el run anterior cuando lo pregunte;
- borrar a mano `app/lab/<slug>/` y `.facha-ui/runs/<slug>.json`.

---

## 8. Uso cotidiano

No hace falta usar `variants` para todo. Con el plugin activo, el MCP le indica a Claude que consulte `get_design_system` antes de escribir UI y que corra `check_ui` después. Un pedido común ("agregá un filtro por canal") ya sale con tokens del proyecto y validado.

Atajos útiles:

- *"Corré check_ui sobre lo que cambiaste"*: antes de commitear.
- *"Auditá el proyecto y mostrame los 5 archivos con más errores"*: para planificar una limpieza.

---

## 9. Problemas frecuentes

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| `/mcp` muestra `facha-ui` desconectado | Node < 20, o el plugin no está instalado | `node --version`; reinstalá el plugin |
| `PROJECT_NOT_FOUND` o tokens vacíos | Claude Code se abrió en una carpeta que no es el frontend | Abrilo en el frontend o usá `FACHA_UI_ROOT` (paso 4.1) |
| `CONFIG_INVALID` | Clave mal escrita o valor inválido en la config | El error indica el campo exacto. `preview.baseUrl` tiene que ser loopback |
| `PATH_OUTSIDE_PROJECT` | Le pediste revisar un archivo fuera del frontend | Usá rutas dentro de la raíz del proyecto |
| `variants` no genera (`status: missing`) | El proyecto no tiene tokens | Definí los roles mínimos (superficie, texto, borde, acento) como CSS custom properties |
| Las capturas no salen | Chrome no está instalado, o el dev server no está levantado | Instalá Chrome o `npx playwright install chromium`; levantá la app; si no, usá las URLs que lista la skill |
| La captura muestra el login | La app pide sesión | Poné `preview.auth: "manual"` e iniciá sesión vos en la ventana de Playwright |
| `?theme=dark` no cambia nada | El tema se define con `@media (prefers-color-scheme)` | No se puede forzar desde la página: usá la emulación de color del navegador |
| `/lab/...` da 404 | La app corre en modo producción | El lab solo existe con `npm run dev` |
| `apply` dice que la pantalla cambió | Hubo commits o cambios en el original después del run | Confirmá explícitamente o generá un run nuevo |

---

## 10. Referencia rápida

| Comando | Quién lo invoca | Escribe |
|---|---|---|
| `/facha-ui:variants <pantalla> "<objetivo>"` | Vos, o Claude cuando pedís "variantes" o "alternativas" | Solo `app/lab/` y `.facha-ui/` |
| `/facha-ui:apply <slug> <a\|b\|c>` | Solo vos | La pantalla elegida, `decisions.md` (al final) y el run, después de tu aprobación |

| Tool MCP | Hace |
|---|---|
| `get_design_system` | Lee tokens, temas, clases, cobertura, brechas, contraste, guidelines y decisiones |
| `check_ui` | Valida un archivo o una carpeta |
| `audit_project` | Audita todo el proyecto (sin el lab) |

| Archivo | Qué es |
|---|---|
| `facha-ui.config.json` | Config del proyecto |
| `app/lab/<slug>/<x>/page.tsx` | Variantes (solo en desarrollo) |
| `.facha-ui/runs/<slug>.json` | Estado del run: hipótesis, intentos, decisiones, brechas |
| `.facha-ui/screenshots/` | Capturas por variante y tema |
| `design-system/decisions.md` | Memoria de decisiones aprobadas |
