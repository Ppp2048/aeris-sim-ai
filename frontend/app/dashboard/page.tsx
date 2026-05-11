import { AppShell } from "@/components/dashboard/app-shell";
import { SystemChart } from "@/components/dashboard/system-chart";
import { SimulatorConsole } from "@/components/simulator/simulator-console";

export default function DashboardPage() {
  return (
    <AppShell>
      <div className="space-y-5">
        <SimulatorConsole autoRun />
        <SystemChart />
      </div>
    </AppShell>
  );
}
