import { AppShell } from "@/components/dashboard/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/ui/section-header";

const integrations = [
  ["sample_csv_parser", "Local CSV parser for synthetic radar datasets", ".csv"],
  ["aeris-random-forest-local", "scikit-learn classifier registry entry", ".txt marker"],
  ["heuristic-signal-profile", "Fallback software classifier for offline runs", "built-in"]
];

export default function IntegrationsPage() {
  return (
    <AppShell>
      <div className="space-y-5">
        <SectionHeader title="Custom Integrations" description="Local parser and model registries for offline experimentation." />
        <div className="grid gap-4 lg:grid-cols-3">
          {integrations.map(([name, description, type]) => (
            <Card key={name}>
              <CardHeader>
                <CardTitle>{name}</CardTitle>
                <Badge>{type}</Badge>
              </CardHeader>
              <CardContent>{description}</CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
