"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, Clock3, Database, LogOut, Radar, ServerCog } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { clearToken } from "@/lib/auth";
import type { User } from "@/lib/types";

export function Topbar({ user }: { user: User | null }) {
  const router = useRouter();
  const [time, setTime] = useState("");

  useEffect(() => {
    const update = () => {
      setTime(
        new Intl.DateTimeFormat(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        }).format(new Date())
      );
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  function logout() {
    clearToken();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--app-border)] bg-background/95 px-4 py-3 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4">
        <Link href="/dashboard" className="flex items-center gap-2 text-sm font-semibold text-foreground lg:hidden">
          <Radar size={18} />
          AERIS
        </Link>
        <div className="hidden min-w-0 lg:block">
          <div className="font-display text-sm font-semibold text-foreground">Synthetic radar operations console</div>
          <div className="text-xs text-muted-foreground">Local command center for simulation, tracking, and replay review</div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge tone="neutral" className="hidden lg:inline-flex">
            <Clock3 size={14} />
            {time || "local"}
          </StatusBadge>
          <StatusBadge tone="online" className="hidden xl:inline-flex">
            <ServerCog size={14} />
            System nominal
          </StatusBadge>
          <StatusBadge tone="online" className="hidden sm:inline-flex">
            <Database size={14} />
            SQLite
          </StatusBadge>
          <ThemeToggle />
          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 transition hover:border-border hover:bg-muted/70">
              <div className="hidden text-right text-xs md:block">
                <div className="font-medium text-foreground">{user?.name ?? "Operator"}</div>
                <div className="text-muted-foreground">{user?.role ?? "local"}</div>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/12 text-primary">
                {(user?.name ?? "A").slice(0, 1).toUpperCase()}
              </div>
              <ChevronDown className="text-muted-foreground transition group-open:rotate-180" size={16} />
            </summary>
            <div className="absolute right-0 top-12 z-40 w-56 rounded-xl border border-border bg-panel p-2 shadow-[0_18px_48px_hsl(222_47%_3%/0.28)]">
              <div className="px-3 py-2 text-xs">
                <div className="font-medium text-foreground">{user?.email ?? "local session"}</div>
                <div className="text-muted-foreground">Authenticated operator</div>
              </div>
              <Button variant="ghost" className="w-full justify-start" onClick={logout}>
                <LogOut size={16} />
                Log out
              </Button>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
