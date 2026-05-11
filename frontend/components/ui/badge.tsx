import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-cyan-300/30 bg-cyan-300/10 px-2 py-1 text-xs font-medium text-cyan-100",
        "border-primary/30 bg-primary/10 text-primary",
        className
      )}
      {...props}
    />
  );
}
