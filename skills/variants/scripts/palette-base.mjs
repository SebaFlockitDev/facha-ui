#!/usr/bin/env node
// facha-ui · palette base for the lab's live panel, run by /facha-ui:variants.
// Usage: node palette-base.mjs <project root> [--anchor <token>]
//
// Prints the JSON of `.facha-ui/live/palette.json`: the project's themes (name and selector) and
// its color tokens with their value per theme, as get_design_system reports them. The panel uses
// it to preview other palettes in the browser. It only reads: Claude Code writes the output with
// its Write tool. Status colors, fonts, radii and other non-color tokens are left out.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const root = args[0];
const anchorArg = args.includes("--anchor") ? args[args.indexOf("--anchor") + 1] : null;
if (!root) {
  process.stderr.write("Usage: node palette-base.mjs <project root> [--anchor <token>]\n");
  process.exit(2);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const server = path.resolve(here, "..", "..", "..", "mcp", "dist", "facha-ui-mcp.js");
const child = spawn(process.execPath, [server, "--root", root], { stdio: ["pipe", "pipe", "inherit"] });

let buffer = "";
const waiting = new Map();
child.stdout.on("data", (chunk) => {
  buffer += chunk;
  let i;
  while ((i = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, i);
    buffer = buffer.slice(i + 1);
    try {
      const message = JSON.parse(line);
      waiting.get(message.id)?.(message);
    } catch {
      /* not a JSON-RPC line */
    }
  }
});
let next = 0;
const rpc = (method, params) =>
  new Promise((resolve) => {
    const id = ++next;
    waiting.set(id, resolve);
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });

await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "palette-base", version: "1" } });
child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
const reply = await rpc("tools/call", { name: "get_design_system", arguments: { sections: ["project", "tokens", "gaps"] } });
child.kill();

const ds = reply.result?.structuredContent;
if (!ds?.project) {
  process.stderr.write(`get_design_system failed: ${JSON.stringify(reply.error ?? reply.result)}\n`);
  process.exit(1);
}

const COLOR = /#[0-9a-fA-F]{3,8}\b|rgba?\(/;
const SKIP_ROLE = /^(status|font|radius|space|size|z|motion)/;
const tokens = (ds.tokens ?? [])
  .filter((t) => !SKIP_ROLE.test(t.role ?? "") && Object.values(t.values ?? {}).some((v) => COLOR.test(String(v))))
  .map((t) => ({ name: t.name, role: t.role, values: t.values }));

const anchor =
  anchorArg ??
  tokens.find((t) => t.role === "accent.primary" && /brand|primary|marca/i.test(t.name))?.name ??
  tokens.find((t) => t.role === "accent.primary")?.name ??
  null;
if (!anchor || !tokens.some((t) => t.name === anchor)) {
  process.stderr.write("No brand color token found: pass --anchor <token>.\n");
  process.exit(1);
}

const themes = (ds.project.themes ?? []).map((t) => ({ name: t.name, selector: t.selector }));
// Hand-written colors (design-system gaps): the panel warns when a palette is confused with them
// or leaves them behind.
const PLAIN = /^(#[0-9a-fA-F]{3,8}|rgba?\([\d\s.,%/]+\))$/;
const references = (ds.gaps ?? [])
  .filter((g) => g.kind === "literal-without-token" && typeof g.where === "string")
  .map((g) => ({ where: g.where.slice(0, 120), values: (g.values ?? []).filter((v) => PLAIN.test(String(v).trim())).slice(0, 4) }))
  .filter((r) => r.values.length)
  .slice(0, 40);
process.stdout.write(JSON.stringify({ version: 1, anchor, themes, tokens, references }, null, 2) + "\n");
process.exit(0);
