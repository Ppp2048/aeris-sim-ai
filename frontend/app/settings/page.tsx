import dynamic from "next/dynamic";
import { AppShell } from "@/components/dashboard/app-shell";
import { LoadingPulse } from "@/components/ui/loading-pulse";

const SettingsPanel = dynamic(
  () => import("@/components/settings/settings-panel").then((module) => module.SettingsPanel),
  {
    ssr: false,
    loading: () => <LoadingPulse />
  }
);

export default function SettingsPage() {
  return (
    <AppShell>
      <SettingsPanel />
    </AppShell>
  );
}
