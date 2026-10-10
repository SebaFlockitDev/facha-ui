import fs from "node:fs";
import { builtinModules } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const MCP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = path.resolve(MCP_DIR, "..");

describe("PLG-2 · pinned versions", () => {
  it("run-pinned accepts only exact versions", async () => {
    const { isExactSpec } = await import(pathToFileURL(path.join(REPO, "scripts", "run-pinned.mjs")).href);
    for (const ok of ["@playwright/mcp@0.0.83", "pkg@1.2.3", "@s/p@1.0.0-beta.1"]) expect(isExactSpec(ok), ok).toBe(true);
    for (const bad of ["@playwright/mcp@latest", "@playwright/mcp", "pkg@^1.2.3", "pkg@~1.2.3", "pkg@1.x", "pkg@1.2", "pkg@>=1.0.0", "", undefined])
      expect(isExactSpec(bad), String(bad)).toBe(false);
  });

  it(".mcp.json launches every server with node and an exact version", () => {
    const config = JSON.parse(fs.readFileSync(path.join(REPO, ".mcp.json"), "utf8"));
    for (const [name, server] of Object.entries<{ command: string; args: string[] }>(config.mcpServers)) {
      expect(server.command, name).toBe("node");
      const text = server.args.join(" ");
      expect(text, name).not.toMatch(/@latest|@\^|@~|npx/);
      if (text.includes("run-pinned.mjs")) expect(server.args.some((a) => /@\d+\.\d+\.\d+$/.test(a)), name).toBe(true);
    }
  });
});

