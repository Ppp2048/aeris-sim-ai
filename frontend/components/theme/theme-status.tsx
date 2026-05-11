import { Moon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function ThemeStatus() {
  return (
    <Badge className="border-slate-600 bg-slate-900 text-slate-200">
      <Moon size={14} />
      Dark console
    </Badge>
  );
}
