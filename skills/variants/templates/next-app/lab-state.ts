"use client";
// facha-ui lab scaffold · state preview · removed by /facha-ui:apply when no runs remain
import { useEffect, useState } from "react";

/**
 * Lets a variant show each of its states on demand, so they can be reviewed and captured:
 * /lab/<screen>/<x>?state=loading | empty | error | long. Without ?state= the variant shows the
 * real data. Variants mark every line that uses this with "// facha-ui lab: state preview", and
 * /facha-ui:apply removes those lines: the real loading, empty and error branches stay.
 */

export type LabState = "loading" | "empty" | "error" | "long" | null;

const STATES = new Set(["loading", "empty", "error", "long"]);

/** The state forced with ?state=, or null for the real data. */
export function useLabState(): LabState {
  const [state, setState] = useState<LabState>(null);
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("state");
    setState(value && STATES.has(value) ? (value as LabState) : null);
  }, []);
  return state;
}

/** Long text for the stress preview: the real text repeated, to see wrapping and truncation. */
export function stress(text: string, times = 3): string {
  return Array.from({ length: times }, () => text).join(" ");
}

/** Many rows for the stress preview: the real rows repeated. */
export function many<T>(rows: T[], count = 40): T[] {
  if (rows.length === 0) return rows;
  return Array.from({ length: count }, (_, i) => rows[i % rows.length]!);
}
