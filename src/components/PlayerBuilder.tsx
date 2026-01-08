import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Users, Check, ChevronsUpDown, X } from "lucide-react";
import { toast } from "sonner";
import { assignPlayerToTeam, getAllPlayersForAssignment } from "@/services/playersService";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Validators } from "@/lib/validators";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
interface PlayerBuilderProps {
  open: boolean;
  onClose: () => void;
}

export const PlayerBuilder = ({ open, onClose }: PlayerBuilderProps) => {
  const { profile } = useAuth();
  
  // State changes: selectedPlayerId (string) -> selectedPlayerIds (array)
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [assignTeamId, setAssignTeamId] = useState("");
  const [comboboxOpen, setComboboxOpen] = useState(false);
  
  const [teams, setTeams] = useState<Array<{ id: string; name: string; sport: string }>>([]);
  const [existingPlayers, setExistingPlayers] = useState<Array<{ id: string; full_name: string; team_id: string | null; current_team_name?: string | null }>>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPlayers, setLoadingPlayers] = useState(false);

  useEffect(() => {
    if (open) {
      loadTeams();
      loadExistingPlayers();
      setSelectedPlayerIds([]); // Reset selection on open
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

  const togglePlayerSelection = (playerId: string) => {
    setSelectedPlayerIds(prev => 
      prev.includes(playerId) 
        ? prev.filter(id => id !== playerId) 
        : [...prev, playerId]
    );
  };

  const handleAssignPlayers = async () => {
    if (selectedPlayerIds.length === 0) {
      toast.error("Please select at least one player");
      return;
    }
    
    const teamIdToAssign = assignTeamId === "" || assignTeamId === "null" ? null : assignTeamId;
    
    try {
      setLoading(true);
      
      // Execute all assignments in parallel
      const promises = selectedPlayerIds.map(playerId => 
        assignPlayerToTeam(playerId, teamIdToAssign)
      );

      await Promise.all(promises);
      
      const teamName = teamIdToAssign ? teams.find(t => t.id === teamIdToAssign)?.name : "No Team";
      
      toast.success(`Successfully assigned ${selectedPlayerIds.length} player(s) to ${teamName}`);
      
      onClose();
      setSelectedPlayerIds([]);
      await loadExistingPlayers();
    } catch (error) {
      console.error('Error assigning players:', error);
      toast.error('Failed to assign players');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl overflow-visible">
        <LoadingOverlay isLoading={loadingPlayers || loading} fullScreen message="Loading players..." />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Manage Roster
          </DialogTitle>
          <DialogDescription>
            Search and select multiple players to bulk assign them to a team.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {loadingPlayers ? (
            <div className="text-center py-4 text-muted-foreground">
              Loading players...
            </div>
          ) : (
            <>
              {/* Multi-Select Combobox */}
              <div className="space-y-2 flex flex-col">
                <Label>Select Players</Label>
                <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={comboboxOpen}
                      className="justify-between w-full font-normal h-auto min-h-[40px]"
                    >
                      {selectedPlayerIds.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="secondary" className="mr-1">
                            {selectedPlayerIds.length} selected
                          </Badge>
                          <span className="text-muted-foreground text-xs my-auto">
                            (Click to add more)
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Search and select players...</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search player name..." />
                      <CommandList>
                        <CommandEmpty>No player found.</CommandEmpty>
                        <CommandGroup className="max-h-[300px] overflow-y-auto">
                          {existingPlayers.map((player) => (
                            <CommandItem
                              key={player.id}
                              value={player.full_name}
                              onSelect={() => togglePlayerSelection(player.id)}
                            >
                              <div className={cn(
                                "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                selectedPlayerIds.includes(player.id) ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible"
                              )}>
                                <Check className={cn("h-4 w-4")} />
                              </div>
                              <div className="flex flex-col">
                                <span>{player.full_name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {player.current_team_name ? `Current: ${player.current_team_name}` : "Unassigned"}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Selected Summary (Optional visual confirmation) */}
              {selectedPlayerIds.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  Selected: {selectedPlayerIds.map(id => existingPlayers.find(p => p.id === id)?.full_name).join(", ")}
                </div>
              )}

              {/* Team Dropdown */}
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
                <Button 
                  onClick={handleAssignPlayers} 
                  disabled={loading || loadingPlayers || selectedPlayerIds.length === 0}
                >
                  {loading ? "Assigning..." : `Assign ${selectedPlayerIds.length} Player(s)`}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};