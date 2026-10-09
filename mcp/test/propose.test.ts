import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resolveWorkspace } from "../src/project.js";
import { connect, FIXTURE } from "./helpers.js";

function tempDir(prefix: string) {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
}

function reactApp(dir: string, withConfig = false) {
  fs.mkdirSync(path.join(dir, "app"), { recursive: true });
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ dependencies: { react: "19.0.0", next: "16.0.0" } }));
  if (withConfig) fs.writeFileSync(path.join(dir, "facha-ui.config.json"), JSON.stringify({ version: 1 }));
}

describe("project discovery (monorepos)", () => {
  const dirs: string[] = [];
  afterAll(() => dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

  it("uses the workspace itself when it is a React project", () => {
    const ws = tempDir("facha-direct-");
    dirs.push(ws);
    reactApp(ws);
    expect(resolveWorkspace({ argRoot: ws, env: {} })).toMatchObject({ mode: "direct", root: ws });
  });

  it("discovers the only frontend below the workspace and says so", async () => {
    const ws = tempDir("facha-mono-");
    dirs.push(ws);
    fs.mkdirSync(path.join(ws, "backend"));
    fs.writeFileSync(path.join(ws, "backend", "pom.xml"), "<project/>");
    reactApp(path.join(ws, "frontend"));
    const w = resolveWorkspace({ argRoot: ws, env: {} });
    expect(w).toMatchObject({ mode: "discovered", root: path.join(ws, "frontend"), candidates: ["frontend"] });
    const h = await connect(w.root, w);
    const r = await h.call("get_design_system", { sections: ["project"] });
    expect(r.structuredContent.project.workspacePath).toBe("frontend");
    expect(r.structuredContent.project.screenshotsDir).toBe("frontend/.facha-ui/screenshots");
    expect(r.structuredContent.assumptions).toEqual(expect.arrayContaining([expect.stringContaining("Project discovered at frontend/")]));
    await h.close();
  });

  it("prefers folders with a facha-ui config over plain React packages", () => {
    const ws = tempDir("facha-tier-");
    dirs.push(ws);
    reactApp(path.join(ws, "packages", "docs"));
    reactApp(path.join(ws, "apps", "web"), true);
    expect(resolveWorkspace({ argRoot: ws, env: {} })).toMatchObject({ mode: "discovered", candidates: ["apps/web"] });
  });

  it("reports MULTIPLE_PROJECTS with the list when several frontends tie", async () => {
    const ws = tempDir("facha-many-");
    dirs.push(ws);
    reactApp(path.join(ws, "admin"));
    reactApp(path.join(ws, "shop"));
    const w = resolveWorkspace({ argRoot: ws, env: {} });
    expect(w).toMatchObject({ mode: "ambiguous", candidates: ["admin", "shop"] });
    const h = await connect(w.root, w);
    const r = await h.call("get_design_system", {});
    expect(r.isError).toBe(true);
    expect(r.structuredContent).toMatchObject({ code: "MULTIPLE_PROJECTS", candidates: ["admin", "shop"] });
    await h.close();
  });

  it("FACHA_UI_ROOT wins over discovery", () => {
    const ws = tempDir("facha-explicit-");
    dirs.push(ws);
    reactApp(path.join(ws, "admin"));
    reactApp(path.join(ws, "shop"));
    expect(resolveWorkspace({ argRoot: ws, env: { FACHA_UI_ROOT: "shop" } })).toMatchObject({ mode: "explicit", root: path.join(ws, "shop") });
  });

  it("ignores node_modules and dot folders while discovering", () => {
    const ws = tempDir("facha-ignored-");
    dirs.push(ws);
    reactApp(path.join(ws, "node_modules", "some-lib"));
    reactApp(path.join(ws, ".cache", "app"));
    reactApp(path.join(ws, "web"));
    expect(resolveWorkspace({ argRoot: ws, env: {} })).toMatchObject({ mode: "discovered", candidates: ["web"] });
  });
});

describe("scan_styles · token proposals from usage", () => {
  let h: Awaited<ReturnType<typeof connect>>;
  let data: any;
  beforeAll(async () => {
    h = await connect(FIXTURE);
    data = (await h.call("scan_styles", {})).structuredContent;
  });
  afterAll(async () => {
    await h.close();
  });

  it("sends literals that match an existing token to `existing`, not to proposals", () => {
    expect(data.existing).toEqual(
      expect.arrayContaining([expect.objectContaining({ value: "#2563eb", use: "var(--color-primary)" })]),
    );
    expect(data.proposals.map((p: any) => p.values.light.value)).not.toContain("#2563eb");
  });

  it("proposes a status token for a tint used next to a status token, with a derived dark value", () => {
    const p = data.proposals.find((x: any) => x.values.light.value === "#fee2e2");
    expect(p).toMatchObject({ name: "--status-danger-bg", role: "status.danger", part: "bg" });
    expect(p.values.dark.origin).toBe("derived");
    expect(p.values.dark.method).toContain("--color-card");
    expect(p.where[0]).toContain("app/globals.css");
  });

  it("derived text values reach the minimum contrast they claim", () => {
    for (const p of data.proposals) {
      for (const [theme, c] of Object.entries<any>(p.contrast ?? {})) {
        if (p.values[theme].origin === "derived") expect(c.ratio, `${p.name} ${theme}`).toBeGreaterThanOrEqual(data.minRatio);
      }
    }
  });

  it("builds a migration plan that covers every color literal", () => {
    const planned = data.migrationPlan.reduce((n: number, f: any) => n + f.count, 0);
    expect(planned).toBe(data.summary.colorLiterals);
    expect(data.summary.coveredByExistingTokens + data.proposals.reduce((n: number, p: any) => n + p.occurrences, 0)).toBe(planned);
  });

  it("is deterministic", async () => {
    const again = (await h.call("scan_styles", {})).structuredContent;
    expect(JSON.stringify(again)).toBe(JSON.stringify(data));
  });
});
