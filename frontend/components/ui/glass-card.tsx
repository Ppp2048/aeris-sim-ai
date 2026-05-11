import * as React from "react";
import { cn } from "@/lib/utils";

export function GlassCard({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "glass-panel rounded-lg p-5 text-panel-foreground shadow-glow",
        className
      )}
      {...props}
    />
  );
}
