import { parseBrief } from "./brief.js";
import { parseColor, toHex } from "./color.js";
import type { Context } from "./context.js";
import { coverage, getDesignSystem } from "./design-system.js";
import { proposeSystem, type Density, type Format, type Level } from "./generate.js";
import { PROFILES, type StyleId } from "./standards.js";
import { FachaError } from "./types.js";
import { fromReference, REPLACEMENT } from "./reference.js";

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
  style?: StyleId;
  /** A reference read by /facha-ui:init reference (B-028): .facha-ui/references/<slug>.json. */
  reference?: string;
}

type From = { value: unknown; from: string };

export function proposeDesignSystem(ctx: Context, args: ProposeArgs) {
  const brief = parseBrief(ctx);
  // The reference fills what the arguments leave out; the brief and the defaults come after it.
  const ref = args.reference ? fromReference(ctx, args.reference, args.level ?? brief?.accessibility ?? "AA") : null;
  const fromRef = (what: string) => `reference ${ref!.host}: ${what}`;
  const at = (field: keyof NonNullable<typeof brief>["at"]) => `brief ${brief!.id} (${brief!.at[field]})`;

  let brandColor: string | undefined;
  let brandFrom = "none: seeds from Radix accents";
  if (args.brandColor !== undefined) {
    const c = parseColor(args.brandColor);
    if (!c) throw new FachaError("INVALID_INPUT", `brandColor is not a CSS color: ${JSON.stringify(args.brandColor.slice(0, 60))}`, { field: "brandColor" });
    brandColor = toHex(c);
    brandFrom = "argument";
  } else if (ref?.brandColor) {
    brandColor = ref.brandColor.value;
    brandFrom = fromRef(ref.brandColor.from);
  } else if (brief?.brandColor) {
    brandColor = brief.brandColor.hex;
    brandFrom = at("brandColor");
  }

  // The product type picks a profile (B-027); the brief's own density still wins over the profile's.
  const productType = brief?.product?.type && PROFILES[brief.product.type] ? brief.product.type : undefined;
  const profile = productType ? PROFILES[productType] : undefined;
  const density: Density = args.density ?? ref?.density.value ?? brief?.density ?? profile?.density?.value ?? "balanced";
  const densityFrom = args.density
    ? "argument"
    : ref
      ? fromRef(ref.density.from)
      : brief?.density
      ? at("density")
      : profile?.density
        ? `profile ${productType} (${profile.density.sources.join(", ")})`
        : "default: balanced";
  const level: Level = args.level ?? brief?.accessibility ?? "AA";
  const fontFamily = args.fontFamily ?? ref?.fontFamily.value ?? undefined;
  const radius = args.radius ?? ref?.radius?.value;
  const style = args.style ?? ref?.style.value;
  const levelFrom = args.level ? "argument" : brief?.accessibility ? at("accessibility") : "default: WCAG 2.2 AA";

  const project = (getDesignSystem(ctx, ["project"]) as { project: { tailwind: { detected: boolean; version: string | null } } }).project;
  const format: Format = project.tailwind.detected && project.tailwind.version === "4" ? "tailwind4" : "css";

  const inputs: Record<string, From> = {
    productType: { value: productType ?? null, from: productType ? at("product") : brief?.product?.type ? `brief: ${brief.product.type} has no profile` : "no brief: no profile" },
    brandColor: { value: brandColor ?? null, from: brandFrom },
    density: { value: density, from: densityFrom },
    level: { value: level, from: levelFrom },
    format: { value: format, from: format === "tailwind4" ? "package.json: tailwindcss 4 (default theme in @theme)" : "plain CSS custom properties in :root" },
    fontFamily: {
      value: fontFamily ?? null,
      from: args.fontFamily ? "argument" : ref ? fromRef(ref.fontFamily.from) : "none: the system font stack",
    },
    radius: {
      value: radius ?? null,
      from: args.radius !== undefined ? "argument" : ref?.radius ? fromRef(ref.radius.from) : "each direction's style (Material 3 corner scale)",
    },
    style: { value: style ?? null, from: args.style ? "argument" : ref ? fromRef(ref.style.from) : "none: directions take the standard, sober and soft styles" },
  };

  const system = proposeSystem({ brandColor, density, level, format, fontFamily, radius, seeds: args.seeds, style, productType });
  // The reference's pairs that failed, with what the (first) direction uses instead.
  const first = system.directions[0];
  const valueIn = (name: string) => first?.tokens.find((t) => t.name === name);
  const reference = ref
    ? {
        url: ref.url,
        file: ref.file,
        pairs: ref.pairs.map((p) => {
          if (p.pass) return p;
          const [fg, bg] = REPLACEMENT[p.pair] ?? ["--color-foreground", "--color-background"];
          const proof = first?.proof.find((x) => x.mode === "light" && x.fg === fg && x.bg === bg);
          return { ...p, replacedBy: { fg, bg, light: [valueIn(fg)?.light, valueIn(bg)?.light], ratio: proof?.ratio ?? null } };
        }),
        notes: ref.notes,
      }
    : null;
  const cov = coverage(ctx);
  return {
    designSystemStatus: cov.status,
    brief: brief ? { id: brief.id, source: brief.source } : null,
    inputs,
    ...(reference ? { reference } : {}),
    ...system,
    notes: [
      "A proposal: nothing is written. /facha-ui:init system shows it and writes it only with the developer's approval.",
      ...(cov.status !== "missing" ? [`The project already has tokens (status ${cov.status}): this system would replace its colors; /facha-ui:init colors or palette keep what exists.`] : []),
    ],
  };
}
