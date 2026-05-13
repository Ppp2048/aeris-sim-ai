import * as React from "react";
import { cn } from "@/lib/utils";

export function RadarGridBackground({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("pointer-events-none fixed inset-0 -z-10 overflow-hidden radar-grid", className)} {...props}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/0.07),transparent_32rem)]" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}
