import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, TrendingUp, Trophy, AlertCircle } from "lucide-react";

interface SummaryStripProps {
  totalSessions: number;
  avgTeamLoad: number;
  topPerformer: string;
  lowestAttendance: number;
}

export const SummaryStrip = ({ totalSessions, avgTeamLoad, topPerformer, lowestAttendance }: SummaryStripProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card className="bg-card border-border">
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

      <Card className="bg-card border-border">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-chart-2/20">
            <TrendingUp className="h-5 w-5 text-chart-2" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Avg Team Load</p>
            <p className="text-2xl font-bold">{avgTeamLoad}%</p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-chart-3/20">
            <Trophy className="h-5 w-5 text-chart-3" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Top Performer</p>
            <p className="text-lg font-bold truncate">{topPerformer}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-destructive/20">
            <AlertCircle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Lowest Attendance</p>
            <p className="text-2xl font-bold">{lowestAttendance}%</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
