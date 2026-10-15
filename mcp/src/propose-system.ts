import { parseBrief } from "./brief.js";
import { parseColor, toHex } from "./color.js";
import type { Context } from "./context.js";
import { coverage, getDesignSystem } from "./design-system.js";
import { proposeSystem, type Density, type Format, type Level } from "./generate.js";
import { FachaError } from "./types.js";

/**
 * propose_design_system (B-025, SPEC §2.h): the generator's input, from the tool's arguments, then
 * the design brief, then a default with its source; each input says where it came from.
 */

export interface ProposeArgs {
  brandColor?: string;
  density?: Density;
  level?: Level;
  fontFamily?: string;
  radius?: number;
  seeds?: number;
}

type From = { value: unknown; from: string };

export function proposeDesignSystem(ctx: Context, args: ProposeArgs) {
  const brief = parseBrief(ctx);
  const at = (field: keyof NonNullable<typeof brief>["at"]) => `brief ${brief!.id} (${brief!.at[field]})`;

  let brandColor: string | undefined;
  let brandFrom = "none: seeds from Radix accents";
  if (args.brandColor !== undefined) {
    const c = parseColor(args.brandColor);
    if (!c) throw new FachaError("INVALID_INPUT", `brandColor is not a CSS color: ${JSON.stringify(args.brandColor.slice(0, 60))}`, { field: "brandColor" });
    brandColor = toHex(c);
    brandFrom = "argument";
  } else if (brief?.brandColor) {
    brandColor = brief.brandColor.hex;
    brandFrom = at("brandColor");
  }

  const density: Density = args.density ?? brief?.density ?? "balanced";
  const densityFrom = args.density ? "argument" : brief?.density ? at("density") : "default (no brief): balanced";
  const level: Level = args.level ?? brief?.accessibility ?? "AA";
  const levelFrom = args.level ? "argument" : brief?.accessibility ? at("accessibility") : "default: WCAG 2.2 AA";

  const project = (getDesignSystem(ctx, ["project"]) as { project: { tailwind: { detected: boolean; version: string | null } } }).project;
  const format: Format = project.tailwind.detected && project.tailwind.version === "4" ? "tailwind4" : "css";

  const inputs: Record<string, From> = {
    brandColor: { value: brandColor ?? null, from: brandFrom },
    density: { value: density, from: densityFrom },
    level: { value: level, from: levelFrom },
    format: { value: format, from: format === "tailwind4" ? "package.json: tailwindcss 4 (default theme in @theme)" : "plain CSS custom properties in :root" },
    fontFamily: { value: args.fontFamily ?? null, from: args.fontFamily ? "argument" : "none: the system font stack" },
    radius: { value: args.radius ?? null, from: args.radius !== undefined ? "argument" : "default: 8px (Material 3 small)" },
  };

  const system = proposeSystem({ brandColor, density, level, format, fontFamily: args.fontFamily, radius: args.radius, seeds: args.seeds });
  const cov = coverage(ctx);
  return {
    designSystemStatus: cov.status,
    brief: brief ? { id: brief.id, source: brief.source } : null,
    inputs,
    ...system,
    notes: [
      "A proposal: nothing is written. /facha-ui:init system shows it and writes it only with the developer's approval.",
      ...(cov.status !== "missing" ? [`The project already has tokens (status ${cov.status}): this system would replace its colors; /facha-ui:init colors or palette keep what exists.`] : []),
    ],
  };
}
