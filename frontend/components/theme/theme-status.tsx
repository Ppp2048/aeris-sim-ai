import { Moon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function ThemeStatus() {
  return (
    <Badge className="border-border bg-muted text-muted-foreground">
      <Moon size={14} />
      Dark console
    </Badge>
  );
}
