import * as React from "react";
import { cn } from "@/lib/utils";

export function AppBackground({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[var(--app-bg)]", className)} {...props}>
      <div className="absolute inset-0 radar-grid opacity-100" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,var(--app-glow),transparent_56%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_18%,rgba(139,92,246,0.10),transparent_28rem)] dark:bg-[radial-gradient(circle_at_80%_18%,rgba(139,92,246,0.075),transparent_28rem)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,var(--app-bg)_92%)] opacity-80" />
    </div>
  );
}
