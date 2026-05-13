import * as React from "react";
import { cn } from "@/lib/utils";

export function LightweightGridBackground({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden lightweight-grid-bg", className)} {...props}>
      <div className="absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/0.10),transparent_34rem)]" />
    </div>
  );
}
