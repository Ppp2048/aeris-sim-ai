import * as React from "react";
import { Activity, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type StatusTone = "online" | "warning" | "danger" | "neutral";

const toneClass: Record<StatusTone, string> = {
  online: "border-emerald-400/35 bg-emerald-400/10 text-emerald-500 dark:text-emerald-200",
  warning: "border-amber-400/35 bg-amber-400/10 text-amber-600 dark:text-amber-200",
  danger: "border-danger/35 bg-danger/10 text-danger",
  neutral: "border-border bg-muted text-muted-foreground"
};

export function StatusBadge({
  children,
  tone = "neutral",
  className
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: StatusTone }) {
  const Icon = tone === "online" ? CheckCircle2 : tone === "danger" ? AlertTriangle : Activity;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium",
        toneClass[tone],
        className
      )}
    >
      <Icon size={13} />
      {children}
    </span>
  );
}
