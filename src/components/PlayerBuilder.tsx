import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { assignPlayerToTeam, getAllPlayersForAssignment } from "@/services/playersService";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface PlayerBuilderProps {
  open: boolean;
  onClose: () => void;
}

export const PlayerBuilder = ({ open, onClose }: PlayerBuilderProps) => {
  const { profile } = useAuth();
  
  // Assign existing player state
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [assignTeamId, setAssignTeamId] = useState("");
  
  const [teams, setTeams] = useState<Array<{ id: string; name: string; sport: string }>>([]);
  const [existingPlayers, setExistingPlayers] = useState<Array<{ id: string; full_name: string; team_id: string | null; current_team_name?: string | null }>>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPlayers, setLoadingPlayers] = useState(false);

  // Load teams and existing players when modal opens
  useEffect(() => {
    if (open) {
      loadTeams();
      loadExistingPlayers();
    }
  }, [open]);

  const loadTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, sport')
        .order('name', { ascending: true });

      if (error) throw error;
      setTeams(data || []);
      
      // Auto-select coach's team for the assignment dropdown
      if (profile?.coach?.team_id) {
        setAssignTeamId(profile.coach.team_id);
      }
    } catch (error) {
      console.error('Error loading teams:', error);
    }
  };

  const loadExistingPlayers = async () => {
    try {
      setLoadingPlayers(true);
      const players = await getAllPlayersForAssignment();
      setExistingPlayers(players || []);
    } catch (error) {
      console.error('Error loading existing players:', error);
      toast.error('Failed to load existing players');
      setExistingPlayers([]);
    } finally {
      setLoadingPlayers(false);
    }
  };

  const handleAssignPlayer = async () => {
    if (!selectedPlayerId) {
      toast.error("Please select a player");
      return;
    }
    
    // Convert "null" string to null for unassigning, empty string also means unassign
    const teamIdToAssign = assignTeamId === "" || assignTeamId === "null" ? null : assignTeamId;
    
    try {
      setLoading(true);
      
      await assignPlayerToTeam(selectedPlayerId, teamIdToAssign);
      
      const player = existingPlayers.find(p => p.id === selectedPlayerId);
      const team = teamIdToAssign ? teams.find(t => t.id === teamIdToAssign) : null;
      
      if (teamIdToAssign) {
        toast.success(`Player "${player?.full_name}" assigned to "${team?.name}"`);
      } else {
        toast.success(`Player "${player?.full_name}" unassigned from team`);
      }
      
      onClose();
      
      // Reset form
      setSelectedPlayerId("");
      // Note: We keep the team ID selected so they can easily add multiple players to the same team
      
      // Reload players list
      await loadExistingPlayers();
    } catch (error) {
      console.error('Error assigning player:', error);
      toast.error('Failed to assign player to team');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Manage Roster
          </DialogTitle>
          <DialogDescription>
            Assign existing players to teams or remove them from the roster
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Added Header here */}
          <h3 className="font-semibold text-lg">Assign Player</h3>

          {loadingPlayers ? (
            <div className="text-center py-4 text-muted-foreground">
              Loading players...
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Select Player</Label>
                <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a player" />
                  </SelectTrigger>
                  <SelectContent>
                    {existingPlayers.length === 0 ? (
                      <SelectItem value="" disabled>No players available</SelectItem>
                    ) : (
                      existingPlayers.map((player) => (
                        <SelectItem key={player.id} value={player.id}>
                          {player.full_name}
                          {player.current_team_name ? ` (Current: ${player.current_team_name})` : ' (No team)'}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Assign to Team</Label>
                <Select value={assignTeamId || ""} onValueChange={setAssignTeamId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a team" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="null">No Team (Unassign)</SelectItem>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name} ({team.sport})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={onClose} disabled={loading || loadingPlayers}>
                  Cancel
                </Button>
                <Button onClick={handleAssignPlayer} disabled={loading || loadingPlayers || !selectedPlayerId}>
                  {loading ? "Saving..." : "Save Assignment"}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};