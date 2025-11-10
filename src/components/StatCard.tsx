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
    <Card className="bg-card border-border hover:border-gold transition-colors">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-3xl font-bold text-foreground">{value}</p>
            {subtitle && (
              <p className={`text-sm font-medium ${status ? statusColors[status] : "text-muted-foreground"}`}>
                {subtitle}
              </p>
            )}
          </div>
          <div className={`p-3 rounded-lg ${status ? "bg-navy-light/20" : "bg-muted"}`}>
            <Icon className={`h-6 w-6 ${status ? statusColors[status] : "text-navy-light"}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
