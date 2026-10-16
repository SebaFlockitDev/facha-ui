import * as React from "react";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card" className={className} {...props} />;
}
