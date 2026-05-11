import type { Detection } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DetectionTable({ detections }: { detections: Detection[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>CFAR Detections</CardTitle>
        <span className="text-xs text-muted-foreground">{detections.length} active tracks</span>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              <tr>
                <th className="pb-3">Track</th>
                <th className="pb-3">Class</th>
                <th className="pb-3">Range</th>
                <th className="pb-3">Velocity</th>
                <th className="pb-3">Power</th>
                <th className="pb-3">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {detections.map((item) => (
                <tr key={`${item.track_id}-${item.range_m}-${item.velocity_mps}`} className="text-muted-foreground">
                  <td className="py-3 text-foreground">#{item.track_id}</td>
                  <td className="py-3">
                    <Badge>{item.classification}</Badge>
                  </td>
                  <td className="py-3">{item.range_m.toFixed(1)} m</td>
                  <td className="py-3">{item.velocity_mps.toFixed(1)} m/s</td>
                  <td className="py-3">{item.power.toFixed(3)}</td>
                  <td className="py-3">{Math.round(item.confidence * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          {detections.length === 0 && <div className="py-8 text-center text-muted-foreground">No detections yet.</div>}
        </div>
      </CardContent>
    </Card>
  );
}
