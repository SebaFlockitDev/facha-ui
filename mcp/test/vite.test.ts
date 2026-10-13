import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { openProject } from "../src/project.js";
import { readViteConfig } from "../src/vite-config.js";
import { connect } from "./helpers.js";

// React + Vite: framework detection, the lab's defaults and the static read of vite.config (SPEC §2.b.4).

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(HERE, "fixtures", "vite-react");
const SRC = path.join(HERE, "..", "src");
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

const VITE_PKG = JSON.stringify({ dependencies: { react: "18.3.1", "react-dom": "18.3.1" }, devDependencies: { vite: "5.4.10" } });

function project(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "facha-vite-"));
  dirs.push(dir);
  const all = { "package.json": VITE_PKG, "src/index.css": ":root { --surface: #fff; --text: #0f172a; }\n", ...files };
  for (const [name, text] of Object.entries(all)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), text);
  }
  return dir;
}

describe("vite-react fixture", () => {
  it("is detected as vite-react, with the lab in facha-lab/ on the port of vite.config", async () => {
    const c = await connect(FIXTURE);
    const ds = (await c.call("get_design_system", { sections: ["project"] })).structuredContent;
    await c.close();
    expect(ds.project.framework).toBe("vite-react");
    expect(ds.project.lab).toEqual({ dir: "facha-lab", urlPattern: "/facha-lab/?screen={screen}&v={variant}", liveRegistered: false });
    expect(ds.project.preview.baseUrl).toBe("http://localhost:5180");
    expect(ds.assumptions.join(" ")).toMatch(/Framework autodetected: vite-react/);
  });

  it("reads its design system and checks its screens like any other project", async () => {
    const c = await connect(FIXTURE);
    const ds = (await c.call("get_design_system")).structuredContent;
    const check = (await c.call("check_ui", { path: "src/pages/Orders.tsx" })).structuredContent;
    await c.close();
    expect(ds.status).not.toBe("missing");
    expect(ds.project.themes.map((t: any) => t.name)).toEqual(["light", "dark"]);
    expect(check.summary.error).toBe(0);
  });

  it("leaves the lab out of the project audit", async () => {
    const c = await connect(FIXTURE);
    const audit = (await c.call("audit_project")).structuredContent;
    await c.close();
    const files = JSON.stringify(audit);
    expect(files).not.toMatch(/facha-lab/);
  });
});

