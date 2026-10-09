// facha-ui lab scaffold · removed by /facha-ui:apply when no runs remain
import { notFound } from "next/navigation";
import { LabTheme } from "./lab-theme";

/** Lab routes exist only in development: in production every lab URL is a 404. */
export default function LabLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <>
      <LabTheme />
      {children}
    </>
  );
}
