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
    for (const skill of fs.readdirSync(path.join(REPO, "skills"))) expect(text, skill).toContain(`/facha-ui:${skill}`);
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
