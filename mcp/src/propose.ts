import { converter, formatHex, type Color } from "culori";
import { scanFiles } from "./check.js";
import { alphaOf, contrast, parseColor, round, toHex } from "./color.js";
import type { Context } from "./context.js";
import { coverage } from "./design-system.js";
import { listProjectFiles } from "./project.js";
import type { DeclUsage } from "./sources/usage.js";
import { tokenColor } from "./tokens.js";

/**
 * scan_styles (SPEC §3.3, init contract): inventories the style literals a project already uses
 * and turns them into token proposals. Everything is derived from usages, never invented: the
 * default-theme value is the literal in use; another theme reuses a value the project already
 * declares for it, or derives one deterministically and says how. Read-only and deterministic.
 */

type Part = "bg" | "fg" | "border" | "other";

interface Occurrence {
  file: string;
  line: number;
  column: number;
  found: string;
  property: string | null;
  selector: string | null;
  /** Background declared in the same CSS rule (raw value), to measure text against it. */
  siblingBackground: string | null;
}

interface Group {
  part: Part;
  hex: string;
  color: Color;
  occurrences: Occurrence[];
  /** Base selectors (theme prefix removed) where the literal is used. */
  selectors: Set<string>;
  /** Literal values the project declares for another theme on the same selector and part. */
  themeValues: Map<string, { hex: string; occurrences: Occurrence[] }>;
}

interface Value {
  value: string;
  origin: "in-use" | "derived";
  method?: string;
}

const toOklch = converter("oklch");
const WHERE_LIMIT = 12;

/** Semantic hints in selectors. Order matters: "unpaid" must read as danger before "paid". */
const KINDS: [string, RegExp][] = [
  ["danger", /danger|error|unpaid|fail|cancel|reject|destructive|invalid|negative|overdue/],
  ["warning", /warn|pending|review|caution|attention/],
  ["success", /success|paid|(^|[^a-z])ok([^a-z]|$)|done|complete|approved|positive/],
  ["info", /info|sent|notice|hint/],
  ["neutral", /inactive|neutral|archiv/],
];

function partOf(property: string | null): Part {
  const p = (property ?? "").toLowerCase();
  if (["color", "fill", "stroke", "caret-color", "text-decoration-color"].includes(p)) return "fg";
  if (p.startsWith("background")) return "bg";
  if (p.startsWith("border") || p.startsWith("outline")) return "border";
  return "other";
}

const PART_SUFFIX: Record<Part, string> = { bg: "bg", fg: "fg", border: "border", other: "color" };

/** Selector without pseudo-classes/elements, so ":not(:disabled)" is not read as a meaning. */
function withoutPseudo(selector: string): string {
  return selector.replace(/::?[\w-]+(\((?:[^()]|\([^()]*\))*\))?/g, "");
}

