"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LoadingPulse } from "@/components/ui/loading-pulse";
import { RadarGridBackground } from "@/components/ui/radar-grid-background";
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
      <main className="min-h-screen">
        <RadarGridBackground />
        <div className="mx-auto flex min-h-screen max-w-xl items-center p-6">
          <LoadingPulse className="w-full" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <RadarGridBackground />
      <Sidebar />
      <div className="lg:pl-64">
        <Topbar user={user} />
        <Sidebar mobile />
        <motion.section
          key={pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="p-4 lg:p-8"
        >
          {children}
        </motion.section>
      </div>
    </main>
  );
}
