#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { resolveWorkspace } from "./project.js";
import { createServer, VERSION } from "./server.js";

function argValue(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  if (i >= 0) return argv[i + 1];
  const eq = argv.find((a) => a.startsWith(`${name}=`));
  return eq ? eq.slice(name.length + 1) : undefined;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--version")) {
    process.stderr.write(`facha-ui-mcp ${VERSION}\n`);
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