function stemOf(selector: string | null): string {
  const cls = selector ? withoutPseudo(selector).match(/\.([A-Za-z][\w-]*)/)?.[1] : undefined;
  if (!cls) return "color";
  return cls.replace(/_/g, "-").replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

function kindOf(selector: string): string | null {
  const t = withoutPseudo(selector).toLowerCase();
  for (const [kind, re] of KINDS) if (re.test(t)) return kind;
  return null;
}

function hex(c: Color): string {
  return toHex(c).toLowerCase();
}

function oklch(l: number, c: number, h: number | undefined): Color {
  return { mode: "oklch", l: Math.min(1, Math.max(0, l)), c: Math.max(0, c), h: h ?? 0 } as Color;
}

/** Sorted values merged into steps when consecutive ones are within `tolerance` of the step start. */
function consolidate(values: [number, string[]][], tolerance: number) {
  const steps: { value: number; merged: number[]; uses: string[] }[] = [];
  for (const [v, uses] of [...values].sort(([a], [b]) => a - b)) {
    const last = steps[steps.length - 1];
    if (last && v - last.merged[0]! <= tolerance) {
      last.merged.push(v);
      last.uses.push(...uses);
      const countOf = (x: number) => values.find(([y]) => y === x)![1].length;
      if (countOf(v) > countOf(last.value)) last.value = v;
    } else steps.push({ value: v, merged: [v], uses: [...uses] });
  }
  return steps;
}

export function scanStyles(ctx: Context) {
  const themes = ctx.tokens.themes;
  const defaultTheme = themes[0]?.name ?? "light";
  const minRatio = ctx.project.config.contrast?.minRatio ?? 4.5;
  const cov = coverage(ctx);

  // Reference surface per theme: contrast.surfaces[0], else a raised surface, else a base surface.
  const surfaceName =
    ctx.project.config.contrast?.surfaces?.[0] ??
    ctx.tokens.tokens.find((t) => t.role === "surface.raised")?.name ??
    ctx.tokens.tokens.find((t) => t.role === "surface.base")?.name ??
    null;
  const surfaceIn = (theme: string): Color =>
    (surfaceName ? tokenColor(ctx.tokens, surfaceName, theme) : undefined) ??
    (parseColor(theme === defaultTheme ? "#ffffff" : "#111111") as Color);
  const accentName = ctx.tokens.tokens.find((t) => t.role === "accent.primary")?.name ?? null;

  /** Color of a raw CSS value in a theme: var(--token) resolved, or a literal. */
  const colorOfValue = (raw: string | null, theme: string): Color | undefined => {
    if (!raw) return undefined;
    const v = raw.trim().match(/^var\(\s*(--[\w-]+)\s*\)$/);
    if (v) return tokenColor(ctx.tokens, v[1]!, theme);
    return parseColor(raw);
  };

  /** Theme of a selector scoped by a non-default theme selector (e.g. "html.dark .chip"). */
  const themeScope = (selector: string | null): { theme: string | null; base: string | null } => {
    if (!selector) return { theme: null, base: null };
    for (const th of themes.slice(1)) {
      const prefix = th.selector.trim() + " ";
      if (selector.startsWith(prefix)) return { theme: th.name, base: selector.slice(prefix.length).trim() };
    }
    return { theme: null, base: selector };
  };

  const scan = scanFiles(ctx, listProjectFiles(ctx.project));
  const declAt = new Map<string, DeclUsage>();
  for (const u of scan.usages) if (u.kind === "decl") declAt.set(`${u.file}:${u.line}`, u);

  const existing = new Map<string, { value: string; use: string; match: string; source: string | null; occurrences: Occurrence[] }>();
  const groups = new Map<string, Group>();
  const themed: { theme: string; part: Part; base: string; hex: string; occ: Occurrence }[] = [];
  let total = 0;

  for (const v of scan.violations) {
    if (v.rule !== "color-literal") continue;
    const c = parseColor(v.found);
    if (!c) continue;
    total++;
    const decl = declAt.get(`${v.file}:${v.line}`);
    const occ: Occurrence = {
      file: v.file,
      line: v.line,
      column: v.column,
      found: v.found,
      property: v.property,
      selector: decl?.selector ?? null,
      siblingBackground: decl?.siblingBackground ?? null,
    };
    if (v.suggestion.match !== "none" && v.suggestion.value) {
      const key = `${hex(c)}|${v.suggestion.value}`;
      const e = existing.get(key) ?? { value: hex(c), use: v.suggestion.value, match: v.suggestion.match, source: v.suggestion.source, occurrences: [] };
      e.occurrences.push(occ);
      existing.set(key, e);
      continue;
    }
    const part = partOf(v.property);
    const { theme, base } = themeScope(occ.selector);
    if (theme) {
      themed.push({ theme, part, base: base!, hex: hex(c), occ });
      continue;
    }
    const key = `${part}|${hex(c)}`;
    const g: Group = groups.get(key) ?? { part, hex: hex(c), color: c, occurrences: [], selectors: new Set<string>(), themeValues: new Map() };
    g.occurrences.push(occ);
    if (base) g.selectors.add(base);
    groups.set(key, g);
  }

  // Values the project already declares for another theme are attached to the matching group.
  for (const t of themed) {
    const g = [...groups.values()].find((x) => x.part === t.part && x.selectors.has(t.base));
    if (!g) continue;
    const tv = g.themeValues.get(t.theme) ?? { hex: t.hex, occurrences: [] };
    tv.occurrences.push(t.occ);
    g.themeValues.set(t.theme, tv);
  }

  // Semantic kind per group: selector words, then status tokens used by the same rules.
  const statusRoleOf = (selector: string): string | null => {
    const cc = ctx.componentClasses.find((x) => x.selector === selector);
    for (const name of cc?.tokens ?? []) {
      const role = ctx.tokens.byName.get(name)?.role ?? "";
      if (role.startsWith("status.")) return role.slice("status.".length).replace("other", "neutral");
    }
    return null;
  };
  const sorted = [...groups.values()].sort(
    (a, b) => b.occurrences.length - a.occurrences.length || (a.part < b.part ? -1 : a.part > b.part ? 1 : a.hex < b.hex ? -1 : 1),
  );

  const proposals = sorted.map((g) => {
    const sels = [...g.selectors].sort();
    const votes = new Map<string, number>();
    for (const s of sels) {
      const k = kindOf(s) ?? statusRoleOf(s);
      if (k) votes.set(k, (votes.get(k) ?? 0) + 1);
    }
    const kind = [...votes.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0] ?? null;
    const stem = stemOf(sels[0] ?? null);
    const hover = sels.length > 0 && sels.every((s) => s.includes(":hover"));
    const translucent = alphaOf(g.color) < 1;
    const onAccent =
      g.part === "fg" && !kind && !translucent && (toOklch(g.color)?.l ?? 0) > 0.95 &&
      sels.some((s) => /primary|accent|brand|cta|(^|[-.])on-/.test(withoutPseudo(s)));
    let role: string;
    let name: string;
    const suffix = hover ? "-hover" : "";
    if (onAccent) {
      role = "on-accent";
      name = "--on-accent";
    } else if (kind) {
      role = kind === "neutral" ? "status.other" : `status.${kind}`;
      name = `--status-${kind}-${PART_SUFFIX[g.part]}${suffix}`;
    } else {
      role = g.part === "fg" ? "text" : g.part === "bg" ? "surface" : g.part === "border" ? "border.default" : "generic";
      name = `--${stem}-${PART_SUFFIX[g.part]}${suffix}`;
    }
    return { g, sels, kind, stem, role, name, translucent, onAccent, values: {} as Record<string, Value>, contrast: {} as Record<string, { against: string; ratio: number; ok: boolean }>, bgNote: null as string | null };
  });

  // Name collisions (two different colors would get the same name): use the selector stem.
  const seen = new Map<string, number>();
  for (const p of proposals) seen.set(p.name, (seen.get(p.name) ?? 0) + 1);
  const taken = new Set<string>(ctx.tokens.byName.keys());
  for (const p of proposals) {
    if ((seen.get(p.name) ?? 0) > 1 && p.kind) {
      p.name = `--status-${p.stem.replace(/^(chip|badge|tag|pill|label)-/, "")}-${PART_SUFFIX[p.g.part]}${p.name.endsWith("-hover") ? "-hover" : ""}`;
    }
    let candidate = p.name;
    for (let i = 2; taken.has(candidate); i++) candidate = `${p.name}-${i}`;
    p.name = candidate;
    taken.add(candidate);
  }

  const deriveSurfaceLike = (c: Color, theme: string, delta: number): Color => {
    const s = toOklch(surfaceIn(theme))!;
    const o = toOklch(c)!;
    const dark = s.l < 0.5;
    return parseColor(formatHex(oklch(s.l + (dark ? delta : -delta / 2), Math.max(o.c ?? 0, 0.05), o.h)))!;
  };
  const readableOn = (c: Color, bg: Color): Color => {
    if (contrast(c, bg) >= minRatio) return c;
    const o = toOklch(c)!;
    const dir = toOklch(bg)!.l < 0.5 ? 1 : -1;
    for (let step = 1; step <= 100; step++) {
      const cand = parseColor(formatHex(oklch(o.l + dir * step * 0.01, o.c ?? 0, o.h)))!;
      if (contrast(cand, bg) >= minRatio) return cand;
    }
    return parseColor(dir > 0 ? "#ffffff" : "#000000")!;
  };

  /** The background a text proposal sits on, per theme: its paired proposal, the rule's own background, or the accent. */
  const backgroundFor = (p: (typeof proposals)[number]): { name: string; colorIn: (theme: string) => Color | undefined } | null => {
    // Translucent backgrounds are overlays on something else: not a reliable pair.
    const pair = proposals.find((q) => q.g.part === "bg" && q !== p && !q.translucent && [...q.g.selectors].some((s) => p.g.selectors.has(s)));
    if (pair) return { name: pair.name, colorIn: (th) => parseColor(pair.values[th]?.value ?? pair.g.hex) };
    const sibling =
      p.g.occurrences.map((o) => o.siblingBackground).find((s) => {
        const c = colorOfValue(s, defaultTheme);
        return !!c && alphaOf(c) === 1;
      }) ?? null;
    if (sibling) {
      const tokenName = sibling.trim().match(/^var\(\s*(--[\w-]+)\s*\)$/)?.[1];
      return { name: tokenName ?? sibling.trim(), colorIn: (th) => colorOfValue(sibling, th) };
    }
    if (p.onAccent && accentName) return { name: accentName, colorIn: (th) => tokenColor(ctx.tokens, accentName, th) };
    return null;
  };

  // Backgrounds and borders first, so text is measured against its own (possibly derived) background.
  const order = [...proposals].sort((a, b) => (a.g.part === "fg" ? 1 : 0) - (b.g.part === "fg" ? 1 : 0));
  for (const p of order) {
    const g = p.g;
    const bg = g.part === "fg" ? backgroundFor(p) : null;
    for (const th of themes) {
      if (th.name === defaultTheme) {
        p.values[th.name] = { value: g.hex, origin: "in-use" };
        continue;
      }
      const declared = g.themeValues.get(th.name);
      if (declared) {
        const at = declared.occurrences[0]!;
        p.values[th.name] = { value: declared.hex, origin: "in-use", method: `declared for ${th.name} in ${at.file}:${at.line}` };
        continue;
      }
      if (p.translucent) {
        p.values[th.name] = { value: g.hex, origin: "in-use", method: "translucent overlay: same value in every theme" };
        continue;
      }
      const isTint = contrast(g.color, surfaceIn(defaultTheme)) < 1.6;
      if ((g.part === "bg" || g.part === "border") && isTint) {
        p.values[th.name] = {
          value: hex(deriveSurfaceLike(g.color, th.name, g.part === "border" ? 0.16 : p.name.endsWith("-hover") ? 0.13 : 0.08)),
          origin: "derived",
          method: `same hue as the ${defaultTheme} tint, lightness relative to ${surfaceName ?? "the surface"} in ${th.name}`,
        };
      } else if (g.part === "fg" && bg?.colorIn(th.name)) {
        const out = readableOn(g.color, bg.colorIn(th.name)!);
        const same = hex(out) === g.hex;
        p.values[th.name] = {
          value: hex(out),
          origin: same ? "in-use" : "derived",
          method: same ? `already reaches ${minRatio}:1 on ${bg.name} in ${th.name}` : `same hue, lightness adjusted to reach ${minRatio}:1 on ${bg.name} in ${th.name}`,
        };
      } else {
        p.values[th.name] = {
          value: g.hex,
          origin: "in-use",
          method: g.part === "fg" ? "background not known from the rule: kept as is; check it in the captures" : "solid color kept in every theme",
        };
      }
    }
    if (g.part === "fg") {
      if (!bg) p.bgNote = "Background not known from the rule (it may come from a parent); contrast not measured.";
      for (const th of themes) {
        const b = bg?.colorIn(th.name);
        if (!b) continue;
        const ratio = round(contrast(parseColor(p.values[th.name]!.value)!, b, surfaceIn(th.name)), 2);
        p.contrast[th.name] = { against: bg!.name, ratio, ok: ratio >= minRatio };
      }
    }
  }

  const where = (occ: Occurrence[]) => {
    const list = occ.map((o) => `${o.file}:${o.line}${o.selector ? ` (${o.selector})` : ""}`);
    return { where: list.slice(0, WHERE_LIMIT), more: Math.max(0, list.length - WHERE_LIMIT) };
  };
  const occurrencesOf = (p: (typeof proposals)[number]) => [...p.g.occurrences, ...[...p.g.themeValues.values()].flatMap((t) => t.occurrences)];

  const tokenProposals = proposals.map((p) => {
    const all = occurrencesOf(p);
    const failsNow = p.contrast[defaultTheme] && !p.contrast[defaultTheme]!.ok;
    return {
      name: p.name,
      role: p.role,
      part: p.g.part,
      values: p.values,
      ...(Object.keys(p.contrast).length ? { contrast: p.contrast } : {}),
      occurrences: all.length,
      evidence: `${p.g.hex} used ${p.g.occurrences.length} time(s)${p.sels.length ? ` in ${p.sels.slice(0, 4).join(", ")}${p.sels.length > 4 ? ", …" : ""}` : ""}.`,
      ...(p.bgNote ? { note: p.bgNote } : failsNow ? { note: `The value in use already fails ${minRatio}:1 in ${defaultTheme} (${p.contrast[defaultTheme]!.ratio}:1): the team may want to adjust it while creating the token.` } : {}),
      ...where(all),
    };
  });

  // Scales, only when the design system lacks them. Near-identical values are merged into one step.
  const scaleProposals: { name: string; role: string; value: string; merges: string[]; occurrences: number; evidence: string }[] = [];
  const describe = (sels: string[]) => {
    const u = [...new Set(sels)];
    return `${u.slice(0, 4).join(", ")}${u.length > 4 ? ", …" : ""}`;
  };
  if (cov.missing.includes("typography.scale")) {
    const steps = consolidate([...ctx.fontSizeUses.entries()], 0.5);
    const ladder = ["3xs", "2xs", "xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl"];
    const baseIdx = steps.reduce((best, s, i) => (Math.abs(s.value - 14) < Math.abs(steps[best]!.value - 14) ? i : best), 0);
    steps.forEach((s, i) => {
      const step = ladder[4 + (i - baseIdx)] ?? `${round(s.value, 2)}px`.replace(".", "_");
      scaleProposals.push({
        name: `--font-size-${step}`,
        role: "font-size",
        value: `${round(s.value, 2)}px`,
        merges: s.merged.filter((m) => m !== s.value).map((m) => `${round(m, 2)}px`),
        occurrences: s.uses.length,
        evidence: `font-size used in ${describe(s.uses)}.`,
      });
    });
  }
  if (cov.missing.includes("radius.scale")) {
    const radii = new Map<number, string[]>();
    for (const cc of ctx.componentClasses) {
      for (const d of cc.decls) {
        if (!/radius/.test(d.prop) || d.value.includes("var(")) continue;
        const m = d.value.trim().match(/^([\d.]+)px$/);
        if (m) radii.set(Number(m[1]), [...(radii.get(Number(m[1])) ?? []), cc.selector]);
      }
    }
    const names = ["sm", "md", "lg", "xl", "2xl", "3xl"];
    let i = 0;
    for (const s of consolidate([...radii.entries()], 1)) {
      scaleProposals.push({
        name: s.value >= 999 ? "--radius-full" : `--radius-${names[i++] ?? `${s.value}px`}`,
        role: "radius",
        value: `${s.value}px`,
        merges: s.merged.filter((m) => m !== s.value).map((m) => `${m}px`),
        occurrences: s.uses.length,
        evidence: `border-radius used in ${describe(s.uses)}.`,
      });
    }
  }

  // Migration plan: every literal occurrence → the token to use (existing or proposed), per file.
  const plan = new Map<string, { file: string; replacements: { line: number; found: string; use: string; kind: "existing" | "proposed" }[] }>();
  const add = (o: Occurrence, use: string, kind: "existing" | "proposed") => {
    const f = plan.get(o.file) ?? { file: o.file, replacements: [] };
    f.replacements.push({ line: o.line, found: o.found, use, kind });
    plan.set(o.file, f);
  };
  for (const e of existing.values()) for (const o of e.occurrences) add(o, e.use, "existing");
  for (const p of proposals) for (const o of occurrencesOf(p)) add(o, `var(${p.name})`, "proposed");
  const migrationPlan = [...plan.values()]
    .map((f) => ({ ...f, count: f.replacements.length, replacements: f.replacements.sort((a, b) => a.line - b.line || (a.found < b.found ? -1 : 1)) }))
    .sort((a, b) => b.count - a.count || (a.file < b.file ? -1 : 1));

  const existingOut = [...existing.values()]
    .sort((a, b) => b.occurrences.length - a.occurrences.length || (a.value < b.value ? -1 : 1))
    .map((e) => ({ value: e.value, use: e.use, match: e.match, source: e.source, occurrences: e.occurrences.length, ...where(e.occurrences) }));

  const existingScale = (role: string) => ctx.tokens.tokens.filter((t) => t.role === role).map((t) => `${t.name}: ${t.values[defaultTheme]}`);
  const notes = [
    "Proposals only: scan_styles never writes. Names follow the role and the selectors where the value is used; the team decides the final names.",
    "Default-theme values are the literals in use. Other themes reuse a value the project already declares for that theme, or are derived (see `method`).",
    "Literals that already match an existing token are listed under `existing`: migrate them, do not create new tokens.",
  ];
  if (existingScale("radius").length && scaleProposals.some((s) => s.role === "radius")) {
    notes.push(`Existing radius token(s) to keep in the scale: ${existingScale("radius").join(", ")}.`);
  }
  if (existingScale("font-size").length && scaleProposals.some((s) => s.role === "font-size")) {
    notes.push(`Existing font-size token(s) to keep in the scale: ${existingScale("font-size").join(", ")}.`);
  }

  return {
    status: cov.status,
    missingRoles: cov.missing,
    themes: themes.map((t) => t.name),
    referenceSurface: surfaceName,
    minRatio,
    summary: {
      colorLiterals: total,
      coveredByExistingTokens: existingOut.reduce((n, e) => n + e.occurrences, 0),
      tokenProposals: tokenProposals.length,
      scaleProposals: scaleProposals.length,
      filesToMigrate: migrationPlan.length,
    },
    existing: existingOut,
    proposals: tokenProposals,
    scales: scaleProposals,
    migrationPlan,
    notes,
  };
}
