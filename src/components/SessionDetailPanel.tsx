import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SessionData } from "@/services/sessionsService";
import { Dumbbell, Activity, Target, Timer, Maximize2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from "recharts";

interface SessionDetailPanelProps {
  session: SessionData | null;
  open: boolean;
  onClose: () => void;
}

export const SessionDetailPanel = ({ session, open, onClose }: SessionDetailPanelProps) => {
  if (!session) return null;

  const getPerformanceIndicator = (actual: number, min?: number, max?: number) => {
    if (min === undefined || max === undefined) return "text-muted-foreground";
    if (actual < min) return "text-destructive";
    if (actual > max) return "text-chart-3";
    return "text-chart-2";
  };

  const getRepColor = (velocity: number, min: number, max: number) => {
    if (velocity >= min && velocity <= max) return "hsl(142, 76%, 56%)";
    return "hsl(var(--destructive))";
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-4xl overflow-y-auto bg-background">
        <SheetHeader>
          <SheetTitle className="text-2xl font-bold">
            Session Details - {new Date(session.date).toLocaleDateString()}
          </SheetTitle>
          {session.notes && <p className="text-sm text-muted-foreground mt-2">{session.notes}</p>}
        </SheetHeader>

        <div className="mt-6 space-y-8">
          {session.exercises.map((exercise) => {
            const inTargetCount = exercise.repData.filter(
              rep => rep.velocity >= exercise.targetVelocityMin && rep.velocity <= exercise.targetVelocityMax
            ).length;
            const totalReps = exercise.repData.length;
            const successRate = Math.round((inTargetCount / totalReps) * 100);

            return (
              <Card key={exercise.id} className="border-l-4 border-l-primary shadow-md">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Dumbbell className="h-5 w-5 text-primary" />
                      {exercise.name}
                    </CardTitle>
                    <div className="flex gap-2">
                      <Badge variant="outline">{exercise.sets} × {exercise.reps} @ {exercise.weight} {exercise.weightUnit}</Badge>
                      <Badge variant="secondary">{successRate}% in Target</Badge>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  {/* 1. VELOCITY CHART */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Target className="h-3 w-3" /> Rep Velocity (m/s)</span>
                      <span>Target: {exercise.targetVelocityMin}-{exercise.targetVelocityMax}</span>
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={exercise.repData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="repNumber" fontSize={10} label={{ value: 'Rep #', position: 'insideBottom', offset: -5, fontSize: 10 }} />
                        <YAxis fontSize={10} domain={['auto', 'auto']} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: "hsl(var(--card))", borderRadius: "8px" }}
                          formatter={(value: number) => [`${value} m/s`, 'Velocity']}
                        />
                        <ReferenceLine y={exercise.targetVelocityMin} stroke="hsl(var(--chart-2))" strokeDasharray="3 3" />
                        <Bar dataKey="velocity" radius={[4, 4, 0, 0]}>
                          {exercise.repData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={getRepColor(entry.velocity, exercise.targetVelocityMin, exercise.targetVelocityMax)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* 2. RANGE OF MOTION CHART - PHASE 22 NEW */}
                  <div className="space-y-2 pt-4 border-t border-border/50">
                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Maximize2 className="h-3 w-3" /> Range of Motion Consistency (mm)</span>
                    </div>
                    <ResponsiveContainer width="100%" height={120}>
                      <BarChart data={exercise.repData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="repNumber" hide />
                        <YAxis hide domain={['dataMin - 50', 'dataMax + 50']} />
                        <Tooltip formatter={(value: number) => [`${value} mm`, 'Depth']} />
                        <Bar dataKey="rom" fill="hsl(var(--primary))" opacity={0.6} radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* 3. ENHANCED STATS GRID */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
                        <Activity className="h-3 w-3" /> Velocity
                      </span>
                      <div className={`text-lg font-bold ${getPerformanceIndicator(exercise.avgVelocity, exercise.targetVelocityMin, exercise.targetVelocityMax)}`}>
                        {exercise.avgVelocity} <span className="text-xs font-normal">m/s</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
                        <Maximize2 className="h-3 w-3" /> Avg ROM
                      </span>
                      <div className="text-lg font-bold">
                        {exercise.avgROM} <span className="text-xs font-normal">mm</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
                        <Timer className="h-3 w-3" /> Explosiveness
                      </span>
                      <div className="text-lg font-bold">
                        {exercise.avgTempo} <span className="text-xs font-normal">s</span>
                      </div>
                    </div>

                    <div className="space-y-1 text-right">
                      <span className="text-[10px] uppercase text-muted-foreground">Peak Speed</span>
                      <div className="text-lg font-bold text-chart-5">
                        {exercise.peakVelocity} <span className="text-xs font-normal">m/s</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
};