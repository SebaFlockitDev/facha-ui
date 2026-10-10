import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { connect, FIXTURE } from "./helpers.js";

const MCP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = path.resolve(MCP_DIR, "..");

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(abs));
    else out.push(abs);
  }
  return out.sort();
}

function treeHash(dir: string): string {
  const h = crypto.createHash("sha256");
  for (const f of listFiles(dir)) {
    const st = fs.statSync(f);
    h.update(path.relative(dir, f)).update(String(st.size)).update(String(st.mtimeMs)).update(fs.readFileSync(f));
  }
  for (const d of fs.readdirSync(dir)) h.update(d);
  return h.digest("hex");
}

function chmodTree(dir: string, fileMode: number, dirMode: number) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) {
      chmodTree(abs, fileMode, dirMode);
      fs.chmodSync(abs, dirMode);
    } else fs.chmodSync(abs, fileMode);
  }
  fs.chmodSync(dir, dirMode);
}

describe("MCP-2 · read-only", () => {
  it("runs every tool and resource on a read-only copy and leaves it byte-identical", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "facha-ro-"));
    const copy = path.join(tmp, "project");
    fs.cpSync(FIXTURE, copy, { recursive: true });
    chmodTree(copy, 0o444, 0o555);
    const before = treeHash(copy);
    const h = await connect(copy);
    try {
      for (const [name, args] of [
        ["get_design_system", {}],
        ["check_ui", { path: "." }],
        ["check_ui", { path: "app/page.tsx" }],
        ["audit_project", {}],
        ["scan_styles", {}],
        ["review_ui", { path: "." }],
        ["ux_score", {}],
      ] as const) {
        const r = await h.call(name, args);
        expect(r.isError, `${name} failed: ${r.content[0]?.text}`).toBeFalsy();
      }
      for (const uri of ["facha-ui://design-system/tokens", "facha-ui://design-system/rules"]) {
        const r = await h.client.readResource({ uri });
        expect(String((r.contents[0] as { text?: string })?.text ?? "").length).toBeGreaterThan(10);
      }
    } finally {
      await h.close();
    }
    expect(treeHash(copy)).toBe(before);
    chmodTree(copy, 0o644, 0o755);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("MCP-3 · source never imports write, process or network APIs", () => {
    const forbidden = [
      /from\s+["'](node:)?(child_process|net|http|https|http2|dgram|tls|worker_threads)["']/,
      /\bfetch\s*\(/,
      /\b(writeFile|writeFileSync|appendFile|appendFileSync|mkdir|mkdirSync|rm|rmSync|rmdir|rmdirSync|unlink|unlinkSync|rename|renameSync|copyFile|copyFileSync|cpSync|createWriteStream|chmod|chmodSync|truncate|truncateSync)\s*\(/,
    ];
    const offenders: string[] = [];
    for (const f of listFiles(path.join(MCP_DIR, "src"))) {
      const text = fs.readFileSync(f, "utf8");
      text.split("\n").forEach((line, i) => {
        if (forbidden.some((re) => re.test(line))) offenders.push(`${path.relative(MCP_DIR, f)}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});

// Terms that identify the projects facha-ui was tried on (names, routes, token values) are
// private, so they come from the environment: FACHA_UI_BANNED_TERMS="term1,term2,…".
const BANNED_TERMS = (process.env.FACHA_UI_BANNED_TERMS ?? "")
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean);

describe("MCP-7 · nothing from the test projects is hardcoded", () => {
  it.skipIf(BANNED_TERMS.length === 0)("the plugin, its tests and its docs do not mention the test projects", () => {
    const banned = new RegExp(BANNED_TERMS.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "i");
    const dirs = [path.join(MCP_DIR, "src"), path.join(MCP_DIR, "test"), path.join(REPO, "skills"), path.join(REPO, "agents"), path.join(REPO, "docs")].filter((d) => fs.existsSync(d));
    const rootDocs = ["README.md", "SPEC.md", "CLAUDE.md", "CHANGELOG.md"].map((f) => path.join(REPO, f)).filter((f) => fs.existsSync(f));
    const offenders: string[] = [];
    for (const f of [...dirs.flatMap((d) => listFiles(d)), ...rootDocs]) {
      if (/\.(png|jpe?g|gif|webp|ico)$/i.test(f)) continue;
      fs.readFileSync(f, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (banned.test(line)) offenders.push(`${path.relative(REPO, f)}:${i + 1}: ${line.trim()}`);
        });
    }
    expect(offenders).toEqual([]);
  });
});

describe("APP-1 · apply cannot be invoked by the model", () => {
  it("skills/apply/SKILL.md sets disable-model-invocation and pre-approves no write tools", () => {
    const text = fs.readFileSync(path.join(REPO, "skills", "apply", "SKILL.md"), "utf8");
    const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
    expect(frontmatter).toMatch(/^disable-model-invocation:\s*true\s*$/m);
    const allowed = frontmatter.match(/^allowed-tools:\s*(.*)$/m)?.[1] ?? "";
    expect(allowed.split(",").map((t) => t.trim())).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/^(Write|Edit|Bash|MultiEdit|NotebookEdit)\b/)]),
    );
  });
});
