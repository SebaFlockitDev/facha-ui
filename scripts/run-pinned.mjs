#!/usr/bin/env node
// Runs an npm package pinned to an exact version: node run-pinned.mjs <pkg@x.y.z> [args...]
//
// Used by .mcp.json so the same config works on Windows, macOS and Linux. It runs npm's own
// npx-cli.js with the current node, without a shell: on Windows that avoids `cmd /c` and the
// quoting problems of paths with spaces. stdio is passed through untouched (MCP over stdio).
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** `name@1.2.3` or `@scope/name@1.2.3-beta.1`. Ranges, tags (`latest`) and bare names are rejected. */
export function isExactSpec(spec) {
  return /^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*@\d+\.\d+\.\d+(-[0-9a-z.-]+)?(\+[0-9a-z.-]+)?$/i.test(spec ?? "");
}

/** npm ships npx-cli.js next to node: <dir>/node_modules/npm (Windows) or <dir>/../lib/node_modules/npm (Unix). */
export function findNpxCli(execPath = process.execPath) {
  const dir = path.dirname(execPath);
  return [
    path.join(dir, "node_modules", "npm", "bin", "npx-cli.js"),
    path.join(dir, "..", "lib", "node_modules", "npm", "bin", "npx-cli.js"),
  ].find((candidate) => fs.existsSync(candidate));
}

function main() {
  const [spec, ...rest] = process.argv.slice(2);
  if (!isExactSpec(spec)) {
    process.stderr.write(
      `run-pinned: "${spec ?? ""}" is not an exact version. Use <package>@<major.minor.patch> (no ranges, no tags like @latest).\n`,
    );
    process.exit(2);
  }
  const npxCli = findNpxCli();
  const child = npxCli
    ? spawn(process.execPath, [npxCli, "-y", spec, ...rest], { stdio: "inherit" })
    : spawn("npx", ["-y", spec, ...rest], { stdio: "inherit" }); // Unix installs where npm lives elsewhere
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
  child.on("error", (error) => {
    process.stderr.write(`run-pinned: could not start npx: ${error.message}\n`);
    process.exit(1);
  });
  child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
