#!/usr/bin/env node
import fs from "node:fs";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createContext } from "./context.js";
import { resolveWorkspace } from "./project.js";
import { regressions, uxScore } from "./score.js";
import { createServer, VERSION } from "./server.js";

function argValue(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  if (i >= 0) return argv[i + 1];
  const eq = argv.find((a) => a.startsWith(`${name}=`));
  return eq ? eq.slice(name.length + 1) : undefined;
}

/**
 * `facha-ui-mcp score [--root <dir>] [--path <screen|dir>] [--baseline <file>] [--min <n>]`
 * Prints the UX score as JSON on stdout (redirect it to a file to make a baseline). Exits with 1
 * when a screen scores below its baseline or below --min: CI fails when the UX gets worse. It
 * only reads files.
 */
function score(argv: string[]): number {
  const workspace = resolveWorkspace({ argRoot: argValue(argv, "--root") });
  const ctx = createContext(workspace.root, workspace);
  const result = uxScore(ctx, argValue(argv, "--path"));
  const baselineFile = argValue(argv, "--baseline");
  const min = argValue(argv, "--min");
  const down = baselineFile && fs.existsSync(baselineFile) ? regressions(result, JSON.parse(fs.readFileSync(baselineFile, "utf8"))) : [];
  const low = min ? result.screens.filter((s) => s.score < Number(min)).map((s) => ({ screen: s.screen, score: s.score })) : [];
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  for (const r of down) process.stderr.write(`UX score went down: ${r.screen} ${r.before} → ${r.after}\n`);
  for (const l of low) process.stderr.write(`UX score below ${min}: ${l.screen} ${l.score}\n`);
  if (!down.length && !low.length) process.stderr.write(`UX score: ${result.screens.length} screen(s), average ${result.average ?? "-"}/100.\n`);
  return down.length || low.length ? 1 : 0;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--version")) {
    process.stderr.write(`facha-ui-mcp ${VERSION}\n`);
    return;
  }
  if (argv[0] === "score") {
    process.exitCode = score(argv.slice(1));
    return;
  }
  const workspace = resolveWorkspace({ argRoot: argValue(argv, "--root") });
  const root = workspace.root;
  const server = createServer({ root, workspace });
  await server.connect(new StdioServerTransport());
  // stdout belongs to the MCP protocol: diagnostics go to stderr.
  process.stderr.write(`facha-ui-mcp ${VERSION} ready · root: ${root}\n`);
}

main().catch((e) => {
  process.stderr.write(`facha-ui-mcp failed to start: ${(e as Error)?.message ?? e}\n`);
  process.exit(1);
});
