"use client";
// facha-ui lab scaffold · removed by /facha-ui:apply when no runs remain
import { useEffect } from "react";

/**
 * Non-default themes, filled by /facha-ui:variants from get_design_system → project.themes.
 * `attribute: "class"` toggles a class on <html>; any other attribute is set to `value`.
 */
export const THEMES: Record<string, { attribute: string; value: string }> = {
  /*__THEMES__*/
};

/** Applies ?theme=<name> to <html> so each variant can be captured in every theme. */
export function LabTheme() {
  // ?direction=<id>: the direction of /facha-ui:init system to show (its tokens are scoped to
  // html[data-facha-direction="<id>"] in <lab.dir>/system/directions.css).
  useEffect(() => {
    const direction = new URLSearchParams(window.location.search).get("direction");
    if (!direction || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(direction)) return;
    const html = document.documentElement;
    html.setAttribute("data-facha-direction", direction);
    return () => html.removeAttribute("data-facha-direction");
  }, []);
  useEffect(() => {
    const name = new URLSearchParams(window.location.search).get("theme");
    const theme = name ? THEMES[name] : undefined;
    if (!theme) return;
    const html = document.documentElement;
    if (theme.attribute === "class") {
      html.classList.add(theme.value);
      return () => html.classList.remove(theme.value);
    }
    const previous = html.getAttribute(theme.attribute);
    html.setAttribute(theme.attribute, theme.value);
    return () => {
      if (previous === null) html.removeAttribute(theme.attribute);
      else html.setAttribute(theme.attribute, previous);
    };
  }, []);
  return null;
}