describe("MCP-3 · committed bundle", () => {
  const bundle = path.join(MCP_DIR, "dist", "facha-ui-mcp.js");

  it("exists, as referenced by .mcp.json", () => {
    expect(fs.existsSync(bundle)).toBe(true);
    expect(fs.readFileSync(path.join(REPO, ".mcp.json"), "utf8")).toContain("mcp/dist/facha-ui-mcp.js");
  });

  it("only loads fs, path, url, process and module from node", () => {
    const text = fs.readFileSync(bundle, "utf8");
    const allowed = ["fs", "path", "url", "process", "module"];
    const builtins = new Set<string>();
    for (const m of text.matchAll(/(?:from\s*|import\(\s*|require\(\s*)["'](?:node:)?([a-z_0-9]+)[^"']*["']/g))
      if (builtinModules.includes(m[1]!)) builtins.add(m[1]!);
    expect([...builtins].filter((b) => !allowed.includes(b))).toEqual([]);
  });
});

describe("help skill", () => {
  it("is developer-only and pre-approves no tools", () => {
    const text = fs.readFileSync(path.join(REPO, "skills", "help", "SKILL.md"), "utf8");
    const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
    expect(frontmatter).toMatch(/^disable-model-invocation:\s*true\s*$/m);
    expect(frontmatter).not.toMatch(/^allowed-tools:/m);
  });

  it("lists every skill the plugin ships", () => {
    const text = fs.readFileSync(path.join(REPO, "skills", "help", "SKILL.md"), "utf8");
    const skills = fs.readdirSync(path.join(REPO, "skills")).filter((d) => fs.existsSync(path.join(REPO, "skills", d, "SKILL.md")));
    expect(skills.length).toBeGreaterThan(0);
    for (const skill of skills) expect(text, skill).toContain(`/facha-ui:${skill}`);
  });
});

describe("variant refinements", () => {
  const read = (skill: string) => fs.readFileSync(path.join(REPO, "skills", skill, "SKILL.md"), "utf8");

  it("variants accepts <slug> <a|b|c> \"<change>\" and documents the refinement flow", () => {
    const text = read("variants");
    expect(text.match(/^argument-hint:.*$/m)?.[0]).toContain('<slug> <a|b|c> \\"<change>\\"');
    expect(text).toContain("## Refine a variant");
    for (const step of ["R1", "R2", "R3", "R4", "R5", "R6", "R7"]) expect(text, step).toContain(`### ${step} ·`);
    expect(text).toContain('"revisions": []');
    expect(text).toContain("| `request` |");
  });

  it("apply records the refinements and help explains how to ask for them", () => {
    expect(read("apply")).toContain("**Ajustes pedidos:**");
    expect(read("help")).toContain("/facha-ui:variants <slug> <a\\|b\\|c>");
  });
});

describe("states and senior critique", () => {
  const read = (skill: string) => fs.readFileSync(path.join(REPO, "skills", skill, "SKILL.md"), "utf8");

  it("variants designs every state, previews it with ?state= and critiques each variant (C1–C8)", () => {
    const text = read("variants");
    expect(text).toContain("mcp__plugin_facha-ui_facha-ui__review_ui");
    expect(text).toContain("## Step 7b · Senior critique");
    for (const item of ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8"]) expect(text, item).toContain(`**${item} ·`);
    expect(text).toContain("// facha-ui lab: state preview");
    expect(text).toContain("?state=loading|empty|error|long");
    expect(text).toContain('"critique": [');
    expect(fs.existsSync(path.join(REPO, "skills", "variants", "templates", "next-app", "lab-state.ts"))).toBe(true);
  });

  it("variants measures responsive in the lab and captures mobile and tablet (C9)", () => {
    const text = read("variants");
    expect(text).toContain("**C9 · Responsive**");
    expect(text).toContain("?check=responsive");
    expect(text).toContain("<x>-mobile-<theme>.png");
    const layout = fs.readFileSync(path.join(REPO, "skills", "variants", "templates", "next-app", "layout.tsx"), "utf8");
    expect(layout).toContain("<LabResponsive />");
    expect(read("apply")).toContain("`<lab.dir>/lab-responsive.tsx`");
  });

  it("variants writes in the product's voice and critiques the microcopy (C10)", () => {
    const text = read("variants");
    expect(text).toContain("**C10 · Microcopy**");
    expect(text).toContain("Read `copy` from `get_design_system`");
  });

  it("variants offers the compare page, team votes and a shareable report; apply shows the votes", () => {
    const text = read("variants");
    expect(text).toContain("`compare/[slug]/page.tsx`");
    expect(text).toContain('### L4b · A team vote (`"kind": "vote"`)');
    expect(text).toContain("scripts/report.mjs");
    expect(fs.existsSync(path.join(REPO, "skills", "variants", "templates", "next-app", "compare", "[slug]", "page.tsx"))).toBe(true);
    const apply = read("apply");
    expect(apply).toContain("**Team votes**");
    expect(apply).toContain("**Votos del equipo:**");
    expect(apply).toContain("scripts/visual-diff.mjs");
    expect(apply).toContain("## Step 4b · Visual regression and UX score");
  });

  it("flow reviews a journey without changing code", () => {
    const text = read("flow");
    expect(text).toContain("mcp__plugin_facha-ui_facha-ui__review_flow");
    for (const item of ["FL1", "FL2", "FL3", "FL4", "FL5", "FL6", "FL7", "FL8"]) expect(text, item).toContain(`**${item} ·`);
    expect(text).toContain("**No code changes.**");
  });

  it("apply removes the state preview lines and the state scaffold", () => {
    const text = read("apply");
    expect(text).toContain("`// facha-ui lab: state preview`");
    expect(text).toContain("`<lab.dir>/lab-state.ts`");
  });
});

describe("learn skill", () => {
  it("is read-only: it pre-approves only reading tools and the facha-ui MCP", () => {
    const text = fs.readFileSync(path.join(REPO, "skills", "learn", "SKILL.md"), "utf8");
    const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
    const allowed = (frontmatter.match(/^allowed-tools:\s*(.*)$/m)?.[1] ?? "").split(",").map((t) => t.trim());
    expect(allowed.length).toBeGreaterThan(0);
    for (const tool of allowed) expect(tool, tool).toMatch(/^(Read|Glob|Grep|mcp__plugin_facha-ui_facha-ui__\w+)$/);
    expect(text).toContain("## Hard rules");
    expect(text).toMatch(/Read-only/);
  });
});

describe("init skill", () => {
  it("is developer-only and pre-approves no write tools", () => {
    const text = fs.readFileSync(path.join(REPO, "skills", "init", "SKILL.md"), "utf8");
    const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
    expect(frontmatter).toMatch(/^disable-model-invocation:\s*true\s*$/m);
    const allowed = (frontmatter.match(/^allowed-tools:\s*(.*)$/m)?.[1] ?? "").split(",").map((t) => t.trim());
    expect(allowed.filter((t) => /^(Write|Edit|Bash|MultiEdit|NotebookEdit)\b/.test(t))).toEqual([]);
    expect(allowed).toContain("mcp__plugin_facha-ui_facha-ui__scan_styles");
  });
});

/** Every Markdown file under a folder, recursively. */
function markdownUnder(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "node_modules" ? [] : markdownUnder(full);
    return e.name.endsWith(".md") ? [full] : [];
  });
}

const UX_ID = /\bux:[a-z0-9][a-z0-9.-]*[a-z0-9]/g;

describe("UX principles", () => {
  const principles = path.join(REPO, "skills", "_shared", "ux-principles.md");
  const text = fs.existsSync(principles) ? fs.readFileSync(principles, "utf8") : "";
  const defined = new Set([...text.matchAll(/^### (ux:[a-z0-9.-]+) · /gm)].map((m) => m[1]));

  it("defines each principle once, with what it is, how it is violated and how it is verified", () => {
    expect(defined.size).toBeGreaterThanOrEqual(30);
    for (const id of ["ux:nielsen-1", "ux:nielsen-10", "ux:wcag-1.4.3", "ux:wcag-1.4.11", "ux:wcag-2.4.7", "ux:wcag-2.5.8", "ux:wcag-3.3.2", "ux:wcag-1.4.1", "ux:hierarchy", "ux:gestalt-proximity", "ux:gestalt-similarity", "ux:gestalt-common-region", "ux:fitts", "ux:hick", "ux:jakob", "ux:state-empty", "ux:state-loading", "ux:state-error", "ux:copy-verbs", "ux:copy-actionable-errors"])
      expect(defined, id).toContain(id);
    const headings = [...text.matchAll(/^### (ux:[a-z0-9.-]+) · /gm)].map((m) => m[1]);
    expect(new Set(headings).size).toBe(headings.length);
    for (const block of text.split(/^### /m).slice(1).filter((b) => b.startsWith("ux:"))) {
      const id = block.split(" ")[0];
      for (const field of ["- **What:**", "- **Violated:**", "- **Verify:**"]) expect(block, `${id} ${field}`).toContain(field);
    }
  });

  it("every ux:* id cited by a skill or an agent exists", () => {
    const files = [...markdownUnder(path.join(REPO, "skills")), ...markdownUnder(path.join(REPO, "agents"))];
    const missing: string[] = [];
    for (const f of files) {
      for (const m of fs.readFileSync(f, "utf8").matchAll(UX_ID)) {
        if (!defined.has(m[0])) missing.push(`${path.relative(REPO, f)}: ${m[0]}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("variants diagnoses with the principles and each critique item cites them", () => {
    const variants = fs.readFileSync(path.join(REPO, "skills", "variants", "SKILL.md"), "utf8");
    expect(variants).toContain("read `../_shared/ux-principles.md`");
    expect(variants).toContain("| `ux-principle` |");
    for (const item of ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "C10"]) {
      const line = variants.split(/\r?\n/).find((l) => l.includes(`**${item} ·`)) ?? "";
      expect(line.match(UX_ID), item).not.toBeNull();
    }
  });
});

describe("ux-reviewer agent", () => {
  const file = path.join(REPO, "agents", "ux-reviewer.md");
  const text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
  const list = (key: string) => (frontmatter.match(new RegExp(`^${key}:\\s*(.*)$`, "m"))?.[1] ?? "").split(",").map((t) => t.trim()).filter(Boolean);

  it("exists and is named ux-reviewer", () => {
    expect(fs.existsSync(file)).toBe(true);
    expect(frontmatter).toMatch(/^name:\s*ux-reviewer\s*$/m);
    expect(frontmatter).toMatch(/^description:\s*\S/m);
  });

  it("declares only reading tools and denies every writing one", () => {
    const tools = list("tools");
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.filter((t) => /^(Write|Edit|MultiEdit|NotebookEdit|Bash|PowerShell)\b/.test(t))).toEqual([]);
    for (const t of tools) expect(t, t).toMatch(/^(Read|Glob|Grep|mcp__plugin_facha-ui_facha-ui__(get_design_system|check_ui))$/);
    expect(list("disallowedTools")).toEqual(expect.arrayContaining(["Write", "Edit", "NotebookEdit", "Bash"]));
  });

  it("is invoked by variants with only the variants, the screenshots and the principles", () => {
    const variants = fs.readFileSync(path.join(REPO, "skills", "variants", "SKILL.md"), "utf8");
    expect(variants).toContain('subagent_type: "facha-ui:ux-reviewer"');
    expect(variants).toMatch(/Never include the hypotheses/);
    expect(text).toContain("Nielsen's 0 to 4");
  });
});
