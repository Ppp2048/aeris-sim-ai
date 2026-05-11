import { AppShell } from "@/components/dashboard/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock3, Save } from "lucide-react";

export default function ReplaysPage() {
  return (
    <AppShell>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold text-white">Replay Vault</h1>
          <p className="mt-1 text-sm text-slate-400">Capture and compare local simulation snapshots.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Replay Controls</CardTitle>
            <Clock3 className="text-cyan-200" />
          </CardHeader>
          <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <p>Replay storage is prepared under backend/app/data/replays for simulation snapshots.</p>
            <Button variant="secondary">
              <Save size={18} />
              Save Current Run
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
