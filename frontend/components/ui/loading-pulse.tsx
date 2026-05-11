import { cn } from "@/lib/utils";

export function LoadingPulse({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3 rounded-xl border border-border bg-panel/65 p-4", className)}>
      <div className="h-4 w-2/5 animate-pulse rounded bg-muted" />
      <div className="h-24 animate-pulse rounded-lg bg-gradient-to-r from-muted via-primary/10 to-muted" />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="h-16 animate-pulse rounded-lg bg-muted/80" />
        <div className="h-16 animate-pulse rounded-lg bg-muted/80" />
        <div className="h-16 animate-pulse rounded-lg bg-muted/80" />
      </div>
      <div className="h-4 w-3/5 animate-pulse rounded bg-muted" />
    </div>
  );
}
