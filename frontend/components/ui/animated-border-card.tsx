import * as React from "react";
import { cn } from "@/lib/utils";

export function AnimatedBorderCard({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animated-border-card rounded-xl p-[1px]", className)} {...props} />;
}

export function AnimatedBorderCardInner({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-[11px] bg-panel/92 p-5 text-panel-foreground", className)} {...props} />;
}
