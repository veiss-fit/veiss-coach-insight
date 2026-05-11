import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Megaphone, Send, CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Validators } from "@/lib/validators";
import { useAuth } from "@/contexts/AuthContext";
import { getPlayersByTeamIds, PlayerWithStats, getSportsList } from "@/services/playersService";
import { sendMessage } from "@/services/messagesService";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";

interface AnnouncementBuilderProps {
  open: boolean;
  onClose: () => void;
}

export const AnnouncementBuilder = ({ open, onClose }: AnnouncementBuilderProps) => {
  const { profile, user } = useAuth();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<"normal" | "urgent">("normal");
  const [selectedAthletes, setSelectedAthletes] = useState<string[]>([]);
  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [filterSport, setFilterSport] = useState("all");
  const [filterLevel, setFilterLevel] = useState("all");
  // Removed filterGroup state
  const [sending, setSending] = useState(false);

  // Real data
  const [athletes, setAthletes] = useState<PlayerWithStats[]>([]);
  const [sportsList, setSportsList] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Load athletes and sports when modal opens
  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, profile]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load athletes based on coach's team
      let players: PlayerWithStats[] = [];
      if (profile?.coach?.team_id) {
        players = await getPlayersByTeamIds([profile.coach.team_id]);
      }
      setAthletes(players);

      // Load sports list
      const sports = await getSportsList();
      setSportsList(sports);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleAthlete = (athleteId: string) => {
    setSelectedAthletes(prev =>
      prev.includes(athleteId)
        ? prev.filter(id => id !== athleteId)
        : [...prev, athleteId]
    );
  };

  const selectAllFiltered = () => {
    const filtered = filteredAthletes.map(a => a.id);
    setSelectedAthletes(filtered);
  };

  const clearSelection = () => {
    setSelectedAthletes([]);
  };

  const filteredAthletes = athletes.filter(athlete => {
    if (filterSport !== "all" && athlete.sport !== filterSport) return false;
    if (filterLevel !== "all" && athlete.level !== filterLevel) return false;
    // Removed filterGroup check
    return true;
  });

  const handleSendAnnouncement = async () => {
    // Validation
    const titleError = Validators.announcementTitle(title);
    if (titleError) {
      toast.error(titleError);
      return;
    }

    const messageError = Validators.announcementMessage(message);
    if (messageError) {
      toast.error(messageError);
      return;
    }

    if (selectedAthletes.length === 0) {
      toast.error("Please select at least one athlete");
      return;
    }

    if (!user?.id) {
      toast.error("User not authenticated");
      return;
    }

    try {
      setSending(true);

      // Send to Supabase
      const result = await sendMessage(
        user.id, // sender_id (coach's user ID)
        selectedAthletes,
        title.trim(),
        message.trim(),
        'announcement',
        priority
      );

      if (result.success) {
        const dateInfo = scheduledDate ? ` for ${format(scheduledDate, "PPP")}` : "";
        toast.success(`Announcement "${title}" sent to ${result.count} athlete(s)${dateInfo}`);
        onClose();
        
        // Reset form
        setTitle("");
        setMessage("");
        setPriority("normal");
        setSelectedAthletes([]);
        setScheduledDate(undefined);
      } else {
        toast.error(result.error || "Failed to send announcement");
      }
    } catch (error) {
      console.error('Error sending announcement:', error);
      toast.error("An error occurred while sending the announcement");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <LoadingOverlay isLoading={loading} fullScreen message="Loading athletes..." />
        <LoadingOverlay isLoading={sending} fullScreen message="Sending announcement..." />
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" />
            Send Announcement
          </DialogTitle>
          <DialogDescription>
            Compose and send announcements to athletes
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
          {/* Left Column - Announcement Composer */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="announcementTitle">Title</Label>
              <Input
                id="announcementTitle"
                placeholder="e.g., Practice Schedule Update"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="announcementMessage">Message</Label>
              <Textarea
                id="announcementMessage"
                placeholder="Write your announcement here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="min-h-[200px] resize-none"
                maxLength={1000}
              />
              <p className="text-xs text-muted-foreground text-right">
                {message.length}/1000 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(value: "normal" | "urgent") => setPriority(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Scheduled Date (Optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !scheduledDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {scheduledDate ? format(scheduledDate, "PPP") : <span>Pick a date (optional)</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={scheduledDate}
                    onSelect={setScheduledDate}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                Note: Messages are sent immediately. Date is for reference only.
              </p>
            </div>

            {priority === "urgent" && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm text-destructive">
                  Urgent announcements will be highlighted and may trigger push notifications.
                </p>
              </div>
            )}
          </div>

          {/* Right Column - Athlete Selection */}
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Filter Athletes</Label>
              {/* Changed to grid-cols-2 */}
              <div className="grid grid-cols-2 gap-2">
                <Select value={filterSport} onValueChange={setFilterSport}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sport" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sports</SelectItem>
                    {sportsList.map((sport) => (
                      <SelectItem key={sport} value={sport}>{sport}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterLevel} onValueChange={setFilterLevel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="Varsity">Varsity</SelectItem>
                    <SelectItem value="JV">JV</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={selectAllFiltered}
                >
                  Select All ({filteredAthletes.length})
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={clearSelection}
                >
                  Clear Selection
                </Button>
              </div>
            </div>

            <div>
              <Label className="mb-2 block">
                Selected Athletes ({selectedAthletes.length})
              </Label>
              <Card className="max-h-[400px] overflow-y-auto">
                <CardContent className="p-3 space-y-2">
                  {loading ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Loading athletes...</p>
                    </div>
                  ) : filteredAthletes.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No athletes found</p>
                    </div>
                  ) : (
                    filteredAthletes.map(athlete => (
                      <div
                        key={athlete.id}
                        className="flex items-center space-x-2 p-2 hover:bg-muted rounded-md cursor-pointer"
                        onClick={() => toggleAthlete(athlete.id)}
                      >
                        <Checkbox
                          checked={selectedAthletes.includes(athlete.id)}
                          onCheckedChange={() => toggleAthlete(athlete.id)}
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{athlete.name}</p>
                          <div className="flex gap-1 mt-1">
                            <Badge variant="outline" className="text-xs">{athlete.group || 'No Group'}</Badge>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose} disabled={sending}>Cancel</Button>
          <Button 
            onClick={handleSendAnnouncement} 
            className="bg-primary text-navy-dark hover:bg-primary/90"
            disabled={sending}
          >
            <Send className="h-4 w-4 mr-2" />
            {sending ? "Sending..." : "Send Announcement"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};