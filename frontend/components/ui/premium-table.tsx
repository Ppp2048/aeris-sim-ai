import * as React from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

export function PremiumTable({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full border-separate border-spacing-y-2 text-left text-sm", className)} {...props} />;
}

export function PremiumTableHead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("text-xs uppercase tracking-[0.14em] text-muted-foreground", className)} {...props} />;
}

export function PremiumTableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("group text-muted-foreground", className)} {...props} />;
}

export function PremiumTableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        "border-y border-[var(--app-border)] bg-muted/25 px-3 py-3 transition-colors group-hover:bg-muted/45 first:rounded-l-lg first:border-l last:rounded-r-lg last:border-r",
        className
      )}
      {...props}
    />
  );
}

export function PremiumTableEmpty({
  title,
  description,
  colSpan
}: {
  title: string;
  description?: string;
  colSpan: number;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-4">
        <EmptyState title={title} description={description} />
      </td>
    </tr>
  );
}
