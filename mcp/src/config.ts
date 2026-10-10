import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { FachaError, RULE_IDS } from "./types.js";

export const CONFIG_FILE = "facha-ui.config.json";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

const severity = z.enum(["off", "info", "warning", "error"]);

/** A JavaScript regular expression, validated so a typo is a CONFIG_INVALID and not a crash. */
const regex = z.string().min(1).refine(
  (s) => {
    try {
      new RegExp(s);
      return true;
    } catch {
      return false;
    }
  },
  { message: "Invalid regular expression" },
);

export const ConfigSchema = z
  .object({
    $schema: z.string().optional(),
    version: z.literal(1),
    framework: z.enum(["auto", "next-app"]).default("auto"),
    tokens: z
      .object({
        sources: z.array(z.string().min(1)).min(1).optional(),
        themes: z.record(z.string().min(1), z.string().min(1)).optional(),
        roles: z.record(z.string().regex(/^--/), z.string()).optional(),
        invariant: z.array(z.string().regex(/^--/)).optional(),
      })
      .strict()
      .default({}),
    include: z.array(z.string().min(1)).optional(),
    exclude: z.array(z.string().min(1)).optional(),
    rules: z.partialRecord(z.enum(RULE_IDS), severity).optional(),
    allow: z.object({ literals: z.array(z.string()).default([]) }).strict().optional(),
    contrast: z
      .object({
        surfaces: z.array(z.string().regex(/^--/)).optional(),
        minRatio: z.number().min(1).max(21).default(4.5),
        /** WCAG 1.4.11: borders, focus rings and icons of interactive parts. */
        nonTextMinRatio: z.number().min(1).max(21).default(3),
        /** Minimum OKLab ΔE (×100) between status colors, also under simulated deuteranopia/protanopia. */
        statusMinDeltaE: z.number().positive().default(10),
      })
      .strict()
      .optional(),
    guidelines: z.array(z.string()).default([]),
    // The product's voice (0.11.0): how it addresses people and the words it uses. The guardian
    // checks the UI text against it (copy-voice, copy-term).
    copy: z
      .object({
        /** How the UI addresses the person: Spanish "vos", "tú" or "usted". */
        voice: z.enum(["vos", "tú", "usted"]).optional(),
        /** Product terms: say `use`, never the words in `avoid` (case-insensitive, whole words). */
        terms: z
          .array(z.object({ use: z.string().min(1), avoid: z.array(z.string().min(1)).min(1) }).strict())
          .default([]),
      })
      .strict()
      .optional(),
    lab: z
      .object({
        dir: z.string().min(1).default("app/lab"),
        // Vision key (SPEC §2.0.2), accepted but not used by the MVP.
        viewports: z.array(z.object({ name: z.string(), width: z.number(), height: z.number() })).optional(),
      })
      .strict()
      .default({ dir: "app/lab" }),
    // Declarative team rules (SPEC §2.a.4), evaluated since 0.4.0. No project code is executed.
    custom: z
      .array(
        z.discriminatedUnion("kind", [
          z
            .object({
              id: z.string().regex(/^[\w-]+$/),
              kind: z.literal("forbid-token"),
              selector: regex.optional(),
              property: regex.optional(),
              tokens: z.array(z.string().regex(/^--/)).min(1),
              severity: severity.optional(),
              message: z.string().optional(),
            })
            .strict(),
          z
            .object({
              id: z.string().regex(/^[\w-]+$/),
              kind: z.literal("forbid-class"),
              pattern: regex,
              severity: severity.optional(),
              message: z.string().optional(),
            })
            .strict(),
        ]),
      )
      .optional(),
    // useDefaultTheme (0.4.0) and allowDefaultScale (0.5.0) are evaluated; other keys are accepted for the roadmap.
    tailwind: z
      .object({
        useDefaultTheme: z.boolean().optional(),
        /** Default Tailwind scales accepted without a token. Radius, shadow, font size, tracking and leading are not, by default. */
        allowDefaultScale: z
          .object({
            radius: z.boolean().optional(),
            shadow: z.boolean().optional(),
            fontSize: z.boolean().optional(),
            tracking: z.boolean().optional(),
            leading: z.boolean().optional(),
            spacing: z.boolean().optional(),
            sizing: z.boolean().optional(),
            fontWeight: z.boolean().optional(),
            layout: z.boolean().optional(),
          })
          .strict()
          .optional(),
      })
      .catchall(z.unknown())
      .optional(),
    suggest: z.object({ maxDeltaE: z.number().positive() }).strict().optional(),
    preview: z
      .object({
        baseUrl: z
          .string()
          .url()
          .refine((u) => LOOPBACK_HOSTS.has(new URL(u).hostname), {
            message: "preview.baseUrl must be a loopback URL (localhost, 127.0.0.1 or ::1)",
          })
          .default("http://localhost:3000"),
        auth: z.enum(["none", "manual"]).default("none"),
      })
      .strict()
      .default({ baseUrl: "http://localhost:3000", auth: "none" }),
    memory: z
      .object({ decisionsFile: z.string().min(1).default("design-system/decisions.md") })
      .strict()
      .default({ decisionsFile: "design-system/decisions.md" }),
  })
  .strict();

export type RawConfig = z.infer<typeof ConfigSchema>;

export const DEFAULT_INCLUDE = [
  "app/**/*.{tsx,jsx,ts,js,css}",
  "src/**/*.{tsx,jsx,ts,js,css}",
  "components/**/*.{tsx,jsx,ts,js,css}",
  "pages/**/*.{tsx,jsx,ts,js,css}",
];

/** Directories that are never read, whatever the config says. */
export const ALWAYS_IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "out",
  "coverage",
  ".facha-ui",
  ".turbo",
  ".vercel",
]);

export interface LoadedConfig {
  config: RawConfig;
  configSource: typeof CONFIG_FILE | "autodetected";
  assumptions: string[];
}

function pointer(pathParts: PropertyKey[]): string {
  return "/" + pathParts.map((p) => String(p).replace(/~/g, "~0").replace(/\//g, "~1")).join("/");
}

export function loadConfig(root: string): LoadedConfig {
  const file = path.join(root, CONFIG_FILE);
  if (!fs.existsSync(file)) {
    return {
      config: ConfigSchema.parse({ version: 1 }),
      configSource: "autodetected",
      assumptions: [`No ${CONFIG_FILE} found: tokens, themes and include globs are autodetected.`],
    };
  }
  let json: unknown;
  try {
    json = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    throw new FachaError("CONFIG_INVALID", `${CONFIG_FILE} is not valid JSON: ${(e as Error).message}`, {
      pointer: "",
    });
  }
  const parsed = ConfigSchema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({ pointer: pointer(i.path), message: i.message }));
    throw new FachaError(
      "CONFIG_INVALID",
      `${CONFIG_FILE} is invalid: ${issues.map((i) => `${i.pointer || "/"} ${i.message}`).join("; ")}`,
      { issues },
    );
  }
  const notEvaluated: string[] = (["suggest"] as const).filter((k) => parsed.data[k] !== undefined);
  for (const k of Object.keys(parsed.data.tailwind ?? {})) if (k !== "useDefaultTheme" && k !== "allowDefaultScale") notEvaluated.push(`tailwind.${k}`);
  if (parsed.data.lab.viewports) notEvaluated.push("lab.viewports");
  const assumptions = notEvaluated.length
    ? [`Config keys accepted but not evaluated in this version (roadmap): ${notEvaluated.join(", ")}.`]
    : [];
  return { config: parsed.data, configSource: CONFIG_FILE, assumptions };
}
