import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { createContext } from "../src/context.js";
import { projectScreens } from "../src/screens.js";
import { connect } from "./helpers.js";

// Which files are screens (B-043): Next by page.tsx, Vite by its router and its conventional folders.

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const ROUTER = path.join(FIXTURES, "vite-router");
const VITE = path.join(FIXTURES, "vite-react");
const NEXT = path.join(FIXTURES, "next-ux");
const BUNDLE = path.join(FIXTURES, "..", "..", "dist", "facha-ui-mcp.js");
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});
const screensOf = (root: string) => Object.fromEntries([...projectScreens(createContext(root)).values()].map((s) => [s.file, s.route]));
const copy = (from: string) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "facha-screens-"));
  fs.cpSync(from, dir, { recursive: true });
  dirs.push(dir);
  return dir;
};

describe("screens · Vite (B-043)", () => {
  it("finds what the router mounts, with its absolute path, and the conventional folders", () => {
    expect(screensOf(ROUTER)).toEqual({
      "src/features/home/HomePage.tsx": null, // an index route: no path written
      "src/features/settings/SettingsPage.tsx": "/settings", // lazy, inside <Suspense>
      "src/features/reports/route.tsx": "/reports", // a lazy route module
      "src/features/team/Team.tsx": "/team", // Component: Team
      "src/views/Profile.tsx": null, // a conventional folder
    });
  });

  it("leaves out layouts, private files and tests", () => {
    const found = Object.keys(screensOf(ROUTER));
    for (const not of ["src/components/Shell.tsx", "src/pages/_layout.tsx", "src/pages/Profile.stories.tsx", "src/main.tsx"]) expect(found, not).not.toContain(not);
  });

  it("reads <Route element={<X />}> and keeps the most specific of its paths", () => {
    expect(screensOf(VITE)).toEqual({ "src/pages/Orders.tsx": "/orders" });
  });

  it("the config's screens globs replace the detection", () => {
    const dir = copy(ROUTER);
    fs.writeFileSync(path.join(dir, "facha-ui.config.json"), JSON.stringify({ version: 1, screens: ["src/views/**/*.tsx"] }));
    expect(screensOf(dir)).toEqual({ "src/views/Profile.tsx": null });
  });
});

describe("screens · Next stays the same", () => {
  it("every page.tsx is a screen, with its route from the folders", () => {
    const screens = screensOf(NEXT);
    expect(Object.keys(screens).every((f) => f.endsWith("/page.tsx"))).toBe(true);
    expect(screens["app/flow/new/page.tsx"]).toBe("/flow/new");
  });
});

describe("ux_score and review_ui with Vite screens", () => {
  it("ux_score measures the router's screens, with their route", async () => {
    const h = await connect(ROUTER);
    try {
      const r = (await h.call("ux_score", {})).structuredContent;
      expect(r.screens.map((s: any) => [s.screen, s.route])).toEqual([
        ["src/features/home/HomePage.tsx", null],
        ["src/features/reports/route.tsx", "/reports"],
        ["src/features/settings/SettingsPage.tsx", "/settings"],
        ["src/features/team/Team.tsx", "/team"],
        ["src/views/Profile.tsx", null],
      ]);
      expect(r.average).toBeTypeOf("number");
    } finally {
      await h.close();
    }
  });

  it("a file passed explicitly is always measured, also a component", async () => {
    const h = await connect(ROUTER);
    try {
      const r = (await h.call("ux_score", { path: "src/components/Shell.tsx" })).structuredContent;
      expect(r.screens.map((s: any) => s.screen)).toEqual(["src/components/Shell.tsx"]);
    } finally {
      await h.close();
    }
  });

  it("review_ui asks a Vite screen for its title and states, and not a component", async () => {
    const h = await connect(ROUTER);
    try {
      const team = (await h.call("review_ui", { path: "src/features/team/Team.tsx" })).structuredContent;
      expect(team.findings.map((f: any) => f.heuristic)).toContain("headings");
      expect(team.files[0].states).not.toBeNull();
      const shell = (await h.call("review_ui", { path: "src/components/Shell.tsx" })).structuredContent;
      expect(shell.files[0].states).toBeNull();
    } finally {
      await h.close();
    }
  });

  it("the CI gate fails when a Vite screen goes down", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "facha-score-"));
    dirs.push(dir);
    const baseline = path.join(dir, "baseline.json");
    fs.writeFileSync(baseline, JSON.stringify({ screens: [{ screen: "src/pages/Orders.tsx", score: 100 }] }));
    const r = spawnSync(process.execPath, [BUNDLE, "score", "--root", VITE, "--baseline", baseline], { encoding: "utf8" });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("UX score went down: src/pages/Orders.tsx 100 →");
  });
});
