"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BrainCircuit, Database, Gauge, Home, PlugZap, Radar, Settings, Video } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/simulator", label: "Simulator", icon: Radar },
  { href: "/classifier", label: "Classifier", icon: BrainCircuit },
  { href: "/integrations", label: "Integrations", icon: PlugZap },
  { href: "/replays", label: "Replays", icon: Video },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <main className="min-h-screen">
      <aside className="fixed left-0 top-0 hidden h-full w-64 border-r border-slate-800 bg-slate-950/82 p-5 lg:block">
        <Link href="/" className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-cyan-300 text-slate-950">
            <Activity size={22} />
          </div>
          <div>
            <div className="font-semibold text-white">Aeris Sim AI</div>
            <div className="text-xs text-slate-400">Local digital twin</div>
          </div>
        </Link>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-400 transition hover:bg-slate-900 hover:text-white",
                  active && "bg-slate-900 text-cyan-100"
                )}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-5 left-5 right-5 rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-xs text-amber-100">
          Simulation-only mode. No RF transmission or hardware control modules are included.
        </div>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/78 px-4 py-3 backdrop-blur lg:px-8">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-white lg:hidden">
              <Home size={18} />
              Aeris
            </Link>
            <div className="hidden text-sm text-slate-400 lg:block">Synthetic radar operations console</div>
            <div className="flex items-center gap-2 text-xs text-emerald-200">
              <Database size={16} />
              Local SQLite
            </div>
          </div>
        </header>
        <section className="p-4 lg:p-8">{children}</section>
      </div>
    </main>
  );
}
