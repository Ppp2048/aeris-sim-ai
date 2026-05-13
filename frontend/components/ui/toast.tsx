import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastTone = "success" | "error" | "info" | "warning";

const toneClass: Record<ToastTone, string> = {
  success: "border-emerald-400/35 bg-emerald-400/12 text-emerald-700 dark:text-emerald-100",
  error: "border-danger/35 bg-danger/12 text-danger",
  info: "border-primary/35 bg-primary/12 text-primary",
  warning: "border-amber-400/35 bg-amber-400/12 text-amber-700 dark:text-amber-100"
};

const icons = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
  warning: AlertTriangle
};

export function Toast({
  tone = "info",
  message,
  onDismiss,
  className
}: {
  tone?: ToastTone;
  message: string;
  onDismiss?: () => void;
  className?: string;
}) {
  const Icon = icons[tone];
  return (
    <div
      className={cn(
        "fixed right-4 top-20 z-50 flex max-w-sm items-start gap-3 rounded-xl border p-3 text-sm shadow-lg",
        toneClass[tone],
        className
      )}
      role="status"
    >
      <Icon className="mt-0.5 shrink-0" size={17} />
      <div className="min-w-0 flex-1 leading-5">{message}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md p-1 opacity-70 transition hover:bg-background/20 hover:opacity-100"
          aria-label="Dismiss notification"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
