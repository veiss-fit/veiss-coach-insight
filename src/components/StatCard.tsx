import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  status?: "success" | "warning" | "danger";
  subtitle?: string;
}

export const StatCard = ({ title, value, icon: Icon, status, subtitle }: StatCardProps) => {
  const statusColors = {
    success: "text-chart-3",
    warning: "text-gold",
    danger: "text-destructive",
  };

  return (
    <Card className="bg-[#fbfbfc] border-border hover:border-gold transition-colors">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-3xl font-bold text-foreground leading-tight">{value}</p>
            {subtitle && (
              <p className={`text-sm font-medium ${status ? statusColors[status] : "text-muted-foreground"}`}>
                {subtitle}
              </p>
            )}
          </div>
          <div className="shrink-0 p-3 rounded-lg bg-muted">
            <Icon className={`h-7 w-7 ${status ? statusColors[status] : "text-muted-foreground"}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
