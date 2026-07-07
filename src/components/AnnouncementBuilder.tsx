import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Megaphone, Send, CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Validators } from "@/lib/validators";
import { useAuth } from "@/contexts/AuthContext";
import { getPlayersWithStatsByCoach, PlayerWithStats } from "@/services/playersService";
import { sendMessage } from "@/services/messagesService";
import { supabase } from "@/lib/supabase";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";

interface AnnouncementBuilderProps {
  open: boolean;
  onClose: () => void;
}

const getInitials = (name: string) =>
  name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

const TH: React.CSSProperties = {
  fontFamily: 'Inter', fontSize: 10.5, fontWeight: 600, color: '#8d95a4',
  letterSpacing: '0.07em', textTransform: 'uppercase', padding: '10px 14px', textAlign: 'left',
};

export const AnnouncementBuilder = ({ open, onClose }: AnnouncementBuilderProps) => {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<"normal" | "urgent">("normal");
  const [selectedAthletes, setSelectedAthletes] = useState<string[]>([]);
  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [filterGroup, setFilterGroup] = useState("all");
  const [sending, setSending] = useState(false);

  // Real data
  const [athletes, setAthletes] = useState<PlayerWithStats[]>([]);
  const [groupsList, setGroupsList] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);

  // Load athletes and groups when modal opens
  useEffect(() => {
    if (open && user?.id) {
      loadData();
    }
  }, [open, user?.id]);

  const loadData = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const { data: coachRow } = await (supabase as any)
        .from('coaches')
        .select('id')
        .eq('user_id', user.id)
        .single() as { data: { id: string } | null };

      const groupQuery = coachRow?.id
        ? (supabase as any).from('groups').select('id, name').eq('coach_id', coachRow.id).order('name', { ascending: true })
        : supabase.from('groups').select('id, name').order('name', { ascending: true });

      const [players, groupsResult] = await Promise.all([
        getPlayersWithStatsByCoach(user.id),
        groupQuery,
      ]);
      setAthletes(players);
      setGroupsList(groupsResult.data || []);
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

  const filteredAthletes = athletes.filter(athlete =>
    filterGroup === "all" || athlete.team_id === filterGroup
  );

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
        user.id,
        selectedAthletes,
        title.trim(),
        message.trim(),
        'announcement',
        priority,
        scheduledDate
      );

      if (result.success) {
        if (scheduledDate) {
          toast.success(`Announcement scheduled for ${format(scheduledDate, "PPP")} · ${result.count} athlete(s)`);
        } else {
          toast.success(`Announcement sent to ${result.count} athlete(s)`);
        }
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
                Leave blank to send immediately, or pick a future date to schedule delivery.
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
              <Label className="mb-2 block">Filter Groups</Label>
              <Select value={filterGroup} onValueChange={setFilterGroup}>
                <SelectTrigger>
                  <SelectValue placeholder="All Groups" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Groups</SelectItem>
                  {groupsList.map((group) => (
                    <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(7,16,31,0.06)' }}>
                <div className="max-h-[400px] overflow-y-auto">
                  <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                    <thead className="sticky top-0 z-10">
                      <tr style={{ backgroundColor: '#fbfbfc', borderBottom: '1px solid rgba(7,16,31,0.06)' }}>
                        <th style={{ width: 44, padding: '10px 14px' }} />
                        <th style={TH}>Athlete</th>
                        <th style={TH}>Group</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={3} style={{ textAlign: 'center', padding: '40px 0', color: '#8d95a4', fontSize: 13 }}>
                            Loading athletes...
                          </td>
                        </tr>
                      ) : filteredAthletes.length === 0 ? (
                        <tr>
                          <td colSpan={3} style={{ textAlign: 'center', padding: '40px 0', color: '#8d95a4', fontSize: 13 }}>
                            No athletes found
                          </td>
                        </tr>
                      ) : (
                        filteredAthletes.map(athlete => {
                          const isSelected = selectedAthletes.includes(athlete.id);
                          return (
                            <tr
                              key={athlete.id}
                              style={{ height: 44, borderBottom: '1px solid rgba(7,16,31,0.06)', cursor: 'pointer', backgroundColor: isSelected ? '#fffdf0' : '#ffffff' }}
                              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '#fbfbfc'; }}
                              onMouseLeave={e => { e.currentTarget.style.backgroundColor = isSelected ? '#fffdf0' : '#ffffff'; }}
                              onClick={() => toggleAthlete(athlete.id)}
                            >
                              <td style={{ width: 44, padding: '0 14px' }} onClick={e => e.stopPropagation()}>
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleAthlete(athlete.id)}
                                />
                              </td>
                              <td style={{ padding: '0 14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <div style={{
                                    width: 28, height: 28, borderRadius: '50%',
                                    backgroundColor: '#eef1f6', color: '#07101f',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 11, fontWeight: 600, letterSpacing: '0.01em', flexShrink: 0,
                                  }}>
                                    {getInitials(athlete.name)}
                                  </div>
                                  <span style={{ fontFamily: 'Inter', fontSize: 13, fontWeight: 500, color: '#07101f' }}>
                                    {athlete.name}
                                  </span>
                                </div>
                              </td>
                              <td style={{ padding: '0 14px' }}>
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 5,
                                  height: 20, padding: '0 7px', borderRadius: 999,
                                  backgroundColor: '#f1f2f5', border: '1px solid rgba(7,16,31,0.06)',
                                  fontSize: 11, fontWeight: 500, color: '#28344a', letterSpacing: '0.01em',
                                }}>
                                  <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#8d95a4', flexShrink: 0 }} />
                                  {(athlete as any).group || '—'}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
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