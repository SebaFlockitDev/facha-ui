"use client";
// facha-ui lab · direction preview · removed by /facha-ui:init system once the system is written
import { LabDirections } from "../lab-directions";

/** The lab's URL prefix, set by /facha-ui:init system when it copies this file. */
const LAB_BASE = "/lab"; /*__LAB_BASE__*/

export default function CompareDirectionsPage() {
  return (
    <LabDirections
      url={(page, direction, theme) => `${LAB_BASE}/system/${page}?direction=${direction}${theme ? `&theme=${theme}` : ""}`}
    />
  );
}
