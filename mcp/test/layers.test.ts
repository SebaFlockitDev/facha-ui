import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { connect } from "./helpers.js";

// Tokens and component classes inside cascade layers (@layer), as shadcn/ui and Tailwind 3 write them.

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function project(css: string, config?: object): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "facha-layer-"));
  dirs.push(dir);
  fs.mkdirSync(path.join(dir, "app"));
  fs.writeFileSync(path.join(dir, "app", "globals.css"), css);
  fs.writeFileSync(path.join(dir, "app", "page.tsx"), `export default () => <p className="caption">hi</p>;\n`);
  if (config) fs.writeFileSync(path.join(dir, "facha-ui.config.json"), JSON.stringify({ version: 1, ...config }));
  return dir;
}

async function designSystem(dir: string) {
  const c = await connect(dir);
  const ds = (await c.call("get_design_system")).structuredContent;
  await c.close();
  return ds;
}

const TOKENS = `
  --surface: #ffffff;
  --panel: #f8fafc;
  --text: #0f172a;
  --text-muted: #475569;
  --border: #e2e8f0;
  --primary: #4f46e5;
`;
const DARK = `
  --surface: #0f172a;
  --text: #f8fafc;
`;

describe("tokens inside @layer", () => {
  it("reads :root and .dark inside a named layer", async () => {
    const ds = await designSystem(project(`@tailwind base;\n@layer base {\n  :root {${TOKENS}}\n  .dark {${DARK}}\n}\n`));
    expect(ds.status).not.toBe("missing");
    expect(ds.project.themes.map((t: any) => t.name)).toEqual(["light", "dark"]);
    const surface = ds.tokens.find((t: any) => t.name === "--surface");
    expect(surface).toMatchObject({ type: "color", role: "surface.base", values: { light: "#ffffff", dark: "#0f172a" } });
    expect(ds.tokens.find((t: any) => t.name === "--primary")?.role).toBe("accent.primary");
  });

  it("reads tokens in an anonymous layer, nested layers and a dark media query inside a layer", async () => {
    const css = `@layer {\n  @layer tokens {\n    :root {${TOKENS}}\n  }\n}\n@layer base {\n  @media (prefers-color-scheme: dark) {\n    :root {${DARK}}\n  }\n}\n`;
    const ds = await designSystem(project(css));
    expect(ds.project.themes.map((t: any) => t.name)).toEqual(["light", "dark"]);
    expect(ds.tokens.find((t: any) => t.name === "--text")?.values).toEqual({ light: "#0f172a", dark: "#f8fafc" });
  });

  it("matches configured theme selectors inside a layer", async () => {
    const ds = await designSystem(project(`@layer base {\n  :root {${TOKENS}}\n  [data-theme="dark"] {${DARK}}\n}\n`, { tokens: { themes: { light: ":root", dark: '[data-theme="dark"]' } } }));
    expect(ds.tokens.find((t: any) => t.name === "--surface")?.values).toEqual({ light: "#ffffff", dark: "#0f172a" });
  });

  it("recognises component classes inside @layer components", async () => {
    const css = `:root {${TOKENS}}\n@layer components {\n  .caption { font-size: 12px; color: var(--text-muted); }\n}\n`;
    const ds = await designSystem(project(css));
    const cls = ds.componentClasses.find((c: any) => c.selector === ".caption");
    expect(cls).toBeDefined();
    expect(cls.tokens).toContain("--text-muted");
  });
});
