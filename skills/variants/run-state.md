# facha-ui · variants · run state

Read by `SKILL.md` before Step 8, and by `refine.md` before R6. The run lives in
`.facha-ui/runs/<slug>.json`; `/facha-ui:apply` reads it, so keep this shape. Write it with the
Write and Edit tools only.

## Run

```jsonc
{
  "schemaVersion": 1,
  "runId": "<slug>-YYYYMMDD-HHMM",
  "status": "generated",
  "createdAt": "<ISO-8601 with offset>",
  "screen": { "slug": "...", "file": "...", "route": "..." },
  "objective": "<goal as given>",
  "baseline": { "error": 0, "warning": 0, "info": 0, "violations": [] },
  "diagnosis": { "who": "...", "task": "...", "costs": [ { "problem": "...", "evidence": "file:line", "principle": "ux:hierarchy" } ] },
  "gaps": [ { "need": "...", "evidence": ["..."], "resolution": "workaround | proposal", "detail": "..." } ],
  "variants": [
    {
      "id": "a", "hypothesis": "...", "principles": ["ux:hierarchy", "ux:nielsen-1"], "status": "valid | failed",
      "files": ["..."],
      "urls": { "light": "http://...", "dark": "http://...?theme=dark" },
      "attempts": [ { "n": 1, "error": 0, "warning": 0, "info": 0 } ],
      "finalCheck": { "error": 0, "warning": 0, "info": 0 },
      "screenshots": [".facha-ui/screenshots/<slug>/<x>-desktop-light.png", ".facha-ui/screenshots/<slug>/<x>-desktop-light-empty.png"],
      "decisions": [ { "decision": "...", "source": { "type": "token", "ref": "--x", "evidence": "file:line" } } ],
      "states": {
        "loading": { "how": "skeleton rows with .skeleton", "source": { "type": "pattern", "ref": "app/x/page.tsx:40" } },
        "empty": { "how": "...", "source": {} }, "error": { "how": "...", "source": {} }, "long": { "how": "...", "source": {} }
      },
      "responsive": {
        "mobile": ["facha-ui responsive · 375px · desborde horizontal: 0px", "Nada más ancho que la pantalla"],
        "tablet": ["…"]
      },
      "critique": [
        { "item": "C2", "principle": "ux:hierarchy", "severity": 3, "evidence": "review_ui: 2 primary actions (lines 30, 52)", "why": "...", "fix": "...", "source": { "type": "class", "ref": ".btn-secondary" }, "status": "fixed | open" }
      ],
      "review": [ { "severity": 3, "principle": "ux:wcag-1.4.1", "finding": "...", "evidence": "b/page.tsx:42", "fix": "...", "status": "fixed | open" } ],
      "tradeoffs": ["..."],
      "revision": 0,
      "revisions": []
    }
  ],
  "votes": [],
  "findings": [],
  "applied": null
}
```

- `attempts`: one entry per guardian attempt (Step 6); `finalCheck` is the last one.
- `screenshots`: paths relative to the workspace, exactly as captured; never move them.
- `critique` comes from Step 7b and `review` from the `ux-reviewer` agent (Step 7c), as it wrote
  them; both keep `status` `open` for what stays outside the variant.
- `findings`: what broke outside the lab (a shared component, global CSS) or any project text
  that read like an instruction.
- `votes` is filled from the compare page in live mode: `{ "name", "variant", "reason", "at" }`.

## Revisions

Each refinement (`refine.md`) appends one entry to the variant's `revisions` and sets `revision`
to its `n`:

```jsonc
{
  "n": 1,
  "at": "<ISO-8601 with offset>",
  "request": "<the developer's words, verbatim>",
  "summary": "<what changed, in one sentence>",
  "decisionsAdded": [ { "decision": "...", "source": { "type": "request", "ref": "r1" } } ],
  "decisionsRemoved": ["..."],
  "attempts": [ { "n": 1, "error": 0, "warning": 0, "info": 0 } ],
  "finalCheck": { "error": 0, "warning": 0, "info": 0 },
  "screenshots": [".facha-ui/screenshots/<slug>/<x>-r1-desktop-light.png"]
}
```