describe("the lab's defaults follow the framework", () => {
  it("uses Vite's default port when vite.config does not set one", () => {
    const p = openProject(project({ "vite.config.js": `export default { plugins: [] };\n` }));
    expect(p.framework).toBe("vite-react");
    expect(p.labDir).toBe("facha-lab");
    expect(p.config.preview.baseUrl).toBe("http://localhost:5173");
  });

  it("keeps what the team wrote in the config", () => {
    const config = JSON.stringify({ version: 1, lab: { dir: "src/lab" }, preview: { baseUrl: "http://localhost:4000" } });
    const p = openProject(project({ "facha-ui.config.json": config }));
    expect(p.labDir).toBe("src/lab");
    expect(p.config.preview.baseUrl).toBe("http://localhost:4000");
  });

  it("keeps the Next.js defaults for Next projects", () => {
    const dir = project({ "package.json": JSON.stringify({ dependencies: { next: "15.3.0", react: "19.0.0" } }), "app/page.tsx": "export default () => null;\n" });
    const p = openProject(dir);
    expect(p.framework).toBe("next-app");
    expect(p.labDir).toBe("app/lab");
    expect(p.config.preview.baseUrl).toBe("http://localhost:3000");
  });

  it("warns when vite.config would build the lab, and accepts build entries that leave it out", () => {
    const built = openProject(project({ "vite.config.ts": `export default { build: { rollupOptions: { input: { main: "index.html", lab: "facha-lab/index.html" } } } };\n` }));
    expect(built.assumptions.join(" ")).toMatch(/lists the lab \(facha-lab\/\) in build\.rollupOptions\.input/);
    const ok = openProject(project({ "vite.config.ts": `export default { build: { rollupOptions: { input: ["index.html", "admin.html"] } } };\n` }));
    expect(ok.assumptions.join(" ")).toMatch(/the lab \(facha-lab\/\) is not one of them/);
  });

  it("explains why there is no lab for Create React App, Next.js Pages Router and plain React", () => {
    const cra = openProject(project({ "package.json": JSON.stringify({ dependencies: { react: "18.3.1", "react-scripts": "5.0.1" } }) }));
    expect(cra.framework).toBe("unknown");
    expect(cra.assumptions.join(" ")).toMatch(/Create React App \(react-scripts\) has no lab/);
    const pages = openProject(project({ "package.json": JSON.stringify({ dependencies: { next: "14.2.0", react: "18.3.1" } }), "pages/index.tsx": "export default () => null;\n" }));
    expect(pages.assumptions.join(" ")).toMatch(/Pages Router\) has no lab yet/);
    const plain = openProject(project({ "package.json": JSON.stringify({ dependencies: { react: "18.3.1" } }) }));
    expect(plain.assumptions.join(" ")).toMatch(/no lab framework detected: variants need Next\.js \(App Router\) or Vite with React\. Checks, audit/);
  });

  it("lets the config name the framework", () => {
    const p = openProject(project({ "package.json": JSON.stringify({ dependencies: { react: "18.3.1" } }), "facha-ui.config.json": JSON.stringify({ version: 1, framework: "vite-react" }) }));
    expect(p.framework).toBe("vite-react");
    expect(p.labDir).toBe("facha-lab");
  });
});

describe("reading vite.config statically", () => {
  it("reads defineConfig({…}), and reports a config computed by a function instead of guessing", () => {
    const literal = readViteConfig({ root: project({ "vite.config.ts": `import { defineConfig } from "vite";\nexport default defineConfig({ server: { port: 4321 } });\n` }) })!;
    expect(literal).toMatchObject({ file: "vite.config.ts", port: 4321, inputs: null, unread: [] });
    const fn = readViteConfig({ root: project({ "vite.config.ts": `import { defineConfig } from "vite";\nexport default defineConfig(({ mode }) => ({ server: { port: 4321 } }));\n` }) })!;
    expect(fn.port).toBeNull();
    expect(fn.unread).toEqual([{ what: "the exported config is computed by a function", line: 2 }]);
  });

  it("S2 · a vite.config with side effects runs nothing", async () => {
    const marker = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "facha-marker-")), "ran.txt");
    dirs.push(path.dirname(marker));
    const code = `import fs from "node:fs";\nfs.writeFileSync(${JSON.stringify(marker)}, "ran");\nprocess.exit(4);\nexport default { server: { port: 6000 } };\n`;
    const c = await connect(project({ "vite.config.mjs": code }));
    const ds = (await c.call("get_design_system", { sections: ["project"] })).structuredContent;
    await c.close();
    expect(fs.existsSync(marker)).toBe(false);
    expect(ds.project.preview.baseUrl).toBe("http://localhost:6000");
  });

  it("S2 · the readers only parse: no require, dynamic import, eval, Function, vm or child processes", () => {
    for (const [file, expected] of [
      ["static-config.ts", ["@babel/parser"]],
      ["vite-config.ts", ["./project.js", "./static-config.js"]],
      ["tailwind-config.ts", ["./project.js", "./shadcn.js", "./static-config.js", "node:path"]],
    ] as const) {
      const code = fs.readFileSync(path.join(SRC, file), "utf8");
      const imports = [...code.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]);
      expect(imports.sort(), file).toEqual([...expected]);
      expect(code, file).not.toMatch(/\brequire\s*\(|\bimport\s*\(|createRequire|\beval\s*\(|new Function|node:vm|child_process|readFileSync/);
    }
  });
});
