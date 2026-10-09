---
name: help
description: Lists the facha-ui commands, MCP tools and files, with examples. Only shows text; it never reads or changes the project.
argument-hint: "[variants|apply|init|tools|files]"
disable-model-invocation: true
---

# facha-ui · help

Show the reference below to the developer. Rules:

- **Do not call any tool** and do not read or write files: this command only shows text.
- If `$ARGUMENTS` is `variants`, `apply`, `init`, `tools` or `files`, show only that section,
  plus the last line ("Guía completa…").
  With no argument (or an unknown one), show everything.
- Show it in the developer's language. The text below is in Spanish; translate it if
  they write in another language. Keep commands, paths and tool names exactly as written.
- Do not add anything about the current project: no counts, no file names of theirs.

---

## facha-ui · comandos

| Comando | Para qué |
|---|---|
| `/facha-ui:variants <pantalla> "<objetivo>"` | Genera 3 variantes de una pantalla en el laboratorio, validadas con el guardián |
| `/facha-ui:apply <slug> <a\|b\|c>` | Aplica la variante que elegiste (solo vos lo podés lanzar; pide aprobación y motivo) |
| `/facha-ui:init [colors\|scales\|all]` | Propone los tokens que faltan a partir de los valores que el proyecto ya usa, y los crea solo si aprobás (solo vos lo podés lanzar) |
| `/facha-ui:help [variants\|apply\|init\|tools\|files]` | Esta ayuda |

**Flujo en 4 pasos**

1. Levantá la app (`npm run dev`).
2. `/facha-ui:variants /orders "que se vean primero los pedidos pendientes de revisión"`
3. Mirá las variantes en `http://localhost:3000/lab/orders/<a|b|c>` (y con `?theme=dark`).
4. `/facha-ui:apply orders b` → revisá el plan, aprobalo con el motivo y commiteá vos.

### variants

```text
/facha-ui:variants <pantalla> "<objetivo>"
```

- `<pantalla>`: una ruta (`/orders`), un archivo (`app/orders/page.tsx`) o un componente
  (`components/OrderCard.tsx`).
- `<objetivo>`: texto libre, por ejemplo "que se vea primero lo que espera revisión".
- Antes de generar te avisa las **brechas**: lo que el objetivo necesita y el design system
  no tiene, como un token de estado.
- Hace 3 hipótesis distintas:
  - **A, conservadora:** misma estructura, con el objetivo resuelto;
  - **B, jerarquía:** reorganiza la información;
  - **C, patrón alternativo:** otro patrón con piezas existentes.
- Cada variante pasa por `check_ui` hasta tener 0 errores, con un máximo de 3 intentos.
- Saca capturas en light y dark con Playwright, o te lista las URLs.
- Escribe solo en el laboratorio (`app/lab/<slug>/`) y en `.facha-ui/`. No aplica nada.

### apply

```text
/facha-ui:apply <slug> <a|b|c>
```

- Solo lo podés lanzar vos: Claude no puede invocarlo por su cuenta.
- Antes de escribir, verifica que la variante sea `valid`, vuelve a correr el guardián y
  revisa con git si la pantalla cambió desde el run.
- Te muestra un plan exacto:
  - archivos que cambian y que se borran;
  - la entrada que se agrega a `decisions.md`.
- Aplica solo si respondés nombrando la variante y el motivo, por ejemplo "Sí, aplicá la B:
  deja lo urgente arriba". Una respuesta ambigua se repregunta.
- Valida que no haya errores nuevos, limpia el laboratorio y registra la decisión.
  No commitea.

### init

```text
/facha-ui:init [colors|scales|all]
```

- Para cuando el design system no existe o le faltan roles, como los colores de estado.
- Solo lo podés lanzar vos. Primero propone, sin escribir nada:
  - tokens con su valor por tema y su contraste, sacados de los colores que el proyecto ya usa;
  - escalas de tamaños y radios;
  - un plan para reemplazar los literales.
- Los valores son los que ya están en uso. Para los otros temas, reusa lo que el proyecto ya
  declara o los deriva con contraste verificado, y te dice cómo.
- Creás todo o una parte, y elegís si migrar los literales. Aprobás con un motivo.
- Agrega los tokens, valida el antes y el después con `audit_project` y registra la decisión.
  Nunca cambia ni borra tokens existentes. No commitea.

### tools

Las tools del MCP `facha-ui` son de solo lectura. No hace falta nombrarlas: alcanza con pedírselo a Claude.

| Tool | Pedido de ejemplo | Devuelve |
|---|---|---|
| `get_design_system` | "¿Qué design system tiene este proyecto?" · "¿Qué color uso para X?" | Tokens por tema, clases, roles que faltan, literales sin token, contraste por tema, guidelines y decisiones |
| `check_ui` | "Revisá `app/orders/page.tsx`" · "Corré check_ui sobre lo que cambiaste" | Violaciones con archivo:línea, severidad y token sugerido, incluido el contraste de textos, bordes, foco e íconos en cada tema, los colores de la paleta de Tailwind y las reglas propias del equipo (`custom`) |
| `audit_project` | "¿Cuántas violaciones tiene el proyecto?" | Totales por severidad, regla y archivo |
| `scan_styles` | "¿Qué tokens le faltan a este proyecto?" | Propuesta de tokens desde los valores en uso, con valor por tema, contraste y plan de migración |

### files

| Archivo | Qué es |
|---|---|
| `facha-ui.config.json` | Config del proyecto (opcional: sin ella, autodetecta) |
| `app/lab/<slug>/<a\|b\|c>/` | Variantes. Existen solo en desarrollo; `apply` las borra |
| `.facha-ui/runs/<slug>.json` | Estado del run: hipótesis, intentos, decisiones con fuente, brechas |
| `.facha-ui/screenshots/` | Capturas por variante y tema |
| `design-system/decisions.md` | Memoria de decisiones aprobadas; la próxima corrida las cita |

Guía completa: https://github.com/SebaFlockitDev/facha-ui/blob/main/docs/uso.md
