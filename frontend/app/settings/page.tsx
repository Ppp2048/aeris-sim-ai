import { AppShell } from "@/components/dashboard/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function SettingsPage() {
  return (
    <AppShell>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold text-white">Settings</h1>
          <p className="mt-1 text-sm text-slate-400">Local runtime configuration for the simulation console.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Runtime</CardTitle>
            <Badge>Local only</Badge>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border border-slate-800 bg-slate-950 p-4">Backend: localhost:8000</div>
            <div className="rounded-md border border-slate-800 bg-slate-950 p-4">Frontend: localhost:3000</div>
            <div className="rounded-md border border-slate-800 bg-slate-950 p-4">Database: SQLite</div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
