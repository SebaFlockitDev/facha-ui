// facha-ui lab scaffold (Vite) · removed by /facha-ui:apply when no runs remain
import type { ReactNode } from "react";
/*__PROVIDER_IMPORTS__*/

/**
 * The app's own providers around each variant, so variants use the same real data, router and
 * state as the app (hard rule 5). /facha-ui:variants writes this file from the app's entry, read
 * statically by get_design_system (project.lab.entry), following lab.md: it imports the app's
 * providers and instances, it never copies their code.
 *
 * - A BrowserRouter or HashRouter becomes a MemoryRouter that starts at the screen's route, so
 *   links and useNavigate work without fighting the lab's own URL.
 * - A QueryClient (or SWRConfig) the app creates in its entry without exporting it is created
 *   here with the same options: same hooks and fetchers, only the cache is the lab's.
 * - Any other instance the app creates in its entry without exporting it (a store, a client with
 *   credentials) is a gap: export it from a module in the app; never re-create it here.
 *
 * Example, for an app whose main.tsx renders
 * <QueryClientProvider client={queryClient}><BrowserRouter><App /></BrowserRouter></QueryClientProvider>
 * with `const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } })`:
 *
 *   import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
 *   import { MemoryRouter } from "react-router-dom";
 *   const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });
 *   …
 *   <QueryClientProvider client={queryClient}>
 *     <MemoryRouter initialEntries={[ROUTES[screen] ?? "/"]}>{children}</MemoryRouter>
 *   </QueryClientProvider>
 */

/** The app route of each screen in the lab, filled per run: { orders: "/orders" }. */
export const ROUTES: Record<string, string> = {
  /*__ROUTES__*/
};

export function LabProviders({ screen, children }: { screen: string; children: ReactNode }) {
  void screen;
  return <>{children}</>; /*__PROVIDERS__*/
}
