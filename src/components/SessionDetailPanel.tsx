import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Session } from "@/data/mockData";
import { Dumbbell, TrendingUp, Activity, Clock, Target } from "lucide-react";

interface SessionDetailPanelProps {
  session: Session | null;
  open: boolean;
  onClose: () => void;
}

export const SessionDetailPanel = ({ session, open, onClose }: SessionDetailPanelProps) => {
  if (!session) return null;

  const getPerformanceIndicator = (actual: number, target?: [number, number]) => {
    if (!target) return "text-muted-foreground";
    const [min, max] = target;
    if (actual < min) return "text-destructive";
    if (actual > max) return "text-chart-3";
    return "text-chart-2";
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto bg-background">
        <SheetHeader>
          <SheetTitle className="text-2xl font-bold">
            Session Details - {new Date(session.date).toLocaleDateString()}
          </SheetTitle>
          {session.notes && (
            <p className="text-sm text-muted-foreground mt-2">{session.notes}</p>
          )}
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {session.exercises.map((exercise, index) => (
            <Card key={exercise.id} className="border-l-4 border-l-primary">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Dumbbell className="h-5 w-5 text-primary" />
                    {exercise.name}
                  </CardTitle>
                  <Badge variant="outline" className="text-sm">
                    {exercise.sets} × {exercise.reps} @ {exercise.weight} {exercise.weightUnit}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Velocity */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Activity className="h-3 w-3" />
                      <span>Velocity</span>
                    </div>
                    <div className={`text-xl font-bold ${getPerformanceIndicator(exercise.avgVelocity, exercise.targetVelocityRange)}`}>
                      {exercise.avgVelocity} m/s
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Peak: {exercise.peakVelocity} m/s
                    </div>
                    {exercise.targetVelocityRange && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Target className="h-3 w-3" />
                        {exercise.targetVelocityRange[0]}-{exercise.targetVelocityRange[1]} m/s
                      </div>
                    )}
                  </div>

                  {/* ROM */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <TrendingUp className="h-3 w-3" />
                      <span>ROM</span>
                    </div>
                    <div className={`text-xl font-bold ${getPerformanceIndicator(exercise.rom, exercise.targetROMRange)}`}>
                      {exercise.rom} cm
                    </div>
                    {exercise.targetROMRange && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                        <Target className="h-3 w-3" />
                        {exercise.targetROMRange[0]}-{exercise.targetROMRange[1]} cm
                      </div>
                    )}
                  </div>

                  {/* Tempo */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>Tempo</span>
                    </div>
                    <div className="text-xl font-bold">
                      {exercise.tempo} s
                    </div>
                  </div>

                  {/* Weight Context */}
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Load</div>
                    <div className="text-xl font-bold text-primary">
                      {exercise.weight}
                    </div>
                    <div className="text-xs text-muted-foreground">{exercise.weightUnit}</div>
                  </div>
                </div>

                {/* Performance Badge */}
                <div className="mt-4 flex gap-2">
                  {exercise.targetVelocityRange && (
                    <Badge variant={
                      exercise.avgVelocity < exercise.targetVelocityRange[0] ? "destructive" :
                      exercise.avgVelocity > exercise.targetVelocityRange[1] ? "default" :
                      "secondary"
                    }>
                      {exercise.avgVelocity < exercise.targetVelocityRange[0] ? "Below Target" :
                       exercise.avgVelocity > exercise.targetVelocityRange[1] ? "Above Target" :
                       "On Target"} Velocity
                    </Badge>
                  )}
                  {exercise.targetROMRange && (
                    <Badge variant={
                      exercise.rom < exercise.targetROMRange[0] ? "destructive" :
                      exercise.rom > exercise.targetROMRange[1] ? "default" :
                      "secondary"
                    }>
                      {exercise.rom < exercise.targetROMRange[0] ? "Below Target" :
                       exercise.rom > exercise.targetROMRange[1] ? "Above Target" :
                       "On Target"} ROM
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};
