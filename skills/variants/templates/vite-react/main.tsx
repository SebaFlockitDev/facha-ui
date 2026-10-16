// facha-ui lab scaffold (Vite) · removed by /facha-ui:apply when no runs remain
import { Component, StrictMode, Suspense, lazy, useMemo, type ComponentType, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
/*__GLOBAL_CSS__*/
import { CompareVariants } from "./compare";
import { LabCenter } from "./lab-center";
import { LabPanel } from "./lab-panel";
import { LabResponsive } from "./lab-responsive";
import { LabTheme } from "./lab-theme";
import { LabProviders } from "./providers";

/**
 * The lab of a React + Vite project (SPEC §2.b.4): /facha-lab/?screen=<slug>&v=<x> renders one
 * variant with the app's global CSS and providers; /facha-lab/?compare=<slug> shows them side by
 * side; /facha-lab/ lists them. ?theme=, ?state= and ?check=responsive work as in the Next lab.
 * Variants live in <slug>/<x>/Page.tsx and are found here, so adding one needs no other file.
 */

const PAGES = import.meta.glob<{ default: ComponentType }>("./*/*/Page.{tsx,jsx}");
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// The direction preview of /facha-ui:init system (B-026) lives in ./system/ only while it runs: a
// glob, unlike an import, does not fail when the files are not there.
import.meta.glob("./system/directions.css", { eager: true });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SYSTEM = import.meta.glob<Record<string, ComponentType<any>>>("./system/lab-{specimen,directions}.tsx");

/** Screens and their variants, from the files in the lab. */
export function labIndex(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const key of Object.keys(PAGES).sort()) {
    const [, screen, variant] = key.split("/");
    // `system` is /facha-ui:init system's direction preview, never a screen with variants.
    if (!screen || !variant || screen.startsWith("_") || screen === "system") continue;
    out.set(screen, [...(out.get(screen) ?? []), variant]);
  }
  return out;
}

/** Messages of a missing provider: the variant uses a hook whose provider is not in providers.tsx. */
const MISSING_PROVIDER = /No QueryClient set|useNavigate\(\)|useLocation\(\)|useHref\(\)|<Router>|react-redux context|could not find.*context|must be used (with)?in/i;

/**
 * A variant that fails to render shows why, in plain words, instead of a blank page; the live
 * panel stays outside it, so the developer can still ask for the fix from there.
 */
class VariantBoundary extends Component<{ screen: string; children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const provider = MISSING_PROVIDER.test(error.message);
    return (
      <div role="alert" style={{ font: "14px/1.5 system-ui, sans-serif", padding: 24, maxWidth: 720 }}>
        <h1 style={{ fontSize: 18, margin: "0 0 8px" }}>La variante no se pudo mostrar</h1>
        <p style={{ margin: "0 0 8px" }}>
          {provider
            ? "Usa un hook de la app cuyo provider no está en el laboratorio. Falta agregarlo en facha-lab/providers.tsx, igual que en el main.tsx de la app."
            : "Se produjo un error al dibujarla. Pedile a Claude Code que lo revise, con el mensaje de abajo."}
        </p>
        <pre style={{ whiteSpace: "pre-wrap", background: "#f1f5f9", color: "#0f172a", padding: 12, borderRadius: 8, fontSize: 12 }}>{error.message}</pre>
        <p style={{ margin: 0, color: "#475569" }}>Pantalla: {this.props.screen}</p>
      </div>
    );
  }
}

function Variant({ screen, variant }: { screen: string; variant: string }) {
  const key = Object.keys(PAGES).find((k) => k.startsWith(`./${screen}/${variant}/Page.`));
  const Page = useMemo(() => (key ? lazy(PAGES[key]!) : null), [key]);
  if (!Page) return <p style={{ font: "14px system-ui", padding: 16 }}>No existe la variante {variant} de {screen} en el laboratorio.</p>;
  return (
    <>
      <VariantBoundary screen={screen}>
        <LabProviders screen={screen}>
          <LabTheme />
          <Suspense fallback={null}>
            <Page />
          </Suspense>
          <LabResponsive />
        </LabProviders>
      </VariantBoundary>
      {/* facha-ui's own live panel, outside the app's providers: it only talks to the lab endpoint. */}
      <LabPanel />
    </>
  );
}

/**
 * /facha-ui:init system's direction preview: ?system=specimen (every token and state), ?system=compare
 * (the directions side by side) or ?system=<slug> (the copy of a real screen), with &direction=<id>.
 */
function SystemPreview({ page }: { page: string }) {
  const Page = useMemo(() => {
    if (page === "specimen" || page === "compare") {
      const load = SYSTEM[page === "compare" ? "./system/lab-directions.tsx" : "./system/lab-specimen.tsx"];
      if (!load) return null;
      return lazy(async () => {
        const m = await load();
        if (page === "specimen") return { default: m.LabSpecimen! };
        const Directions = m.LabDirections!;
        const url = (p: string, d: string, t: string) => `?system=${p}&direction=${d}${t ? `&theme=${t}` : ""}`;
        return { default: () => <Directions url={url} /> };
      });
    }
    const key = Object.keys(PAGES).find((k) => k.startsWith(`./system/${page}/Page.`));
    return key ? lazy(PAGES[key]!) : null;
  }, [page]);
  if (!Page) return <p style={{ font: "14px system-ui", padding: 16 }}>No hay vista de direcciones en el laboratorio: la arma /facha-ui:init system.</p>;
  const content = (
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  );
  if (page === "specimen" || page === "compare")
    return (
      <>
        <LabTheme />
        {content}
      </>
    );
  return (
    <VariantBoundary screen={page}>
      <LabProviders screen={page}>
        <LabTheme />
        {content}
      </LabProviders>
    </VariantBoundary>
  );
}

/** The lab's home is the facha-ui center (B-042): the project's state, its screens and what to do next. */
function LabHome() {
  return <LabCenter routes="query" />;
}

function Lab() {
  const q = new URLSearchParams(window.location.search);
  const screen = q.get("screen") ?? "";
  const variant = q.get("v") ?? "";
  const compare = q.get("compare") ?? "";
  const system = q.get("system") ?? "";
  if (NAME.test(system)) return <SystemPreview page={system} />;
  if (NAME.test(compare)) return <CompareVariants slug={compare} variants={labIndex().get(compare) ?? []} />;
  if (NAME.test(screen) && /^[a-z][0-9]?$/.test(variant)) return <Variant screen={screen} variant={variant} />;
  return <LabHome />;
}

// The lab exists only in development: a production bundle that somehow includes it renders nothing.
const root = document.getElementById("facha-lab-root");
if (root && !import.meta.env.PROD) {
  createRoot(root).render(
    <StrictMode>
      <Lab />
    </StrictMode>,
  );
}
