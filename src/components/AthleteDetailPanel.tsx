import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Athlete, generateSessionLogs, Session } from "@/data/mockData";
import { Activity, TrendingUp, Clock, Calendar, ChevronRight, Dumbbell, Target } from "lucide-react";
import { SessionDetailPanel } from "./SessionDetailPanel";

interface AthleteDetailPanelProps {
  athlete: Athlete | null;
  open: boolean;
  onClose: () => void;
}

export const AthleteDetailPanel = ({ athlete, open, onClose }: AthleteDetailPanelProps) => {
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  
  if (!athlete) return null;

  const sessionLogs = generateSessionLogs(athlete.id);

  // Calculate session stats
  const getSessionStats = (session: Session) => {
    const totalExercises = session.exercises.length;
    let totalInTarget = 0;
    let totalReps = 0;

    session.exercises.forEach(ex => {
      ex.repData.forEach(rep => {
        totalReps++;
        if (rep.velocity >= ex.targetVelocityMin && rep.velocity <= ex.targetVelocityMax) {
          totalInTarget++;
        }
      });
    });

    const successRate = totalReps > 0 ? Math.round((totalInTarget / totalReps) * 100) : 0;
    return { totalExercises, totalReps, totalInTarget, successRate };
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

          {/* Sessions List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Training Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {sessionLogs.map((session) => {
                  const stats = getSessionStats(session);
                  return (
                    <Button
                      key={session.id}
                      variant="outline"
                      className="w-full justify-between h-auto p-4 hover:bg-primary/10"
                      onClick={() => setSelectedSession(session)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-left">
                          <p className="font-semibold">
                            {new Date(session.date).toLocaleDateString('en-US', { 
                              weekday: 'short', 
                              month: 'short', 
                              day: 'numeric' 
                            })}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <Dumbbell className="h-3 w-3" />
                            <span>{stats.totalExercises} exercises</span>
                            <span>•</span>
                            <span>{stats.totalReps} reps</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <Badge 
                            variant={stats.successRate >= 70 ? "secondary" : stats.successRate >= 50 ? "outline" : "destructive"}
                            className="flex items-center gap-1"
                          >
                            <Target className="h-3 w-3" />
                            {stats.successRate}% on target
                          </Badge>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Button>
                  );
                })}
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