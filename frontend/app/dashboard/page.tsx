import dynamic from "next/dynamic";
import { AppShell } from "@/components/dashboard/app-shell";
import { LoadingPulse } from "@/components/ui/loading-pulse";

const MonitoringDashboard = dynamic(
  () => import("@/components/dashboard/monitoring-dashboard").then((module) => module.MonitoringDashboard),
  {
    ssr: false,
    loading: () => <LoadingPulse />
  }
);

export default function DashboardPage() {
  return (
    <AppShell>
      <MonitoringDashboard />
    </AppShell>
  );
}
