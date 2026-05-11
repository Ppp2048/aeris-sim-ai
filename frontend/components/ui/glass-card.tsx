import * as React from "react";
import { cn } from "@/lib/utils";

function GlassCardComponent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "glass-panel rounded-xl p-5 text-panel-foreground transition duration-200",
        className
      )}
      {...props}
    />
  );
}

export const GlassCard = React.memo(GlassCardComponent);
