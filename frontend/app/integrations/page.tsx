import dynamic from "next/dynamic";
import { AppShell } from "@/components/dashboard/app-shell";
import { LoadingPulse } from "@/components/ui/loading-pulse";

const IntegrationsWorkspace = dynamic(
  () => import("@/components/integrations/integrations-workspace").then((module) => module.IntegrationsWorkspace),
  {
    ssr: false,
    loading: () => <LoadingPulse />
  }
);

export default function IntegrationsPage() {
  return (
    <AppShell>
      <IntegrationsWorkspace />
    </AppShell>
  );
}
