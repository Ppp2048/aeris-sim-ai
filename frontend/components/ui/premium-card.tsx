import * as React from "react";
import { cn } from "@/lib/utils";

export function PremiumCard({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("premium-card rounded-xl p-5 text-panel-foreground", className)} {...props} />;
}
