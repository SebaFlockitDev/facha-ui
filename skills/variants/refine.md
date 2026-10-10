# facha-ui · variants · refine a variant

Read by `SKILL.md` before step R1, when the input is `<slug> <a|b|c> "<change>"` or the developer
asks, in the conversation, for a change to one variant. Every hard rule of `SKILL.md` still
applies.

The developer likes a variant and wants something added or changed. The variant is
changed **in place**, and each refinement is recorded as a revision (`r1`, `r2`…) in the
run, so the history and the reasons are kept and `/facha-ui:apply` records the final
version.

## R1 · Preflight

1. Call `get_design_system` (all sections), as in Step 1 of `SKILL.md`.
2. Read `.facha-ui/runs/<slug>.json`. Stop and explain when it does not exist, when its
   `status` is not `generated` (it was applied or discarded), or when the variant is not in
   `variants`. A `failed` variant can be refined: the refinement may fix it.
3. Read the variant's files, what it imports from `_shared/`, and its `decisions` and
   `revisions`.
4. If the developer asks for a **new** variant instead ("as a new variant", "keep B and
   make another"), create `<x>2` (`b2`, then `b3`…) as a copy of the variant and refine
   the copy. Otherwise, refine in place.

## R2 · Gaps before changing anything

Translate the change into design needs, as in Step 3 of `SKILL.md`. If the change asks for a
value the design system does not have ("make it red" with no danger token, "a bit bigger" with
no step between), say so **before** writing, with the evidence and the closest existing
options. Do not invent the value. The developer chooses an option or drops that part. If the
change works against a principle (`ux:*` in `../_shared/ux-principles.md`), say which one and
offer a version that keeps the intent without breaking it.

## R3 · Change the files

- Change only what the request needs. Keep the variant's hypothesis unless the developer
  explicitly changes it.
- `_shared/` is used by every variant: change it only if the developer accepts that the other
  variants change too; otherwise copy the piece into the variant's folder and change the copy.
- Update the first line of every touched file:
  `// facha-ui lab · run <runId> · variant <x> · revision <n> · removed by /facha-ui:apply`.
- Write with the Write and Edit tools only.

## R4 · Guardian loop

Same as Step 6 of `SKILL.md`: `check_ui` on the variant (and `_shared/` if it changed), at most 3
attempts. The variant's `status` becomes `valid` or `failed` according to the result.

## R4b · Critique of the change

Run `review_ui` on the variant and check the changed area against the critique checklist
(Step 7b of `SKILL.md`). If the change broke something (two primary actions, a lost state, a hole
in the headings), fix it in this revision or say it, with the fix and the principle it breaks.

## R5 · Screenshots

**Before R5, read `lab.md`** (section *Screenshots*) and capture as it says, with revision names
so the previous captures are kept: `<project.screenshotsDir>/<slug>/<x>-r<n>-desktop-<theme>.png`.
Look at every theme.

## R6 · Update the run

**Before R6, read `run-state.md`** (section *Revisions*). In the variant:
- `revision`: the new number;
- `decisions`: the current full list. Add the new decisions with their source (`request`
  for structural choices the developer asked for; `token`, `class`, `rule` or `decision`
  for visual values; `ux-principle` for why) and remove the ones the change replaced;
- `attempts`, `finalCheck`, `status` and `screenshots`: those of this revision;
- `tradeoffs`: updated;
- append the revision to `revisions`, with the shape of `run-state.md`.

The run's `status` stays `generated`. The other variants are not touched.

## R7 · Present

Show:
- what changed and why, in one or two sentences;
- the gaps found in R2, if any;
- the guardian result of this revision;
- the decisions added and removed, with their sources;
- the updated trade-offs;
- the light and dark URLs (or the screenshots).

Close with:

> To adjust it again: `/facha-ui:variants <slug> <x> "<change>"`. To apply it: `/facha-ui:apply <slug> <x>`.
