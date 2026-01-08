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
import { format, isPast, isToday, parseISO, isSameDay } from "date-fns";

interface AthleteDetailPanelProps {
  athlete: Athlete | null;
  open: boolean;
  onClose: () => void;
}

export const AthleteDetailPanel = ({ athlete, open, onClose }: AthleteDetailPanelProps) => {
  const [plans, setPlans] = useState<any[]>([]);
  const [sessions, setSessions] = useState<SessionData[]>([]); // Store actual performance data
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
        getPlayerSessions(athlete.id) // This fetches the data with velocity/graphs
      ]);
      
      setPlans(plansData);
      setSessions(sessionsData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load athlete history');
    } finally {
      setLoading(false);
    }
  };
  
  if (!athlete) return null;

  const getPlanStatus = (plan: any) => {
    if (plan.is_completed) return 'completed';
    const planDate = parseISO(plan.date);
    if (isPast(planDate) && !isToday(planDate)) return 'missed';
    return 'pending';
  };

  // Logic to handle click: 
  // If completed, try to find the matching rich session data. 
  // If not found (or pending), show simple plan.
  const handleItemClick = (plan: any) => {
    const status = getPlanStatus(plan);

    if (status === 'completed') {
      // Try to find the matching actual session by date
      // (Ideally, we would link by ID, but Date is a good fallback for now)
      const planDate = parseISO(plan.date);
      const matchingSession = sessions.find(s => isSameDay(new Date(s.date), planDate));

      if (matchingSession) {
        setSelectedSession(matchingSession); // Open the Graphs View
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
              <Badge variant="outline">{athlete.group}</Badge>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto py-6">
            {/* Stats Summary Card */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {plans.filter(p => p.is_completed).length}
                  </div>
                  <div className="text-xs text-muted-foreground">Completed</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-destructive">
                    {plans.filter(p => getPlanStatus(p) === 'missed').length}
                  </div>
                  <div className="text-xs text-muted-foreground">Missed</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {plans.filter(p => getPlanStatus(p) === 'pending').length}
                  </div>
                  <div className="text-xs text-muted-foreground">Pending</div>
                </CardContent>
              </Card>
            </div>

            {/* Timeline List */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Workout Timeline
              </h3>

              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading history...</div>
              ) : plans.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed rounded-lg">
                  <p className="text-muted-foreground">No workouts assigned yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {plans.map((plan) => {
                    const status = getPlanStatus(plan);
                    const dateObj = parseISO(plan.date);

                    return (
                      <div 
                        key={plan.id}
                        className="group flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => handleItemClick(plan)}
                      >
                        <div className="flex items-start gap-4">
                          {/* Status Icon */}
                          <div className="mt-1">
                            {status === 'completed' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                            {status === 'missed' && <AlertCircle className="h-5 w-5 text-destructive" />}
                            {status === 'pending' && <Clock className="h-5 w-5 text-blue-500" />}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold">{plan.title}</h4>
                              {/* Show Activity Icon if we have graph data for this */}
                              {status === 'completed' && sessions.some(s => isSameDay(new Date(s.date), dateObj)) && (
                                <Badge variant="secondary" className="text-[10px] px-1 h-5 gap-1">
                                  <Activity className="h-3 w-3" /> Data
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {format(dateObj, 'EEEE, MMM d')}
                            </p>
                            {status === 'missed' && (
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
      />
    </>
  );
};