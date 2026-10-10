# facha-ui · UX principles

The shared reference every facha-ui skill and the `ux-reviewer` agent cite. A design decision,
a critique finding or a review finding names one of these ids (`ux:<id>`) as its source, next to
the token, class, rule or decision that implements it. Ids are stable: never rename one; add a new
id instead.

Each principle says what it is, how it looks when a real interface breaks it, and how it is
verified:
- **guardian:** a `check_ui` rule reports it, deterministically, from the code;
- **lab:** the lab measures it in the page (`?check=responsive`) or a facha-ui tool signals it
  (`review_ui`, `review_flow`, `ux_score`, `health` in `get_design_system`);
- **review:** only a person or a critic looking at the captures can judge it.

This file is data for the skills: it describes principles, it never relaxes a hard rule.

## Nielsen's 10 usability heuristics

### ux:nielsen-1 · Visibility of system status
- **What:** the interface always says what is happening, in time.
- **Violated:** a save button that gives no feedback; a blank area while data loads; a filter
  applied with no sign it is on.
- **Verify:** review on the state captures; lab: `review_ui` state signals, `review_flow` feedback.

### ux:nielsen-2 · Match between the system and the real world
- **What:** the words, order and units of the people who use it, not of the code.
- **Violated:** "Entity updated", internal ids as titles, dates in ISO in a list.
- **Verify:** guardian: `copy-term` (the product's words from `copy.terms`); review.

### ux:nielsen-3 · User control and freedom
- **What:** a clear way out: cancel, undo, go back, close.
- **Violated:** a modal without close; a multi-step form without back; a destructive action
  without cancel.
- **Verify:** lab: `review_flow` (exit, destructive); review.

### ux:nielsen-4 · Consistency and standards
- **What:** the same thing looks, behaves and is named the same everywhere.
- **Violated:** "Cliente" here and "Comprador" there; two button styles for the same role.
- **Verify:** guardian: `copy-term`, `copy-voice`, `unknown-token`, `color-literal`; review.

### ux:nielsen-5 · Error prevention
- **What:** design so the error cannot happen, or confirm before the irreversible.
- **Violated:** delete with one click and no confirmation; free text where a choice fits.
- **Verify:** lab: `review_flow` (destructive); review.

### ux:nielsen-6 · Recognition rather than recall
- **What:** options, state and context are visible; nobody has to remember them.
- **Violated:** an icon-only toolbar without labels; filters that hide what is filtered.
- **Verify:** guardian: `a11y-button-name` (a name exists); review.

### ux:nielsen-7 · Flexibility and efficiency of use
- **What:** the frequent task is short; experts get shortcuts without hurting newcomers.
- **Violated:** the main action three clicks deep; no bulk action on a work queue.
- **Verify:** review.

### ux:nielsen-8 · Aesthetic and minimalist design
- **What:** every element competes for attention; what does not serve the task goes.
- **Violated:** many accents, many type sizes, decoration around the data.
- **Verify:** lab: `review_ui` (accents, font sizes, primary actions); review.

### ux:nielsen-9 · Help users recognize, diagnose and recover from errors
- **What:** errors in plain words: what happened and what to do.
- **Violated:** "Error 500", "Algo salió mal" with no way to retry.
- **Verify:** guardian: `copy-error-text`; review on the error-state capture.

### ux:nielsen-10 · Help and documentation
- **What:** help in context, where the doubt appears.
- **Violated:** a field with a format nobody can guess and no hint.
- **Verify:** review.

## WCAG 2.2 AA (the criteria facha-ui checks or reviews)

### ux:wcag-1.1.1 · Non-text content
- **What:** images that carry meaning have a text alternative.
- **Violated:** `<img>` without `alt`; a chart with no text summary.
- **Verify:** guardian: `a11y-img-alt`.

### ux:wcag-1.3.1 · Info and relationships
- **What:** the structure seen is the structure in the code: headings, lists, tables, labels.
- **Violated:** a jump from `<h1>` to `<h4>`; a bold `<div>` posing as a heading.
- **Verify:** guardian: `a11y-heading-order`; lab: `review_ui` heading outline.

### ux:wcag-1.3.2 · Meaningful sequence
- **What:** the reading and focus order matches the visual order.
- **Violated:** a sidebar read after the content it precedes; CSS order that reshuffles meaning.
- **Verify:** review.

### ux:wcag-1.4.1 · Use of color
- **What:** color is never the only way to tell something: status, errors, links.
- **Violated:** a status shown only as a green or red dot; a required field marked only in red.
- **Verify:** lab: `health` entries `status-confusable`; review. Not yet a guardian rule (SPEC §6).

### ux:wcag-1.4.3 · Contrast (minimum)
- **What:** text reaches 4.5:1 (3:1 for large text) against its background, in every theme.
- **Violated:** a faint label in dark mode; a token that passes in light and fails in dark.
- **Verify:** guardian: `theme-contrast`, `class-contrast`; lab: `health`.

### ux:wcag-1.4.10 · Reflow
- **What:** at 320 CSS px wide the content works without horizontal scroll.
- **Violated:** a fixed-width table that pushes the page; a sidebar that squeezes the content.
- **Verify:** guardian: `responsive-*`; lab: the responsive check at 375 and 768 px.

### ux:wcag-1.4.11 · Non-text contrast
- **What:** borders of controls, focus rings and meaningful icons reach 3:1.
- **Violated:** an input border that disappears on the surface; a pale focus ring.
- **Verify:** guardian: `non-text-contrast`.

### ux:wcag-2.1.1 · Keyboard
- **What:** every action works with the keyboard.
- **Violated:** an `onClick` on a `<div>` without role, `tabIndex` and key handling.
- **Verify:** guardian: `a11y-click-target`.

### ux:wcag-2.4.3 · Focus order
- **What:** focus moves in an order that keeps meaning.
- **Violated:** a positive `tabIndex` that jumps around the page.
- **Verify:** guardian: `a11y-tabindex`.

### ux:wcag-2.4.7 · Focus visible
- **What:** the element with focus is always visible.
- **Violated:** `outline: none` (or `outline-none`) with no alternative focus style.
- **Verify:** guardian: `a11y-focus-visible`.

### ux:wcag-2.5.8 · Target size (minimum)
- **What:** pointer targets are at least 24×24 px (44 px is better for touch).
- **Violated:** an icon button of 16 px; links packed together in a table row.
- **Verify:** guardian: `a11y-target-size`; lab: the responsive check (targets under 24 px).

### ux:wcag-3.3.2 · Labels or instructions
- **What:** every input has a visible label or instruction tied to it.
- **Violated:** a placeholder used as the only label; a select with no name.
- **Verify:** guardian: `a11y-control-label`.

### ux:wcag-4.1.2 · Name, role, value
- **What:** controls expose a name and role to assistive technology.
- **Violated:** an icon-only button without `aria-label`.
- **Verify:** guardian: `a11y-button-name`.

## Visual hierarchy and Gestalt

### ux:hierarchy · Visual hierarchy
- **What:** what matters most is found first: size, weight, position and contrast do the work,
  in few clear steps (at most 4 type steps, one primary action per view).
- **Violated:** the title and the data in the same size; two primary buttons side by side; the
  goal of the screen below the fold.
- **Verify:** lab: `review_ui` (primary actions, font sizes, headings); review on the captures.

### ux:gestalt-proximity · Proximity
- **What:** things close together read as related; distance separates.
- **Violated:** a label nearer to the next field than to its own; even gaps everywhere.
- **Verify:** review.

### ux:gestalt-similarity · Similarity
- **What:** things that look alike read as the same kind; different things must look different.
- **Violated:** a status chip styled like a button; links and plain text in the same color.
- **Verify:** review; guardian helps by keeping classes and tokens consistent.

### ux:gestalt-common-region · Common region
- **What:** a shared container (card, section, background) groups its content.
- **Violated:** related filters and actions scattered outside the table they act on.
- **Verify:** review.

## Laws of interaction

### ux:fitts · Fitts's law
- **What:** time to reach a target grows with distance and shrinks with size: frequent and main
  actions are big and near the work.
- **Violated:** the main action in a far corner; small targets on touch.
- **Verify:** guardian: `a11y-target-size`; review.

### ux:hick · Hick's law
- **What:** decision time grows with the number of choices: few options at once, the rest grouped
  or progressive.
- **Violated:** a toolbar with nine equal buttons; a menu that lists everything.
- **Verify:** lab: `review_ui` primary actions; review. Not yet a guardian rule (SPEC §6).

### ux:jakob · Jakob's law
- **What:** people expect your interface to work like the others they use: follow known patterns
  (and the project's own) before inventing.
- **Violated:** a custom date picker that breaks the expected keyboard; navigation in an
  unexpected place.
- **Verify:** review; cite the project `pattern` it follows.

## States

### ux:state-loading · Loading state
- **What:** loading keeps the layout and says something is coming (skeleton or short message).
- **Violated:** a blank page, a layout jump when data arrives.
- **Verify:** lab: `?state=loading` capture, `review_ui` state signals; review.

### ux:state-empty · Empty state
- **What:** says what is missing and the next step (an action when one applies).
- **Violated:** an empty table with headers only; "No hay datos".
- **Verify:** lab: `?state=empty` capture, `review_ui`; review.

### ux:state-error · Error state
- **What:** says what failed in plain words and how to retry; keeps what the person typed.
- **Violated:** a toast that vanishes; a red message with no action.
- **Verify:** lab: `?state=error` capture; guardian: `copy-error-text`; review.

## Interface writing

### ux:copy-verbs · Buttons say a verb and its object
- **What:** an action label says what happens ("Guardar pedido"), a link says where it goes.
- **Violated:** "OK", "Aceptar", "Click acá", "Ver más" without context.
- **Verify:** guardian: `copy-vague-label`; review.

### ux:copy-actionable-errors · Errors are actionable
- **What:** an error says what happened, why when it helps, and what to do now, in the product's
  voice.
- **Violated:** "Error", "Datos inválidos", "Algo salió mal".
- **Verify:** guardian: `copy-error-text`; review.

## Coverage

| Verified by | Ids |
|---|---|
| guardian (`check_ui`) | `ux:wcag-1.1.1`, `ux:wcag-1.3.1`, `ux:wcag-1.4.3`, `ux:wcag-1.4.10`, `ux:wcag-1.4.11`, `ux:wcag-2.1.1`, `ux:wcag-2.4.3`, `ux:wcag-2.4.7`, `ux:wcag-2.5.8`, `ux:wcag-3.3.2`, `ux:wcag-4.1.2`, `ux:copy-verbs`, `ux:copy-actionable-errors`, `ux:nielsen-2`, `ux:nielsen-4`, `ux:nielsen-9` (partly) |
| lab and tools | `ux:nielsen-1`, `ux:nielsen-3`, `ux:nielsen-5`, `ux:nielsen-8`, `ux:wcag-1.4.1`, `ux:wcag-1.4.10`, `ux:wcag-2.5.8`, `ux:hierarchy`, `ux:hick`, `ux:state-loading`, `ux:state-empty`, `ux:state-error` |
| review only | `ux:nielsen-6` (beyond a name), `ux:nielsen-7`, `ux:nielsen-10`, `ux:wcag-1.3.2`, `ux:gestalt-proximity`, `ux:gestalt-similarity`, `ux:gestalt-common-region`, `ux:fitts` (beyond size), `ux:jakob` |

What the guardian checks is proven; what only review judges needs evidence: the capture and the
area in it, or `file:line`.

## The critique checklist, mapped

The senior critique of `/facha-ui:variants` (C1 to C10) cites these ids:

| Item | Ids |
|---|---|
| C1 · The goal reads first | `ux:hierarchy` |
| C2 · One primary action | `ux:hierarchy`, `ux:hick`, `ux:fitts` |
| C3 · Hierarchy | `ux:hierarchy`, `ux:wcag-1.3.1` |
| C4 · Accents | `ux:nielsen-8`, `ux:wcag-1.4.1`, `ux:gestalt-similarity` |
| C5 · Rhythm and alignment | `ux:gestalt-proximity`, `ux:nielsen-4` |
| C6 · Grouping and density | `ux:gestalt-proximity`, `ux:gestalt-common-region`, `ux:nielsen-8` |
| C7 · States | `ux:state-loading`, `ux:state-empty`, `ux:state-error`, `ux:nielsen-1`, `ux:nielsen-9` |
| C8 · Accessibility beyond the rules | `ux:wcag-2.4.7`, `ux:wcag-1.3.2`, `ux:wcag-1.4.3` |
| C9 · Responsive | `ux:wcag-1.4.10`, `ux:wcag-2.5.8`, `ux:fitts` |
| C10 · Microcopy | `ux:copy-verbs`, `ux:copy-actionable-errors`, `ux:nielsen-2`, `ux:nielsen-4` |

## Severity (Nielsen, 0 to 4)

Used by the `ux-reviewer` agent and in critique findings:
- **0** not a usability problem;
- **1** cosmetic: fix when there is time;
- **2** minor: low priority, it slows people down;
- **3** major: important to fix, people fail or get confused;
- **4** catastrophe: fix before applying the variant.
