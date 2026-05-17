import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { CalendarDays, Megaphone, Users, Clock, History } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getCoachWorkoutHistory } from "@/services/workoutPlansService";
import { getCoachMessageHistory } from "@/services/messagesService";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";

interface CommunicationHistoryProps {
  open: boolean;
  onClose: () => void;
}

export const CommunicationHistory = ({ open, onClose }: CommunicationHistoryProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);

  useEffect(() => {
    if (open && user?.id) {
      loadHistory();
    }
  }, [open, user?.id]);

  const loadHistory = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [workoutsData, messagesData] = await Promise.all([
        getCoachWorkoutHistory(user.id),
        getCoachMessageHistory(user.id),
      ]);
      setWorkouts(workoutsData);
      setAnnouncements(messagesData);
    } catch (error) {
      console.error("Failed to load history", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl h-[82vh] p-0 flex flex-col gap-0 overflow-hidden">
        <LoadingOverlay isLoading={loading} fullScreen message="Loading history..." />

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b shrink-0">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <History className="h-6 w-6 text-primary" />
              Communication History
            </DialogTitle>
            <DialogDescription>
              View past workouts and announcements sent to your team.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Tabs */}
        <div className="flex-1 overflow-hidden px-6 py-5">
          <Tabs defaultValue="workouts" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-2 mb-4 shrink-0">
              <TabsTrigger value="workouts">Workouts Sent</TabsTrigger>
              <TabsTrigger value="announcements">Announcements Sent</TabsTrigger>
            </TabsList>

            {/* Workouts tab */}
            <TabsContent value="workouts" className="flex-1 overflow-hidden mt-0 data-[state=inactive]:hidden">
              <Card className="h-full flex flex-col">
                <CardHeader className="shrink-0 pb-3">
                  <CardTitle>Workout History</CardTitle>
                  <CardDescription>{workouts.length} workout batch{workouts.length !== 1 ? "es" : ""} sent</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden p-0">
                  <ScrollArea className="h-full px-6 pb-6">
                    {loading ? (
                      <p className="text-center py-10 text-muted-foreground text-sm">Loading history...</p>
                    ) : workouts.length === 0 ? (
                      <p className="text-center py-10 text-muted-foreground text-sm">No communication history yet. Create a group and add athletes to get started.</p>
                    ) : (
                      <div className="space-y-3">
                        {workouts.map((batch) => (
                          <div
                            key={batch.id}
                            className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-start gap-4">
                              <div className="p-2 bg-primary/10 rounded-full mt-0.5 shrink-0">
                                <CalendarDays className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <h4 className="font-semibold">{batch.workoutName}</h4>
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                                  <Clock className="h-3 w-3" />
                                  <span>Sent: {format(new Date(batch.sentAt), "PP p")}</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Scheduled for: {format(new Date(batch.scheduledDate), "PP")}
                                </p>
                              </div>
                            </div>
                            <div className="text-right shrink-0 ml-4">
                              <Badge variant="secondary" className="mb-1.5">
                                <Users className="h-3 w-3 mr-1" />
                                {batch.totalCount} Recipient{batch.totalCount !== 1 ? "s" : ""}
                              </Badge>
                              <p className="text-xs text-muted-foreground max-w-[180px] truncate">
                                {batch.recipients.slice(0, 3).join(", ")}
                                {batch.totalCount > 3 && ` +${batch.totalCount - 3} more`}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Announcements tab */}
            <TabsContent value="announcements" className="flex-1 overflow-hidden mt-0 data-[state=inactive]:hidden">
              <Card className="h-full flex flex-col">
                <CardHeader className="shrink-0 pb-3">
                  <CardTitle>Announcement History</CardTitle>
                  <CardDescription>{announcements.length} announcement{announcements.length !== 1 ? "s" : ""} sent</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden p-0">
                  <ScrollArea className="h-full px-6 pb-6">
                    {loading ? (
                      <p className="text-center py-10 text-muted-foreground text-sm">Loading history...</p>
                    ) : announcements.length === 0 ? (
                      <p className="text-center py-10 text-muted-foreground text-sm">No communication history yet. Create a group and add athletes to get started.</p>
                    ) : (
                      <div className="space-y-3">
                        {announcements.map((msg) => (
                          <div
                            key={msg.id}
                            className="flex flex-col p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-secondary/20 rounded-full shrink-0">
                                  <Megaphone className="h-4 w-4 text-secondary-foreground" />
                                </div>
                                <div>
                                  <h4 className="font-semibold">{msg.title}</h4>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {format(new Date(msg.sentAt), "PPP p")}
                                  </p>
                                </div>
                              </div>
                              {msg.priority === "urgent" && (
                                <Badge variant="destructive" className="shrink-0 ml-2">Urgent</Badge>
                              )}
                            </div>
                            <div className="pl-11">
                              <p className="text-sm text-foreground/80 bg-muted/30 p-3 rounded-md mb-2">
                                {msg.content}
                              </p>
                              <div className="flex items-center justify-end text-xs text-muted-foreground">
                                <Users className="h-3 w-3 mr-1" />
                                Sent to {msg.recipientCount} athlete{msg.recipientCount !== 1 ? "s" : ""}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};
