import { AppShell } from "@/components/dashboard/app-shell";
import { SimulatorConsole } from "@/components/simulator/simulator-console";

export default function SimulatorPage() {
  return (
    <AppShell>
      <SimulatorConsole />
    </AppShell>
  );
}
