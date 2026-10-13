// facha-ui lab scaffold (Vite) · removed by /facha-ui:apply when no runs remain
import type { ReactNode } from "react";
/*__PROVIDER_IMPORTS__*/

/**
 * The app's own providers around each variant, so variants use the same real data, router and
 * state as the app (hard rule 5). /facha-ui:variants writes this file from src/main.tsx: it
 * IMPORTS the same providers from the app, it never copies their code.
 *
 * - A BrowserRouter or HashRouter becomes a MemoryRouter that starts at the screen's route, so
 *   links and useNavigate work without fighting the lab's own URL.
 * - Providers that need setup (a QueryClient, a store) import the same instance the app exports;
 *   when the app creates it inside main.tsx and does not export it, that is a gap to report.
 *
 * Example, for an app with <BrowserRouter><OrdersProvider><App /></OrdersProvider></BrowserRouter>:
 *
 *   import { MemoryRouter } from "react-router-dom";
 *   import { OrdersProvider } from "../src/lib/orders";
 *   …
 *   <MemoryRouter initialEntries={[ROUTES[screen] ?? "/"]}>
 *     <OrdersProvider>{children}</OrdersProvider>
 *   </MemoryRouter>
 */

/** The app route of each screen in the lab, filled per run: { orders: "/orders" }. */
export const ROUTES: Record<string, string> = {
  /*__ROUTES__*/
};

export function LabProviders({ screen, children }: { screen: string; children: ReactNode }) {
  void screen;
  return <>{children}</>; /*__PROVIDERS__*/
}
