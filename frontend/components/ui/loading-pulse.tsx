import { cn } from "@/lib/utils";

export function LoadingPulse({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="h-4 w-2/5 animate-pulse rounded bg-muted" />
      <div className="h-24 animate-pulse rounded-lg bg-muted" />
      <div className="h-4 w-3/5 animate-pulse rounded bg-muted" />
    </div>
  );
}
