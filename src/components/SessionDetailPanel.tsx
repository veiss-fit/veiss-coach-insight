import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SessionData } from "@/services/sessionsService";
import { Dumbbell, Activity, Maximize2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea, ReferenceLine } from "recharts";
import { format, parseISO } from "date-fns";

interface SessionDetailPanelProps {
  session: SessionData | null;
  open: boolean;
  onClose: () => void;
  isSelfLoggedSession?: boolean;
}

export const SessionDetailPanel = ({ session, open, onClose, isSelfLoggedSession = false }: SessionDetailPanelProps) => {
  const [selectedSetByExercise, setSelectedSetByExercise] = useState<Record<string, string>>({});

  if (!session) return null;

  const getPerformanceIndicator = (actual: number, min?: number, max?: number) => {
    if (min === undefined || max === undefined) return "text-muted-foreground";
    if (actual < min) return "text-destructive";
    if (actual > max) return "text-chart-3";
    return "text-chart-2";
  };

  const getSetOptions = (exercise: SessionData["exercises"][number]) => {
    return Array.from(new Set(exercise.repData.map((rep) => rep.setNumber))).sort((a, b) => a - b);
  };

  const buildYAxisTicks = (maxValue: number, decimals: number) => {
    if (maxValue <= 0) return [0];
    const step = maxValue / 4;
    return [0, step, step * 2, step * 3].map((tick) => Number(tick.toFixed(decimals)));
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-4xl overflow-y-auto bg-background">
        <SheetHeader>
          <SheetTitle className="text-2xl font-bold">
            Session Details - {format(parseISO(session.date), "PP")}
          </SheetTitle>
          {session.notes && <p className="text-sm text-muted-foreground mt-2">{session.notes}</p>}
        </SheetHeader>

        <div className="mt-6 space-y-8">
          {session.exercises.map((exercise) => {
            const setOptions = getSetOptions(exercise);
            const selectedSet = selectedSetByExercise[exercise.id] || String(setOptions[0] || 1);
            const hasTargetZone = !isSelfLoggedSession && exercise.targetVelocityMax > exercise.targetVelocityMin && exercise.targetVelocityMax > 0;
            const filteredRepData = exercise.repData.filter(
              (rep) => rep.setNumber === Number(selectedSet)
            );

            const chartData = filteredRepData.map((rep, index) => ({
              ...rep,
              velocity: Number(rep.velocity.toFixed(2)),
              rom: Math.round(rep.rom),
              repLabel: `R${rep.repNumber}`,
              repIndex: index + 1,
            }));

            const velocityMax = Math.max(
              ...(hasTargetZone ? [exercise.targetVelocityMax] : []),
              ...chartData.map((rep) => rep.velocity),
              0
            ) + 0.05;

            const romMax = Math.max(...chartData.map((rep) => rep.rom), 0) + 50;

            return (
              <Card key={exercise.id} className="border-l-4 border-l-primary shadow-md">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Dumbbell className="h-5 w-5 text-primary" />
                      {exercise.name}
                    </CardTitle>
                    <div className="w-[180px]">
                      <Select
                        value={selectedSet}
                        onValueChange={(value) =>
                          setSelectedSetByExercise((prev) => ({ ...prev, [exercise.id]: value }))
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select set" />
                        </SelectTrigger>
                        <SelectContent>
                          {setOptions.map((setNumber) => (
                            <SelectItem key={setNumber} value={String(setNumber)}>
                              Set {setNumber}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  {/* 1. VELOCITY CHART */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Activity className="h-3 w-3" /> Rep Velocity (m/s)</span>
                      {hasTargetZone ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="h-5 px-2 text-[10px] border-chart-2/40 text-chart-2">
                            Target Zone
                          </Badge>
                          <span>{exercise.targetVelocityMin.toFixed(2)}-{exercise.targetVelocityMax.toFixed(2)} m/s</span>
                        </div>
                      ) : null}
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={chartData} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
                        <XAxis dataKey="repLabel" fontSize={10} interval="preserveStartEnd" />
                        <YAxis
                          fontSize={10}
                          width={36}
                          domain={[0, velocityMax]}
                          ticks={buildYAxisTicks(velocityMax, 2)}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: "hsl(var(--card))", borderRadius: "8px" }}
                          formatter={(value: number) => [`${Number(value).toFixed(2)} m/s`, 'Velocity']}
                        />
                        {hasTargetZone && (
                          <ReferenceArea
                            y1={exercise.targetVelocityMin}
                            y2={exercise.targetVelocityMax}
                            fill="hsl(var(--chart-2))"
                            fillOpacity={0.12}
                          />
                        )}
                        {hasTargetZone && (
                          <ReferenceLine y={exercise.targetVelocityMin} stroke="hsl(var(--chart-2))" strokeWidth={2} strokeDasharray="4 4" />
                        )}
                        {hasTargetZone && (
                          <ReferenceLine y={exercise.targetVelocityMax} stroke="hsl(var(--chart-2))" strokeWidth={2} strokeDasharray="4 4" />
                        )}
                        <Line
                          type="monotone"
                          dataKey="velocity"
                          stroke="hsl(142, 76%, 45%)"
                          strokeWidth={2.5}
                          dot={{ r: 3, fill: "hsl(142, 76%, 45%)" }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* 2. VERTICAL DISPLACEMENT CHART */}
                  <div className="space-y-2 pt-4 border-t border-border/50">
                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Maximize2 className="h-3 w-3" /> Vertical Displacement (mm)</span>
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={chartData} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
                        <XAxis dataKey="repLabel" fontSize={10} interval="preserveStartEnd" />
                        <YAxis
                          fontSize={10}
                          width={36}
                          domain={[0, romMax]}
                          ticks={buildYAxisTicks(romMax, 0)}
                        />
                        <Tooltip formatter={(value: number) => [`${Math.round(Number(value))} mm`, 'Depth']} />
                        <Line
                          type="monotone"
                          dataKey="rom"
                          stroke="hsl(42, 95%, 50%)"
                          strokeWidth={2.5}
                          dot={{ r: 3, fill: "hsl(42, 95%, 50%)" }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* 3. ENHANCED STATS GRID */}
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
                        <Activity className="h-3 w-3" /> Peak Velocity
                      </span>
                      <div className={`text-lg font-bold ${getPerformanceIndicator(exercise.peakVelocity, hasTargetZone ? exercise.targetVelocityMin : undefined, hasTargetZone ? exercise.targetVelocityMax : undefined)}`}>
                        {exercise.peakVelocity} <span className="text-xs font-normal">m/s</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
                        <Maximize2 className="h-3 w-3" /> Avg Displacement
                      </span>
                      <div className="text-lg font-bold">
                        {exercise.avgROM} <span className="text-xs font-normal">mm</span>
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