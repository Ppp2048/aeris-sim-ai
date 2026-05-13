import dynamic from "next/dynamic";
import { AppShell } from "@/components/dashboard/app-shell";
import { LoadingPulse } from "@/components/ui/loading-pulse";

const SimulatorConsole = dynamic(
  () => import("@/components/simulator/simulator-console").then((module) => module.SimulatorConsole),
  {
    ssr: false,
    loading: () => <LoadingPulse />
  }
);

export default function SimulatorPage() {
  return (
    <AppShell>
      <SimulatorConsole />
    </AppShell>
  );
}
