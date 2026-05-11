import * as React from "react";
import { cn } from "@/lib/utils";

export function RadarGridBackground({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("pointer-events-none fixed inset-0 -z-10 overflow-hidden radar-grid radar-grid-animated", className)} {...props}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/0.10),transparent_34rem)]" />
      <div className="radar-sweep absolute left-1/2 top-[-12rem] h-[46rem] w-[46rem] -translate-x-1/2 rounded-full opacity-50" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}
