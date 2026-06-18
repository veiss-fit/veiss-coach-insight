import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"; // 1. Import hook
import { TopNav } from "@/components/TopNav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { CalendarDays, Megaphone, Users, Clock, ArrowLeft, CalendarClock } from "lucide-react"; // 2. Import ArrowLeft
import { useAuth } from "@/contexts/AuthContext";
import { getCoachWorkoutHistory } from "@/services/workoutPlansService";
import { getCoachMessageHistory } from "@/services/messagesService";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";

export default function History() {
  const { profile, user } = useAuth();
  const navigate = useNavigate(); // 3. Initialize hook
  const [loading, setLoading] = useState(true);
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);

  useEffect(() => {
    if (user?.id) {
      loadHistory();
    }
  }, [user?.id]);

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
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="container mx-auto p-6 max-w-5xl">
        <LoadingOverlay isLoading={loading} fullScreen message="Loading history..." />
        
        {/* 4. Back Button Section */}
        <div className="mb-2">
          <Button 
            variant="ghost" 
            className="pl-0 hover:bg-transparent hover:text-primary" 
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>

        <div className="mb-6">
          <h1 className="text-3xl font-bold">Communication History</h1>
          <p className="text-muted-foreground">View past workouts and announcements sent to your team.</p>
        </div>

        <Tabs defaultValue="workouts" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="workouts">Workouts Sent</TabsTrigger>
            <TabsTrigger value="announcements">Announcements Sent</TabsTrigger>
          </TabsList>

          {/* --- WORKOUTS TAB --- */}
          <TabsContent value="workouts">
            <Card>
              <CardHeader>
                <CardTitle>Workout History</CardTitle>
                <CardDescription>
                  {workouts.length} workout batches sent
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px] pr-4">
                  {loading ? (
                    <div className="text-center py-10 text-muted-foreground">Loading history...</div>
                  ) : workouts.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">No communication history yet. Create a group and add athletes to get started.</div>
                  ) : (
                    <div className="space-y-4">
                      {workouts.map((batch) => (
                        <div key={batch.id} className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors">
                          <div className="flex items-start gap-4">
                            <div className="p-2 bg-primary/10 rounded-full mt-1">
                              <CalendarDays className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-lg">{batch.workoutName}</h4>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                <Clock className="h-3 w-3" />
                                <span>Sent: {format(new Date(batch.sentAt), "PP p")}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                <span>
                                  Scheduled for:{' '}
                                  {(batch.scheduledDates as string[])
                                    .slice()
                                    .sort()
                                    .map((d: string) => format(new Date(d + 'T12:00:00'), 'PP'))
                                    .join(', ')}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <Badge variant="secondary" className="mb-2">
                              <Users className="h-3 w-3 mr-1" />
                              {batch.recipients.length} {batch.recipients.length === 1 ? 'Recipient' : 'Recipients'}
                            </Badge>
                            <p className="text-xs text-muted-foreground max-w-[200px] truncate">
                              {batch.recipients.slice(0, 3).join(", ")}
                              {batch.recipients.length > 3 && ` +${batch.recipients.length - 3} more`}
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

          {/* --- ANNOUNCEMENTS TAB --- */}
          <TabsContent value="announcements">
            <Card>
              <CardHeader>
                <CardTitle>Announcement History</CardTitle>
                <CardDescription>
                  {announcements.length} announcements sent
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px] pr-4">
                  {loading ? (
                    <div className="text-center py-10 text-muted-foreground">Loading history...</div>
                  ) : announcements.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">No communication history yet. Create a group and add athletes to get started.</div>
                  ) : (
                    <div className="space-y-4">
                      {announcements.map((msg) => (
                        <div key={msg.id} className="flex flex-col p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-secondary/20 rounded-full">
                                <Megaphone className="h-5 w-5 text-secondary-foreground" />
                              </div>
                              <div>
                                <h4 className="font-semibold text-lg">{msg.title}</h4>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  {msg.isDelivered === false && msg.scheduledAt ? (
                                    <span className="flex items-center gap-1">
                                      <CalendarClock className="h-3 w-3" />
                                      Scheduled for {format(new Date(msg.scheduledAt), "PPP p")}
                                    </span>
                                  ) : (
                                    <span>{format(new Date(msg.sentAt), "PPP p")}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {msg.isDelivered === false && (
                                <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                                  Scheduled
                                </Badge>
                              )}
                              {msg.priority === 'urgent' && (
                                <Badge variant="destructive">Urgent</Badge>
                              )}
                            </div>
                          </div>
                          
                          <div className="pl-12">
                            <p className="text-sm text-foreground/80 bg-muted/30 p-3 rounded-md mb-2">
                              {msg.content}
                            </p>
                            <div className="flex items-center justify-end text-xs text-muted-foreground">
                              <Users className="h-3 w-3 mr-1" />
                              Sent to {msg.recipientCount} athletes
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
      </main>
    </div>
  );
}