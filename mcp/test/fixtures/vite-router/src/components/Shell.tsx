import { Outlet } from "react-router-dom";

/** The layout: not a screen. */
export default function Shell() {
  return (
    <div className="page">
      <Outlet />
    </div>
  );
}
