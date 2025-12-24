import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Session } from "@/data/mockData";
import { Dumbbell, Activity, Target } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from "recharts";

interface SessionDetailPanelProps {
  session: Session | null;
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
    if (velocity >= min && velocity <= max) {
      return "hsl(142, 76%, 56%)"; // Light green for in target
    }
    return "hsl(var(--destructive))"; // Red for out of target
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-4xl overflow-y-auto bg-background">
        <SheetHeader>
          <SheetTitle className="text-2xl font-bold">
            Session Details - {new Date(session.date).toLocaleDateString()}
          </SheetTitle>
          {session.notes && (
            <p className="text-sm text-muted-foreground mt-2">{session.notes}</p>
          )}
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {session.exercises.map((exercise) => {
            const inTargetCount = exercise.repData.filter(
              rep => rep.velocity >= exercise.targetVelocityMin && rep.velocity <= exercise.targetVelocityMax
            ).length;
            const totalReps = exercise.repData.length;
            const successRate = Math.round((inTargetCount / totalReps) * 100);

            return (
              <Card key={exercise.id} className="border-l-4 border-l-primary">
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Dumbbell className="h-5 w-5 text-primary" />
                      {exercise.name}
                    </CardTitle>
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="outline" className="text-sm">
                        {exercise.sets} × {exercise.reps} @ {exercise.weight} {exercise.weightUnit}
                      </Badge>
                      <Badge 
                        variant="secondary"
                        className="text-sm"
                      >
                        {inTargetCount}/{totalReps} reps in target ({successRate}%)
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Rep Velocity Chart */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Target Velocity: {exercise.targetVelocityMin} - {exercise.targetVelocityMax} m/s
                      </span>
                    </div>
                    <div className="flex gap-3 mb-2 text-xs">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(142, 76%, 56%)" }} />
                        <span>In Target</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(var(--destructive))" }} />
                        <span>Out of Target</span>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={exercise.repData} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis 
                          dataKey="repNumber" 
                          tick={{ fontSize: 11 }}
                          stroke="hsl(var(--muted-foreground))"
                          label={{ value: 'Rep #', position: 'insideBottom', offset: -2, fontSize: 11 }}
                        />
                        <YAxis 
                          tick={{ fontSize: 11 }} 
                          stroke="hsl(var(--muted-foreground))"
                          domain={['auto', 'auto']}
                          tickFormatter={(value) => typeof value === 'number' ? value.toFixed(2) : value}
                          label={{ value: 'm/s', angle: -90, position: 'insideLeft', fontSize: 11 }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                          formatter={(value: number) => [`${value} m/s`, 'Velocity']}
                          labelFormatter={(label) => `Rep ${label}`}
                        />
                        {/* Target zone reference area */}
                        <ReferenceLine 
                          y={exercise.targetVelocityMin} 
                          stroke="hsl(var(--chart-2))" 
                          strokeDasharray="5 5" 
                          strokeWidth={2}
                        />
                        <ReferenceLine 
                          y={exercise.targetVelocityMax} 
                          stroke="hsl(var(--chart-2))" 
                          strokeDasharray="5 5" 
                          strokeWidth={2}
                        />
                        <Bar dataKey="velocity" radius={[4, 4, 0, 0]}>
                          {exercise.repData.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={getRepColor(entry.velocity, exercise.targetVelocityMin, exercise.targetVelocityMax)}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Activity className="h-3 w-3" />
                        <span>Avg Velocity</span>
                      </div>
                      <div className={`text-xl font-bold ${getPerformanceIndicator(exercise.avgVelocity, exercise.targetVelocityMin, exercise.targetVelocityMax)}`}>
                        {exercise.avgVelocity} m/s
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Peak: {exercise.peakVelocity} m/s
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Target className="h-3 w-3" />
                        <span>Target Range</span>
                      </div>
                      <div className="text-xl font-bold">
                        {exercise.targetVelocityMin} - {exercise.targetVelocityMax} m/s
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Load</div>
                      <div className="text-xl font-bold text-primary">
                        {exercise.weight}
                      </div>
                      <div className="text-xs text-muted-foreground">{exercise.weightUnit}</div>
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