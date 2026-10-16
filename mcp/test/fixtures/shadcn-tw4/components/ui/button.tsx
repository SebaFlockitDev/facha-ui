import * as React from "react";
import { Slot } from "@radix-ui/react-slot";

export function Button({ asChild = false, className, ...props }: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp data-slot="button" className={className} {...props} />;
}
