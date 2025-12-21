import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";

interface SummaryStripProps {
  totalSessions: number;
}

export const SummaryStrip = ({ totalSessions }: SummaryStripProps) => {
  return (
    <Card className="bg-card border-border w-fit">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-chart-1/20">
          <CalendarDays className="h-5 w-5 text-chart-1" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Sessions (This Week)</p>
          <p className="text-2xl font-bold">{totalSessions}</p>
        </div>
      </CardContent>
    </Card>
  );
};
