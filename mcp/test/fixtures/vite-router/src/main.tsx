import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import Shell from "./components/Shell";
import Home from "./features/home/HomePage";
import { Team } from "./features/team/Team";

const Settings = lazy(() => import("./features/settings/SettingsPage"));

// Route objects: a layout with children, an index route, a lazy screen, a lazy route module and a Component.
const router = createBrowserRouter([
  {
    path: "/",
    element: <Shell />,
    children: [
      { index: true, element: <Home /> },
      {
        path: "/settings",
        element: (
          <Suspense fallback={<p>Cargando…</p>}>
            <Settings />
          </Suspense>
        ),
      },
      { path: "/reports", lazy: () => import("./features/reports/route") },
      { path: "/team", Component: Team },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
