"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BrainCircuit, Gauge, PlugZap, Radar, Settings, ShieldCheck, Video } from "lucide-react";
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

export function Sidebar({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  return (
    <aside
      className={cn(
        "border-border bg-panel/88 text-panel-foreground backdrop-blur-xl",
        mobile
          ? "sticky top-14 z-20 flex gap-2 overflow-x-auto border-b px-4 py-2 lg:hidden"
          : "fixed left-0 top-0 hidden h-full w-64 flex-col border-r p-5 lg:flex"
      )}
    >
      {!mobile && (
        <Link href="/" className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-slate-950 shadow-glow">
            <Activity size={22} />
          </div>
          <div>
            <div className="font-semibold text-foreground">AERIS-Sim AI</div>
            <div className="text-xs text-muted-foreground">Radar digital twin</div>
          </div>
        </Link>
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
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground",
                active && "bg-primary/12 text-primary",
                mobile && "whitespace-nowrap"
              )}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      {!mobile && (
        <div className="mt-auto rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-700 dark:text-amber-100">
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
