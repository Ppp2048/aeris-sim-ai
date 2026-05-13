"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppBackground } from "@/components/ui/app-background";
import { LoadingPulse } from "@/components/ui/loading-pulse";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { clearToken, readToken } from "@/lib/auth";
import { getMe } from "@/lib/api";
import type { User } from "@/lib/types";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("aeris_sidebar_collapsed");
    setSidebarCollapsed(stored === "true");
  }, []);

  useEffect(() => {
    function handleCommandSearch(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) return;
      const search = document.querySelector<HTMLInputElement>("[data-command-search='true']");
      if (!search) return;
      event.preventDefault();
      search.focus();
    }

    window.addEventListener("keydown", handleCommandSearch);
    return () => window.removeEventListener("keydown", handleCommandSearch);
  }, []);

  function toggleSidebar() {
    setSidebarCollapsed((value) => {
      const next = !value;
      window.localStorage.setItem("aeris_sidebar_collapsed", String(next));
      return next;
    });
  }

  useEffect(() => {
    let cancelled = false;
    const token = readToken();
    if (!token) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    getMe(token)
      .then((result) => {
        if (!cancelled) setUser(result);
      })
      .catch(() => {
        clearToken();
        router.replace("/login");
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (checking) {
    return (
      <main className="relative min-h-screen overflow-x-hidden bg-background">
        <AppBackground />
        <div className="mx-auto flex min-h-screen max-w-xl items-center p-6">
          <LoadingPulse className="w-full" />
        </div>
      </main>
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <AppBackground />
      <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      <div className={sidebarCollapsed ? "relative z-10 min-h-screen lg:pl-20" : "relative z-10 min-h-screen lg:pl-[280px]"}>
        <Topbar user={user} />
        <Sidebar mobile />
        <main
          key={pathname}
          className="mx-auto w-full max-w-[1600px] px-5 py-6 md:px-6 lg:px-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
