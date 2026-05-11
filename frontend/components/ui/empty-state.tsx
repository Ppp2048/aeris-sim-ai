import type { LucideIcon } from "lucide-react";
import { Radar } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  icon: Icon = Radar,
  className
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/35 p-8 text-center",
        className
      )}
    >
      <Icon className="text-primary" size={28} />
      <div className="mt-3 font-semibold text-foreground">{title}</div>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}
