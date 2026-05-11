import type { LucideIcon } from "lucide-react";
import type React from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";

export function MetricCard({
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
    <GlassCard className="flex items-center justify-between">
      <div>
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
        <div className="mt-2 text-2xl font-semibold text-foreground">{value}</div>
      </div>
      <Icon className={cn(tone)} size={28} />
    </GlassCard>
  );
}
