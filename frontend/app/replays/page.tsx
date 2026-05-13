import dynamic from "next/dynamic";
import { AppShell } from "@/components/dashboard/app-shell";
import { LoadingPulse } from "@/components/ui/loading-pulse";

const ReplayVault = dynamic(
  () => import("@/components/replays/replay-vault").then((module) => module.ReplayVault),
  {
    ssr: false,
    loading: () => <LoadingPulse />
  }
);

export default function ReplaysPage() {
  return (
    <AppShell>
      <ReplayVault />
    </AppShell>
  );
}
