import type { LucideIcon } from "lucide-react";
import * as React from "react";
import { PremiumCard } from "@/components/ui/premium-card";
import { cn } from "@/lib/utils";

function MetricCardComponent({
  label,
  value,
  icon: Icon,
  tone = "text-primary"
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  tone?: string;
}) {
  return (
    <PremiumCard className="group relative overflow-hidden p-4">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-70" />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
          <div className="mt-2 truncate font-mono text-2xl font-semibold text-foreground">{value}</div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-primary to-accent opacity-80 transition group-hover:w-5/6" />
          </div>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/45 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.05)]">
          <Icon className={cn(tone)} size={24} />
        </div>
      </div>
    </PremiumCard>
  );
}

export const MetricCard = React.memo(MetricCardComponent);
