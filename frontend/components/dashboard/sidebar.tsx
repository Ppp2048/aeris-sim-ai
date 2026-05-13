"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BrainCircuit,
  ChevronsLeft,
  ChevronsRight,
  Command,
  Gauge,
  PlugZap,
  Radar,
  Search,
  Settings,
  ShieldCheck,
  Video
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/simulator", label: "Simulator", icon: Radar },
  { href: "/classifier", label: "Classifier", icon: BrainCircuit },
  { href: "/integrations", label: "Integrations", icon: PlugZap },
  { href: "/replays", label: "Replays", icon: Video },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function Sidebar({
  mobile = false,
  collapsed = false,
  onToggle
}: {
  mobile?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const pathname = usePathname();
  return (
    <aside
      className={cn(
        "border-border text-panel-foreground",
        mobile
          ? "command-surface sticky top-[57px] z-20 flex gap-2 overflow-x-auto border-b px-4 py-2 lg:hidden"
          : cn("command-surface fixed left-0 top-0 z-40 hidden h-screen flex-col border-r p-4 transition-all duration-200 lg:flex", collapsed ? "w-20" : "w-[280px]")
      )}
    >
      {!mobile && (
        <div className="mb-6 flex items-center gap-3">
          <Link href="/" className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/25 bg-zinc-950 text-primary shadow-[0_0_18px_hsl(var(--primary)/0.12)] dark:bg-zinc-950">
              <Activity size={22} />
            </div>
            <div className={cn("min-w-0 transition", collapsed && "hidden")}>
              <div className="font-display font-semibold text-foreground">AERIS-Sim AI</div>
              <div className="text-xs text-muted-foreground">Radar digital twin</div>
            </div>
          </Link>
          <button
            type="button"
            onClick={onToggle}
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/45 text-muted-foreground transition hover:border-primary/35 hover:text-primary lg:flex"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          </button>
        </div>
      )}
      {!mobile && !collapsed && (
        <div className="mb-5 rounded-xl border border-border bg-muted/35 p-2">
          <label className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs text-muted-foreground">
            <Search size={15} />
            <input
              data-command-search="true"
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
              placeholder="Search modules"
              onChange={() => undefined}
            />
            <span className="rounded border border-border bg-panel px-1.5 py-0.5 font-mono text-[10px]">/</span>
          </label>
        </div>
      )}
      {!mobile && collapsed && (
        <button
          type="button"
          data-command-search="true"
          className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-muted/35 text-muted-foreground outline-none transition focus:border-primary focus:text-primary"
          aria-label="Command search"
        >
          <Search size={17} />
        </button>
      )}
      {!mobile && !collapsed && (
        <div className="mb-2 flex items-center gap-2 px-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          <Command size={12} />
          Modules
        </div>
      )}
      <nav className={cn(mobile ? "flex gap-2" : "space-y-1")}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:border-[var(--app-border)] hover:bg-muted/65 hover:text-foreground",
                active && "border-[var(--app-border)] bg-muted text-foreground shadow-[inset_3px_0_0_hsl(var(--primary))]",
                mobile && "whitespace-nowrap",
                collapsed && !mobile && "justify-center px-2"
              )}
              title={collapsed && !mobile ? item.label : undefined}
            >
              <Icon className="transition group-hover:scale-105" size={18} />
              {(!collapsed || mobile) && item.label}
            </Link>
          );
        })}
      </nav>
      {!mobile && !collapsed && (
        <div className="mt-auto rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-700 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.05)] dark:text-amber-100">
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <ShieldCheck size={15} />
            Local Simulation
          </div>
          <p>No RF transmission, hardware control, PCB, STM32, or FPGA modules are included.</p>
          <StatusBadge tone="online" className="mt-3">
            Backend linked
          </StatusBadge>
        </div>
      )}
    </aside>
  );
}
