import { AppShell } from "@/components/dashboard/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/ui/section-header";

export default function SettingsPage() {
  return (
    <AppShell>
      <div className="space-y-5">
        <SectionHeader title="Settings" description="Local runtime configuration for the simulation console." />
        <Card>
          <CardHeader>
            <CardTitle>Runtime</CardTitle>
            <Badge>Local only</Badge>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border border-border bg-muted/45 p-4">Backend: localhost:8000</div>
            <div className="rounded-md border border-border bg-muted/45 p-4">Frontend: localhost:3000</div>
            <div className="rounded-md border border-border bg-muted/45 p-4">Database: SQLite</div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
