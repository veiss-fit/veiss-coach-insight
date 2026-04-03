import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Athlete } from "@/data/mockData";
import { 
  Calendar, 
  ChevronRight, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Dumbbell,
  Activity
} from "lucide-react";
import { toast } from "sonner";
import { getPlayerWorkoutPlans } from "@/services/workoutPlansService";
import { getPlayerSessions, SessionData } from "@/services/sessionsService"; // Import this back
import { SessionDetailPanel } from "./SessionDetailPanel"; // Import this back
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { findMatchingSessionForPlan, getAttendanceSummary, WorkoutSessionLike } from "@/lib/workoutAttendance";
import { format, isPast, isToday, parseISO, isSameDay } from "date-fns";

interface AthleteDetailPanelProps {
  athlete: Athlete | null;
  open: boolean;
  onClose: () => void;
}

export const AthleteDetailPanel = ({ athlete, open, onClose }: AthleteDetailPanelProps) => {
  const [plans, setPlans] = useState<any[]>([]);
  const [sessions, setSessions] = useState<SessionData[]>([]); // Store actual performance data
  // Combined timeline state
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Two types of selected state
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null); // For Pending/Missed
  const [selectedSession, setSelectedSession] = useState<SessionData | null>(null); // For Completed (Graphs)

  useEffect(() => {
    if (athlete && open) {
      loadData();
    }
  }, [athlete?.id, open]);

  const loadData = async () => {
    if (!athlete) return;
    try {
      setLoading(true);
      // Fetch both Plans (Assignments) and Sessions (Actual Results)
      const [plansData, sessionsData] = await Promise.all([
        getPlayerWorkoutPlans(athlete.id),
        getPlayerSessions(athlete.id, (athlete as any).user_id)
      ]);
      setPlans(plansData);
      setSessions(sessionsData);

      const attendanceSummary = getAttendanceSummary(
        plansData.map((plan: any) => ({
          date: plan.date,
          title: plan.title,
          is_completed: plan.is_completed,
        })),
        sessionsData.map((session: SessionData) => ({
          id: session.id,
          date: session.date,
          name: session.notes,
        }))
      );

      // Merge and sort timeline: each item gets a type
      const planItems = plansData.map((plan: any) => ({
        ...plan,
        _timelineType: 'plan',
        _timelineDate: plan.date,
      }));
      const sessionItems = sessionsData
        .filter((session) => !attendanceSummary.matchedSessionIds.has(session.id))
        .map((session: any) => ({
          ...session,
          _timelineType: 'session',
          _timelineDate: session.date,
        }));
      // Merge and sort by date descending
      const merged = [...planItems, ...sessionItems].sort(
        (a, b) => parseISO(b._timelineDate).getTime() - parseISO(a._timelineDate).getTime()
      );
      setTimeline(merged);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load athlete history');
    } finally {
      setLoading(false);
    }
  };
  
  if (!athlete) return null;

  const normalize = (value?: string) => (value || '').trim().toLowerCase();
  const attendanceSessions: WorkoutSessionLike[] = sessions.map((session) => ({
    id: session.id,
    date: session.date,
    name: session.notes,
  }));
  const attendanceSummary = getAttendanceSummary(
    plans.map((plan: any) => ({
      date: plan.date,
      title: plan.title,
      is_completed: plan.is_completed,
    })),
    attendanceSessions
  );

  const applyPlanTargetsToSession = (session: SessionData, plan: any): SessionData => {
    const planExercises = Array.isArray(plan?.exercises) ? plan.exercises : [];

    return {
      ...session,
      exercises: session.exercises.map((exercise) => {
        const matchingPlanExercise = planExercises.find(
          (planExercise: any) => normalize(planExercise?.name) === normalize(exercise.name)
        );

        if (!matchingPlanExercise) {
          return exercise;
        }

        return {
          ...exercise,
          targetVelocityMin: Number(matchingPlanExercise.targetVelocityMin) || 0,
          targetVelocityMax: Number(matchingPlanExercise.targetVelocityMax) || 0,
        };
      }),
    };
  };

  const hasSessionForPlan = (plan: any) => {
    return !!findMatchingSessionForPlan(
      { date: plan.date, title: plan.title },
      attendanceSessions
    );
  };

  const getMatchingSessionForPlan = (plan: any) => {
    const matchedSession = findMatchingSessionForPlan(
      { date: plan.date, title: plan.title },
      attendanceSessions
    );
    return matchedSession ? sessions.find((session) => session.id === matchedSession.id) || null : null;
  };

  const getPlanStatus = (plan: any) => {
    if (plan.is_completed || hasSessionForPlan(plan)) return 'completed';
    const planDate = parseISO(plan.date);
    if (isPast(planDate) && !isToday(planDate)) return 'missed';
    return 'pending';
  };

  const completedPlanCount = attendanceSummary.completedPlanCount;
  const pendingPlanCount = attendanceSummary.pendingPlanCount;
  const missedPlanCount = attendanceSummary.missedPlanCount;
  const selfLoggedCompletedCount = attendanceSummary.selfLoggedCompletedCount;
  const completedWorkoutCount = attendanceSummary.completedTrackedCount;

  // Handle click for timeline items
  const handleTimelineItemClick = (item: any) => {
    if (item._timelineType === 'plan') {
      // Use existing logic for plans
      const status = getPlanStatus(item);
      if (status === 'completed') {
        const matchingSession = getMatchingSessionForPlan(item);
        if (matchingSession) {
          setSelectedSession(applyPlanTargetsToSession(matchingSession, item));
        } else {
          setSelectedPlan(item);
        }
      } else {
        setSelectedPlan(item);
      }
    } else if (item._timelineType === 'session') {
      setSelectedSession(item);
    }
  };

  // Logic to handle click: 
  // If completed, try to find the matching rich session data. 
  // If not found (or pending), show simple plan.
  const handleItemClick = (plan: any) => {
    const status = getPlanStatus(plan);

    if (status === 'completed') {
      const matchingSession = getMatchingSessionForPlan(plan);

      if (matchingSession) {
        setSelectedSession(applyPlanTargetsToSession(matchingSession, plan)); // Open the Graphs View
      } else {
        // Fallback if completed manually without data
        setSelectedPlan(plan); 
      }
    } else {
      setSelectedPlan(plan); // Open the Simple View
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent className="w-full sm:max-w-xl overflow-hidden flex flex-col bg-background">
          <LoadingOverlay isLoading={loading} fullScreen message="Loading history..." />
          <SheetHeader className="pb-4 border-b">
            <SheetTitle className="text-2xl font-bold">{athlete.name}</SheetTitle>
            <div className="flex gap-2 mt-2">
              <Badge variant="outline">{athlete.sport}</Badge>
              <Badge variant="outline">{athlete.level}</Badge>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto py-6">
            {/* Stats Summary Card */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {completedWorkoutCount}
                  </div>
                  <div className="text-xs text-muted-foreground">Completed</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-destructive">
                    {missedPlanCount}
                  </div>
                  <div className="text-xs text-muted-foreground">Missed</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {pendingPlanCount}
                  </div>
                  <div className="text-xs text-muted-foreground">Pending</div>
                </CardContent>
              </Card>
            </div>

            {/* Timeline List: Assigned Plans + Self-Logged Sessions */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Workout Timeline
              </h3>

              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading history...</div>
              ) : timeline.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed rounded-lg">
                  <p className="text-muted-foreground">No workouts found.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {timeline.map((item) => {
                    const isPlan = item._timelineType === 'plan';
                    const isSession = item._timelineType === 'session';
                    const dateObj = parseISO(item._timelineDate);
                    let status = null;
                    if (isPlan) status = getPlanStatus(item);
                    return (
                      <div
                        key={item._timelineType + '-' + item.id}
                        className="group flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => handleTimelineItemClick(item)}
                      >
                        <div className="flex items-start gap-4">
                          {/* Status/Icon */}
                          <div className="mt-1">
                            {isPlan && status === 'completed' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                            {isPlan && status === 'missed' && <AlertCircle className="h-5 w-5 text-destructive" />}
                            {isPlan && status === 'pending' && <Clock className="h-5 w-5 text-blue-500" />}
                            {isSession && <Activity className="h-5 w-5 text-primary" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold">
                                {isPlan ? item.title : (item.notes || 'Self-Logged Session')}
                              </h4>
                              <Badge variant={isPlan ? 'secondary' : 'default'} className="text-[10px] px-1 h-5 gap-1">
                                {isPlan ? 'Assigned Plan' : 'Self-Logged'}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {format(dateObj, 'EEEE, MMM d')}
                            </p>
                            {isPlan && status === 'missed' && (
                              <span className="text-xs text-destructive font-medium">Missed Workout</span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* 1. SIMPLE VIEW: For Pending/Missed (Just shows targets) */}
      <Dialog open={!!selectedPlan} onOpenChange={() => setSelectedPlan(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedPlan?.title}</DialogTitle>
            <DialogDescription>
              {selectedPlan && format(parseISO(selectedPlan.date), 'PPPP')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div className="flex items-center gap-2">
              <Badge variant={selectedPlan?.is_completed ? "default" : "secondary"}>
                {selectedPlan?.is_completed ? "Completed" : "Not Completed"}
              </Badge>
            </div>

            {selectedPlan?.description && (
              <div className="bg-muted/30 p-3 rounded-md text-sm">
                <span className="font-semibold block mb-1">Notes:</span>
                {selectedPlan.description}
              </div>
            )}

            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2">
                <Dumbbell className="h-4 w-4" /> Assigned Exercises
              </h4>
              <ScrollArea className="h-[300px] border rounded-md p-4">
                <div className="space-y-4">
                  {selectedPlan?.exercises?.map((ex: any, i: number) => (
                    <div key={i} className="flex justify-between items-center border-b pb-2 last:border-0">
                      <span className="font-medium">{ex.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {ex.sets} x {ex.reps} @ {ex.weight}{ex.weightUnit}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 2. RICH VIEW: For Completed (Shows Graphs/Velocity) */}
      <SessionDetailPanel
        session={selectedSession}
        open={!!selectedSession}
        onClose={() => setSelectedSession(null)}
        isSelfLoggedSession={selectedSession ? !attendanceSummary.matchedSessionIds.has(selectedSession.id) : false}
      />
    </>
  );
};