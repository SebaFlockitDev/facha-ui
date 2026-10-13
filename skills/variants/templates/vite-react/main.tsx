// facha-ui lab scaffold (Vite) · removed by /facha-ui:apply when no runs remain
import { StrictMode, Suspense, lazy, useMemo, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
/*__GLOBAL_CSS__*/
import { CompareVariants } from "./compare";
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

/** Screens and their variants, from the files in the lab. */
export function labIndex(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const key of Object.keys(PAGES).sort()) {
    const [, screen, variant] = key.split("/");
    if (!screen || !variant || screen.startsWith("_")) continue;
    out.set(screen, [...(out.get(screen) ?? []), variant]);
  }
  return out;
}

function Variant({ screen, variant }: { screen: string; variant: string }) {
  const key = Object.keys(PAGES).find((k) => k.startsWith(`./${screen}/${variant}/Page.`));
  const Page = useMemo(() => (key ? lazy(PAGES[key]!) : null), [key]);
  if (!Page) return <p style={{ font: "14px system-ui", padding: 16 }}>No existe la variante {variant} de {screen} en el laboratorio.</p>;
  return (
    <>
      <LabProviders screen={screen}>
        <LabTheme />
        <Suspense fallback={null}>
          <Page />
        </Suspense>
        <LabResponsive />
      </LabProviders>
      {/* facha-ui's own live panel, outside the app's providers: it only talks to the lab endpoint. */}
      <LabPanel />
    </>
  );
}

function LabHome() {
  const index = labIndex();
  return (
    <main style={{ font: "14px/1.5 system-ui, sans-serif", padding: 24 }}>
      <h1 style={{ fontSize: 20 }}>Laboratorio de facha-ui</h1>
      {index.size === 0 && <p>Todavía no hay variantes. Pedíselas a Claude Code: «mejorá la pantalla de pedidos».</p>}
      {[...index].map(([screen, variants]) => (
        <p key={screen}>
          <b>{screen}</b>:{" "}
          {variants.map((v) => (
            <a key={v} href={`?screen=${screen}&v=${v}`} style={{ marginRight: 8 }}>
              {v.toUpperCase()}
            </a>
          ))}
          <a href={`?compare=${screen}`}>Comparar</a>
        </p>
      ))}
    </main>
  );
}

function Lab() {
  const q = new URLSearchParams(window.location.search);
  const screen = q.get("screen") ?? "";
  const variant = q.get("v") ?? "";
  const compare = q.get("compare") ?? "";
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
