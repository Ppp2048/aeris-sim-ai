import { AppShell } from "@/components/dashboard/app-shell";
import { MonitoringDashboard } from "@/components/dashboard/monitoring-dashboard";

export default function DashboardPage() {
  return (
    <AppShell>
      <MonitoringDashboard />
    </AppShell>
  );
}
