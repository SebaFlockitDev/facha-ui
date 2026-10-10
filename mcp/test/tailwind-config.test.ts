import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { openProject } from "../src/project.js";
import { readTailwindConfig } from "../src/tailwind-config.js";
import { connect } from "./helpers.js";

// Tailwind 3: the theme mapping is read from tailwind.config statically, never by running it (S2).

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

const CSS = `@tailwind base;\n@layer base {\n  :root {\n    --background: 0 0% 100%;\n    --foreground: 222.2 84% 4.9%;\n    --primary: 222.2 47.4% 11.2%;\n    --primary-foreground: 210 40% 98%;\n    --border: 214.3 31.8% 91.4%;\n    --radius: 0.5rem;\n  }\n}\n`;

const SHADCN_CONFIG = `import type { Config } from "tailwindcss";

const config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

export default config;
`;

function project(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "facha-tw3-"));
  dirs.push(dir);
  const all: Record<string, string> = {
    "package.json": JSON.stringify({ dependencies: { next: "14.2.0", react: "18.3.1" }, devDependencies: { tailwindcss: "3.4.17" } }),
    "app/globals.css": CSS,
    ...files,
  };
  for (const [name, text] of Object.entries(all)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), text);
  }
  return dir;
}

describe("reading tailwind.config statically", () => {
  it("reads the shadcn/ui mapping: nested colors with DEFAULT, radius steps, and says plugins were not read", () => {
    const m = readTailwindConfig(openProject(project({ "tailwind.config.ts": SHADCN_CONFIG })))!;
    expect(m.file).toBe("tailwind.config.ts");
    expect([...m.mapped].sort()).toEqual(["--color-background", "--color-border", "--color-foreground", "--color-primary", "--color-primary-foreground", "--radius-lg", "--radius-md", "--radius-sm"]);
    expect(m.unread).toEqual([{ what: "plugins (what they add is not known without running them)", line: 24 }]);
  });

  it("reads module.exports and theme keys outside extend", () => {
    const cjs = `module.exports = {\n  theme: {\n    boxShadow: { card: "0 1px 2px var(--shadow)" },\n    fontSize: { body: ["15px", "22px"] },\n    extend: { letterSpacing: { caps: "0.08em" } },\n  },\n};\n`;
    const m = readTailwindConfig(openProject(project({ "tailwind.config.js": cjs })))!;
    expect([...m.mapped].sort()).toEqual(["--shadow-card", "--text-body", "--tracking-caps"]);
    expect(m.unread).toEqual([]);
  });

  it("reports what needs evaluation, with its line, instead of guessing", () => {
    const code = `const base = require("./base");\nmodule.exports = {\n  presets: [base],\n  theme: {\n    colors: ({ colors }) => colors,\n    extend: {\n      borderRadius: { ...base.radius, card: "12px" },\n      [\`fontSize\`]: {},\n    },\n  },\n};\n`;
    const m = readTailwindConfig(openProject(project({ "tailwind.config.js": code })))!;
    expect([...m.mapped]).toEqual(["--radius-card"]);
    expect(m.unread.map((u) => `${u.line} ${u.what}`)).toEqual([
      "3 presets (what they add is not known without running them)",
      "5 theme.colors (a function)",
      "7 a spread in theme.extend.borderRadius",
    ]);
  });

  it("follows @config from the CSS when there is no config at the root", () => {
    const m = readTailwindConfig(openProject(project({ "config/tw.config.js": `module.exports = { theme: { extend: { borderRadius: { md: "6px" } } } };\n` })), ["config/tw.config.js"])!;
    expect(m.file).toBe("config/tw.config.js");
    expect([...m.mapped]).toEqual(["--radius-md"]);
  });
});

describe("check_ui with a Tailwind 3 mapping", () => {
  it("does not mark mapped utilities and still marks what is not mapped", async () => {
    const page = `export default function Page() {\n  return (\n    <main className="bg-background text-foreground">\n      <button className="bg-primary text-primary-foreground rounded-md">Guardar pedido</button>\n      <p className="rounded-xl text-[#1e293b]">Hola</p>\n    </main>\n  );\n}\n`;
    const c = await connect(project({ "tailwind.config.ts": SHADCN_CONFIG, "components.json": "{}", "app/page.tsx": page }));
    const r = (await c.call("check_ui", { path: "app/page.tsx" })).structuredContent;
    const ds = (await c.call("get_design_system", { sections: ["project"] })).structuredContent;
    await c.close();
    expect(r.violations.map((v: any) => `${v.rule} ${v.found}`).sort()).toEqual(["color-literal text-[#1e293b]", "tailwind-default-scale rounded-xl"]);
    expect(ds.assumptions.join(" ")).toMatch(/Tailwind config read statically \(tailwind\.config\.ts, never run\): 8 utilities/);
    expect(ds.assumptions.join(" ")).toMatch(/Not read in tailwind\.config\.ts without running it: plugins/);
  });

  it("tailwind.mapped in the config covers what cannot be read", async () => {
    const page = `export default () => <div className="shadow-md rounded-lg">x</div>;\n`;
    const config = JSON.stringify({ version: 1, tailwind: { mapped: ["--shadow-md", "--radius-lg"] } });
    const c = await connect(project({ "app/page.tsx": page, "facha-ui.config.json": config }));
    const r = (await c.call("check_ui", { path: "app/page.tsx" })).structuredContent;
    const ds = (await c.call("get_design_system", { sections: ["project"] })).structuredContent;
    await c.close();
    expect(r.violations).toEqual([]);
    expect((ds.assumptions ?? []).join(" ")).not.toMatch(/tailwind\.mapped/);
  });
});

describe("S2 · tailwind.config is parsed, never run", () => {
  it("a config with side effects runs nothing, and its mapping is still read", async () => {
    const marker = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "facha-marker-")), "ran.txt");
    dirs.push(path.dirname(marker));
    const m = JSON.stringify(marker);
    const cjs = `require("fs").writeFileSync(${m}, "cjs");\nprocess.exit(3);\nmodule.exports = { theme: { extend: { borderRadius: { md: "6px" } } } };\n`;
    const esm = `import fs from "node:fs";\nfs.writeFileSync(${m}, "esm");\nawait import("node:child_process").then((cp) => cp.execSync("exit 1"));\nthrow new Error("ran");\nexport default { theme: { extend: { borderRadius: { md: "6px" } } } };\n`;
    for (const [name, code] of [["tailwind.config.js", cjs], ["tailwind.config.mjs", esm]] as const) {
      const dir = project({ [name]: code, "app/page.tsx": `export default () => <div className="rounded-md">x</div>;\n` });
      const c = await connect(dir);
      const r = (await c.call("check_ui", { path: "app/page.tsx" })).structuredContent;
      await c.close();
      expect(fs.existsSync(marker), name).toBe(false);
      expect(r.violations, name).toEqual([]);
    }
  });

  it("the reader only parses: no require, dynamic import, eval, Function, vm or child processes", () => {
    const code = fs.readFileSync(path.join(SRC, "tailwind-config.ts"), "utf8");
    const imports = [...code.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]);
    expect(imports.sort()).toEqual(["./project.js", "./shadcn.js", "@babel/parser", "node:path"]);
    expect(code).not.toMatch(/\brequire\s*\(|\bimport\s*\(|createRequire|\beval\s*\(|new Function|node:vm|child_process|readFileSync/);
  });
});
