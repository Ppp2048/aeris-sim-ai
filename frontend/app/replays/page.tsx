import { AppShell } from "@/components/dashboard/app-shell";
import { ReplayVault } from "@/components/replays/replay-vault";

export default function ReplaysPage() {
  return (
    <AppShell>
      <ReplayVault />
    </AppShell>
  );
}
