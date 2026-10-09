#!/usr/bin/env node
// facha-ui · live mode watcher, run by /facha-ui:variants through Claude Code's Monitor tool.
// Usage: node live-watch.mjs <project>/.facha-ui/live
//
// Prints one JSON line per request typed in the lab's live panel, so each one wakes Claude Code.
// On start it also prints the requests that have no final status yet (none is lost when the
// monitor is re-armed). It exits, printing {"kind":"stopped"}, when the live session ends.
// It only reads files.
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve(process.argv[2] ?? ".facha-ui/live");
const requestsFile = path.join(dir, "requests.jsonl");
const sessionFile = path.join(dir, "session.json");
const statusFile = path.join(dir, "status.json");
const FINAL = new Set(["done", "needs-input", "failed", "chosen", "proposed"]);

const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
};

const active = () => {
  const s = readJson(sessionFile);
  return !!s && s.active === true && (!s.expiresAt || Date.parse(s.expiresAt) > Date.now());
};

const emit = (r) => {
  if (!r || typeof r.id !== "string") return;
  const line = { id: r.id, kind: r.kind, slug: r.slug, variant: r.variant, text: String(r.text ?? "").slice(0, 2000) };
  // Elements pointed at in the panel ([1], [2], [3] in the text), already cleaned by the endpoint.
  if (Array.isArray(r.targets) && r.targets.length) line.targets = r.targets.slice(0, 3);
  // A palette proposed from the panel: new values of existing tokens, per theme.
  if (r.kind === "palette" && r.palette && typeof r.palette === "object") line.palette = r.palette;
  process.stdout.write(JSON.stringify(line) + "\n");
};

const parseLines = (text) =>
  text
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    });

if (!active()) {
  process.stdout.write(JSON.stringify({ kind: "stopped" }) + "\n");
  process.exit(0);
}

// Requests left without a final status (for example while the monitor was being re-armed).
let offset = 0;
try {
  const text = fs.readFileSync(requestsFile, "utf8");
  offset = Buffer.byteLength(text);
  const done = readJson(statusFile)?.requests ?? {};
  for (const r of parseLines(text)) if (r && !FINAL.has(done[r.id]?.state)) emit(r);
} catch {
  /* no requests yet */
}

let pending = "";
setInterval(() => {
  if (!active()) {
    process.stdout.write(JSON.stringify({ kind: "stopped" }) + "\n");
    process.exit(0);
  }
  let size;
  try {
    size = fs.statSync(requestsFile).size;
  } catch {
    return;
  }
  if (size < offset) offset = 0; // the file was replaced
  if (size === offset) return;
  const fd = fs.openSync(requestsFile, "r");
  const chunk = Buffer.alloc(size - offset);
  fs.readSync(fd, chunk, 0, chunk.length, offset);
  fs.closeSync(fd);
  offset = size;
  pending += chunk.toString("utf8");
  const cut = pending.lastIndexOf("\n");
  if (cut < 0) return;
  const complete = pending.slice(0, cut);
  pending = pending.slice(cut + 1);
  for (const r of parseLines(complete)) emit(r);
}, 500);
