import dynamic from "next/dynamic";
import { AppShell } from "@/components/dashboard/app-shell";
import { LoadingPulse } from "@/components/ui/loading-pulse";

const ClassifierPanel = dynamic(
  () => import("@/components/dashboard/classifier-panel").then((module) => module.ClassifierPanel),
  {
    ssr: false,
    loading: () => <LoadingPulse />
  }
);

export default function ClassifierPage() {
  return (
    <AppShell>
      <ClassifierPanel />
    </AppShell>
  );
}
