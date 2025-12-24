import { useState } from "react";
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
import { mockAthletes } from "@/data/mockData";
import { Megaphone, Send, CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AnnouncementBuilderProps {
  open: boolean;
  onClose: () => void;
}

export const AnnouncementBuilder = ({ open, onClose }: AnnouncementBuilderProps) => {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<"normal" | "urgent">("normal");
  const [selectedAthletes, setSelectedAthletes] = useState<string[]>([]);
  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [filterSport, setFilterSport] = useState("all");
  const [filterLevel, setFilterLevel] = useState("all");
  const [filterGroup, setFilterGroup] = useState("all");

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

  const filteredAthletes = mockAthletes.filter(athlete => {
    if (filterSport !== "all" && athlete.sport !== filterSport) return false;
    if (filterLevel !== "all" && athlete.level !== filterLevel) return false;
    if (filterGroup !== "all" && athlete.group !== filterGroup) return false;
    return true;
  });

  const handleSendAnnouncement = () => {
    if (!title.trim() || !message.trim()) {
      toast.error("Please enter both a title and message");
      return;
    }
    if (selectedAthletes.length === 0) {
      toast.error("Please select at least one athlete");
      return;
    }

    const dateInfo = scheduledDate ? ` for ${format(scheduledDate, "PPP")}` : "";
    toast.success(`Announcement "${title}" sent to ${selectedAthletes.length} athlete(s)${dateInfo}`);
    onClose();
    // Reset form
    setTitle("");
    setMessage("");
    setPriority("normal");
    setSelectedAthletes([]);
    setScheduledDate(undefined);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" />
            Send Announcement
          </DialogTitle>
          <DialogDescription>
            Compose and send announcements to athletes or groups
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
              <Label>Scheduled Date</Label>
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
                    {scheduledDate ? format(scheduledDate, "PPP") : <span>Pick a date</span>}
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
              <div className="grid grid-cols-3 gap-2">
                <Select value={filterSport} onValueChange={setFilterSport}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sport" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sports</SelectItem>
                    <SelectItem value="Football">Football</SelectItem>
                    <SelectItem value="Basketball">Basketball</SelectItem>
                    <SelectItem value="Soccer">Soccer</SelectItem>
                    <SelectItem value="Volleyball">Volleyball</SelectItem>
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

                <Select value={filterGroup} onValueChange={setFilterGroup}>
                  <SelectTrigger>
                    <SelectValue placeholder="Group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Groups</SelectItem>
                    <SelectItem value="Offense">Offense</SelectItem>
                    <SelectItem value="Defense">Defense</SelectItem>
                    <SelectItem value="Guards">Guards</SelectItem>
                    <SelectItem value="Forwards">Forwards</SelectItem>
                    <SelectItem value="Midfield">Midfield</SelectItem>
                    <SelectItem value="Setters">Setters</SelectItem>
                    <SelectItem value="Hitters">Hitters</SelectItem>
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
                  {filteredAthletes.map(athlete => (
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
                          <Badge variant="outline" className="text-xs">{athlete.sport}</Badge>
                          <Badge variant="outline" className="text-xs">{athlete.level}</Badge>
                          <Badge variant="outline" className="text-xs">{athlete.group}</Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSendAnnouncement} className="bg-primary text-navy-dark hover:bg-primary/90">
            <Send className="h-4 w-4 mr-2" />
            Send Announcement
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};