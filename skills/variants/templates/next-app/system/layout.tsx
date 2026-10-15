// facha-ui lab · direction preview · removed by /facha-ui:init system once the system is written
import type { ReactNode } from "react";
// Each direction's tokens, scoped to html[data-facha-direction="<id>"] (lab-theme sets it from ?direction=).
import "./directions.css";

export default function SystemPreviewLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
