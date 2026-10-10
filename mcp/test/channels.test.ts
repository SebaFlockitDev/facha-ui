import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { contrast } from "../src/color.js";
import { createContext } from "../src/context.js";
import { isHslChannels, shadcnRole } from "../src/shadcn.js";
import { tokenColor } from "../src/tokens.js";
import { connect } from "./helpers.js";

// Colors written as bare HSL channels, and the shadcn/ui roles (SPEC §2.0.2).

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function project(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "facha-hsl-"));
  dirs.push(dir);
  for (const [name, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), text);
  }
  if (!files["app/page.tsx"]) fs.writeFileSync(path.join(dir, "app", "page.tsx"), `export default () => <p>hi</p>;\n`);
  return dir;
}

async function tokens(dir: string) {
  const c = await connect(dir);
  const ds = (await c.call("get_design_system")).structuredContent;
  await c.close();
  return { ds, byName: new Map<string, any>(ds.tokens.map((t: any) => [t.name, t])) };
}

const SHADCN = `@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --chart-1: 12 76% 61%;
    --radius: 0.5rem;
  }
  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --muted-foreground: 215 20.2% 65.1%;
  }
}
`;

describe("channel values", () => {
  it("recognises HSL channels with and without alpha, and nothing else", () => {
    for (const ok of ["222.2 47.4% 11.2%", "0 0% 100%", "222 47% 11% / 0.5", "220deg 10% 20% / 50%", ".5turn 5% 5%"]) expect(isHslChannels(ok), ok).toBe(true);
    for (const bad of ["#ffffff", "hsl(0 0% 100%)", "0.5rem", "1px 2px 3px", "10 20 30", "0 0% 100% 1", ""]) expect(isHslChannels(bad), bad).toBe(false);
  });

  it("reads channels as colors when the project consumes them as hsl(var(--x)), alpha included", async () => {
    const dir = project({
      "app/globals.css": `:root {\n  --surface: 0 0% 100%;\n  --ink: 222 47% 11%;\n  --veil: 222 47% 11% / 0.5;\n}\n.dark {\n  --surface: 222 47% 11%;\n  --ink: 210 40% 98%;\n}\nbody { background: hsl(var(--surface)); color: hsl(var(--ink)); }\n.overlay { background: hsl(var(--veil)); }\n`,
    });
    const { byName, ds } = await tokens(dir);
    expect(byName.get("--surface")).toMatchObject({ type: "color", format: "hsl-channels", role: "surface.base", values: { light: "0 0% 100%", dark: "222 47% 11%" } });
    expect(byName.get("--veil")).toMatchObject({ type: "color", format: "hsl-channels" });
    expect(ds.assumptions.join(" ")).toMatch(/bare HSL channels read as colors/);
    const ctx = createContext(dir);
    expect(contrast(tokenColor(ctx.tokens, "--ink", "light")!, tokenColor(ctx.tokens, "--surface", "light")!)).toBeGreaterThan(15);
    expect(tokenColor(ctx.tokens, "--veil", "light")?.alpha).toBe(0.5);
  });

  it("leaves channels without evidence as they were: not a color", async () => {
    const { byName } = await tokens(project({ "app/globals.css": `:root {\n  --surface: #ffffff;\n  --mystery: 222 47% 11%;\n}\n` }));
    expect(byName.get("--mystery")).toMatchObject({ type: "other", role: "generic" });
    expect(byName.get("--mystery").format).toBeUndefined();
  });
});

describe("shadcn/ui projects", () => {
  it("reads the canonical tokens as colors with the shadcn roles, with components.json as the only evidence", async () => {
    const { byName, ds } = await tokens(project({ "app/globals.css": SHADCN, "components.json": `{ "style": "default" }\n` }));
    const roles = Object.fromEntries([...byName.values()].map((t) => [t.name, t.role]));
    expect(roles).toMatchObject({
      "--background": "surface.base",
      "--card": "surface.raised",
      "--popover": "surface.raised",
      "--foreground": "text.primary",
      "--card-foreground": "text.primary",
      "--popover-foreground": "text.primary",
      "--muted": "surface.raised",
      "--secondary": "surface.raised",
      "--accent": "surface.raised",
      "--muted-foreground": "text.secondary",
      "--secondary-foreground": "text.primary",
      "--accent-foreground": "text.primary",
      "--primary": "accent.primary",
      "--primary-foreground": "on-accent",
      "--destructive-foreground": "on-accent",
      "--destructive": "status.danger",
      "--border": "border.default",
      "--input": "border.default",
      "--ring": "border.default",
    });
    expect(byName.get("--chart-1")).toMatchObject({ type: "color", role: "generic" });
    expect(byName.get("--radius")).toMatchObject({ type: "length", role: "radius" });
    expect(ds.status).toBe("partial");
    expect(ds.coverage.requiredMissing).toEqual([]);
    expect(ds.assumptions.join(" ")).toMatch(/shadcn\/ui project \(components\.json\)/);
  });

  it("detects shadcn from the canonical pairs, and --muted-foreground is measured against --background in both themes", async () => {
    const dir = project({ "app/globals.css": SHADCN });
    const { byName } = await tokens(dir);
    expect(byName.get("--muted-foreground")).toMatchObject({ type: "color", role: "text.secondary", values: { light: "215.4 16.3% 46.9%", dark: "215 20.2% 65.1%" } });
    const ctx = createContext(dir);
    const ratio = (th: string) => contrast(tokenColor(ctx.tokens, "--muted-foreground", th)!, tokenColor(ctx.tokens, "--background", th)!);
    expect(ratio("light")).toBeCloseTo(4.76, 1);
    expect(ratio("dark")).toBeCloseTo(7.8, 1);
  });

  it("the config's roles win over the shadcn table", async () => {
    const { byName } = await tokens(project({ "app/globals.css": SHADCN, "facha-ui.config.json": JSON.stringify({ version: 1, tokens: { roles: { "--accent": "accent" } } }) }));
    expect(byName.get("--accent")?.role).toBe("accent");
  });

  it("applies the table to the sidebar set and to Tailwind 4 aliases, and nowhere else", () => {
    expect(shadcnRole("--sidebar")).toBe("surface.raised");
    expect(shadcnRole("--sidebar-primary-foreground")).toBe("on-accent");
    expect(shadcnRole("--color-muted-foreground")).toBe("text.secondary");
    expect(shadcnRole("--brand")).toBeUndefined();
  });

  it("a project that is not shadcn keeps the usual roles", async () => {
    const { byName } = await tokens(project({ "app/globals.css": `:root {\n  --surface: #ffffff;\n  --text: #0f172a;\n  --accent: #4f46e5;\n}\n` }));
    expect(byName.get("--accent")?.role).toBe("accent.primary");
  });
});
