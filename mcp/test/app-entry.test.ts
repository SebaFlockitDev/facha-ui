import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { readAppEntry } from "../src/app-entry.js";
import { openProject } from "../src/project.js";

// The app entry of a Vite project, read statically for the lab's providers.tsx (B-002, SPEC §7.28).

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

const PKG = JSON.stringify({ dependencies: { react: "18.3.1", "react-dom": "18.3.1" }, devDependencies: { vite: "5.4.10" } });
const HTML = `<!doctype html><html><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>\n`;

function project(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "facha-entry-"));
  dirs.push(dir);
  for (const [name, text] of Object.entries({ "package.json": PKG, "index.html": HTML, ...files })) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), text);
  }
  return dir;
}

const REACT_QUERY = `import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import "./theme.css";

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
`;

describe("reading the app entry", () => {
  it("lists the global CSS and the providers around <App />, with a local QueryClient that is not exported", () => {
    const e = readAppEntry({ root: project({ "src/main.tsx": REACT_QUERY }) })!;
    expect(e.file).toBe("src/main.tsx");
    expect(e.css).toEqual(["./index.css", "./theme.css"]);
    expect(e.providers.map((p) => `${p.kind}:${p.name}:${p.module}`)).toEqual([
      "strict:React.StrictMode:react",
      "query-cache:QueryClientProvider:@tanstack/react-query",
      "router:BrowserRouter:react-router-dom",
    ]);
    expect(e.providers[1]!.props.client).toEqual({
      text: "queryClient",
      origin: "local",
      exported: false,
      init: "new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } })",
    });
    expect(e.app).toEqual({ name: "App", module: "./App" });
    expect(e.unread).toEqual([]);
  });

  it("knows an imported store, a provider declared in the entry and an exported instance", () => {
    const code = `import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { store } from "./store";
import { ThemeProvider } from "./theme";
import App from "./App";
export const theme = { mode: "light" };
function Auth({ children }: { children: React.ReactNode }) { return <>{children}</>; }
createRoot(document.getElementById("root")!).render(
  <Provider store={store}>
    <ThemeProvider value={theme}>
      <Auth>
        <App />
      </Auth>
    </ThemeProvider>
  </Provider>,
);
`;
    const e = readAppEntry({ root: project({ "src/main.tsx": code }) })!;
    expect(e.providers.map((p) => `${p.kind}:${p.name}:${p.module}`)).toEqual(["provider:Provider:react-redux", "provider:ThemeProvider:./theme", "provider:Auth:local"]);
    expect(e.providers[0]!.props.store).toEqual({ text: "store", origin: "import", module: "./store" });
    expect(e.providers[1]!.props.value).toMatchObject({ text: "theme", origin: "local", exported: true });
  });

  it("treats a RouterProvider as the app, and reads the legacy ReactDOM.render and a custom entry path", () => {
    const code = `import ReactDOM from "react-dom";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./query";
const router = createBrowserRouter([]);
ReactDOM.render(<QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>, document.getElementById("root"));
`;
    const html = HTML.replace("/src/main.tsx", "/src/entry.tsx");
    const e = readAppEntry({ root: project({ "index.html": html, "src/entry.tsx": code }) })!;
    expect(e.file).toBe("src/entry.tsx");
    expect(e.providers.map((p) => p.kind)).toEqual(["query-cache"]);
    expect(e.providers[0]!.props.client).toEqual({ text: "queryClient", origin: "import", module: "./query" });
    expect(e.app).toEqual({ name: "RouterProvider", module: "react-router-dom" });
  });

  it("says what it could not follow instead of guessing", () => {
    const code = `import { createRoot } from "react-dom/client";
import App from "./App";
const props = { a: 1 };
createRoot(document.getElementById("root")!).render(<Shell {...props}><Toaster /><App /></Shell>);
`;
    const e = readAppEntry({ root: project({ "src/main.tsx": code }) })!;
    expect(e.unread.map((u) => u.what)).toEqual(["a spread of props on <Shell>", "<Shell> wraps more than the app; only its first element is followed"]);
  });

  it("is in get_design_system for Vite projects only", () => {
    const vite = openProject(project({ "src/main.tsx": REACT_QUERY }));
    expect(vite.labEntry?.providers.length).toBe(3);
    const next = project({ "package.json": JSON.stringify({ dependencies: { next: "15.3.0", react: "19.0.0" } }), "app/page.tsx": "export default () => null;\n" });
    expect(openProject(next).labEntry).toBeUndefined();
  });
});

describe("S2 · the entry is parsed, never run", () => {
  it("an entry with side effects runs nothing", () => {
    const marker = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "facha-marker-")), "ran.txt");
    dirs.push(path.dirname(marker));
    const code = `import fs from "node:fs";\nfs.writeFileSync(${JSON.stringify(marker)}, "ran");\nprocess.exit(5);\n${REACT_QUERY}`;
    const e = readAppEntry({ root: project({ "src/main.tsx": code }) })!;
    expect(fs.existsSync(marker)).toBe(false);
    expect(e.providers.length).toBe(3);
  });

  it("the reader only parses: no require, dynamic import, eval, Function, vm or child processes", () => {
    const code = fs.readFileSync(path.join(SRC, "app-entry.ts"), "utf8");
    const imports = [...code.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]);
    expect(imports.sort()).toEqual(["./project.js", "./static-config.js"]);
    expect(code).not.toMatch(/\brequire\s*\(|\bimport\s*\(|createRequire|\beval\s*\(|new Function|node:vm|child_process|readFileSync/);
  });
});
