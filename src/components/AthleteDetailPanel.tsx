import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Athlete, generatePerformanceHistory, generateSessionLogs, Session } from "@/data/mockData";
import { Activity, TrendingUp, Clock, Calendar } from "lucide-react";
import { SessionDetailPanel } from "./SessionDetailPanel";

interface AthleteDetailPanelProps {
  athlete: Athlete | null;
  open: boolean;
  onClose: () => void;
}

export const AthleteDetailPanel = ({ athlete, open, onClose }: AthleteDetailPanelProps) => {
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  
  if (!athlete) return null;

  const performanceHistory = generatePerformanceHistory(athlete.id);
  const sessionLogs = generateSessionLogs(athlete.id);

  const getLoadRecColor = (loadRec: string) => {
    if (loadRec.includes("+")) return "bg-chart-3 text-navy-dark";
    if (loadRec.includes("-")) return "bg-destructive text-white";
    return "bg-navy-light text-white";
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto bg-background">
        <SheetHeader>
          <SheetTitle className="text-2xl font-bold">{athlete.name}</SheetTitle>
          <div className="flex gap-2 mt-2">
            <Badge variant="outline">{athlete.sport}</Badge>
            <Badge variant="outline">{athlete.level}</Badge>
            <Badge variant="outline">{athlete.group}</Badge>
            <Badge className={getLoadRecColor(athlete.loadRec)}>Load: {athlete.loadRec}</Badge>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Current Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="h-4 w-4 text-chart-1" />
                  <p className="text-xs text-muted-foreground">Velocity</p>
                </div>
                <p className="text-2xl font-bold">{athlete.avgVelocity} m/s</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-chart-2" />
                  <p className="text-xs text-muted-foreground">ROM</p>
                </div>
                <p className="text-2xl font-bold">{athlete.rom} cm</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-chart-3" />
                  <p className="text-xs text-muted-foreground">Tempo</p>
                </div>
                <p className="text-2xl font-bold">{athlete.tempo} s</p>
              </CardContent>
            </Card>
          </div>

          {/* Velocity Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Velocity Trend (30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={performanceHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => new Date(value).getDate().toString()}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Line type="monotone" dataKey="velocity" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* ROM Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Range of Motion Trend (30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={performanceHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => new Date(value).getDate().toString()}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Line type="monotone" dataKey="rom" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Recent Sessions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Recent Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {sessionLogs.slice(0, 5).map((session) => (
                  <Button
                    key={session.id}
                    variant="outline"
                    className="w-full justify-between h-auto p-3 hover:bg-primary/10"
                    onClick={() => setSelectedSession(session)}
                  >
                    <div className="text-left">
                      <p className="font-semibold">{new Date(session.date).toLocaleDateString()}</p>
                      <p className="text-sm text-muted-foreground">{session.exercises.length} exercises</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Click for details</p>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </SheetContent>
      
      <SessionDetailPanel
        session={selectedSession}
        open={!!selectedSession}
        onClose={() => setSelectedSession(null)}
      />
    </Sheet>
  );
};
