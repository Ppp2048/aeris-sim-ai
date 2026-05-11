import * as React from "react";
import { cn } from "@/lib/utils";

export function RadarGridBackground({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("pointer-events-none fixed inset-0 -z-10 overflow-hidden radar-grid", className)} {...props}>
      <div className="radar-sweep absolute left-1/2 top-0 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full opacity-60" />
    </div>
  );
}
