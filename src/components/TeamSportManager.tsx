import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Users, Pencil, Trash2, Plus, Check, ChevronsUpDown, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Validators } from "@/lib/validators";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { updateTeam, deleteTeam, assignPlayerToTeam, getAllPlayersForAssignment, getCoachTeamIds } from "@/services/playersService";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";

interface TeamSportManagerProps {
  open: boolean;
  onClose: () => void;
  onPlayersChanged?: () => void;
}

// Generate a unique 6-digit numeric invite code not already in use
const generateInviteCode = (existingCodes: (string | null)[]): string => {
  const used = new Set(existingCodes.filter(Boolean) as string[]);
  let code: string;
  do {
    code = Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0');
  } while (used.has(code));
  return code;
};

export const TeamSportManager = ({ open, onClose, onPlayersChanged }: TeamSportManagerProps) => {
  const { profile, user } = useAuth();

  // Groups state
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingTeam, setEditingTeam] = useState<any | null>(null);
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");

  // Players state
  const [existingPlayers, setExistingPlayers] = useState<Array<{
    id: string;
    full_name: string;
    team_id: string | null;
    current_team_name?: string | null;
  }>>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [assignTeamId, setAssignTeamId] = useState("");
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (open) {
      loadTeams();
      loadPlayers();
    }
  }, [open, profile?.coach?.team_id]);

  const loadTeams = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      let { data, error } = await supabase
        .from('teams')
        .select('*')
        .or(`coach_user_id.eq.${user.id},coach_user_id.is.null`)
        .order('name');
      if (error || !data) {
        // coach_user_id column not yet in DB — show all teams as fallback
        const fallback = await supabase.from('teams').select('*').order('name');
        data = fallback.data;
      }
      let fetched = (data || []) as any[];

      // Backfill any groups that are missing an invite code
      const missing = fetched.filter(t => !t.invite_code);
      if (missing.length > 0) {
        const existingCodes = fetched.map(t => t.invite_code);
        await Promise.all(
          missing.map(async t => {
            const code = generateInviteCode(existingCodes);
            existingCodes.push(code);
            // @ts-ignore — invite_code not yet in generated types
            await supabase.from('teams').update({ invite_code: code } as never).eq('id', t.id);
            t.invite_code = code;
          })
        );
      }

      setTeams(fetched);
    } catch {
      toast.error("Failed to load groups");
    } finally {
      setLoading(false);
    }
  };

  const loadPlayers = async () => {
    try {
      setLoadingPlayers(true);
      const teamIds = user?.id ? await getCoachTeamIds(user.id) : undefined;
      const players = await getAllPlayersForAssignment(teamIds);
      setExistingPlayers(players || []);
    } catch {
      toast.error("Failed to load players");
      setExistingPlayers([]);
    } finally {
      setLoadingPlayers(false);
    }
  };

  // --- Group actions ---

  const handleCreateTeam = async () => {
    const nameError = Validators.required(newTeamName, "Group Name");
    if (nameError) return toast.error(nameError);
    try {
      const invite_code = generateInviteCode(teams.map(t => t.invite_code));
      // Try with coach_user_id first; fall back if column doesn't exist yet
      let result = await supabase
        .from('teams')
        .insert({ name: newTeamName, sport: '', invite_code, coach_user_id: user?.id ?? null } as any);
      if (result.error) {
        result = await supabase
          .from('teams')
          .insert({ name: newTeamName, sport: '', invite_code } as any);
      }
      if (result.error) throw result.error;
      toast.success("Group created");
      setIsCreatingTeam(false);
      setNewTeamName("");
      loadTeams();
    } catch {
      toast.error("Failed to create group");
    }
  };

  const handleUpdateTeam = async () => {
    if (!editingTeam) return;
    const nameError = Validators.required(editingTeam.name, "Group Name");
    if (nameError) return toast.error(nameError);
    const success = await updateTeam(editingTeam.id, { name: editingTeam.name });
    if (success) {
      toast.success("Group updated");
      setEditingTeam(null);
      loadTeams();
    } else {
      toast.error("Update failed");
    }
  };

  const handleDeleteTeam = async (id: string) => {
    if (!confirm("Are you sure? This will fail if players are assigned to this group.")) return;
    const success = await deleteTeam(id);
    if (success) {
      toast.success("Group deleted");
      loadTeams();
    } else {
      toast.error("Cannot delete group (likely has players assigned)");
    }
  };

  // --- Player actions ---

  const togglePlayer = (playerId: string) => {
    setSelectedPlayerIds(prev =>
      prev.includes(playerId) ? prev.filter(id => id !== playerId) : [...prev, playerId]
    );
  };

  const handleAssignPlayers = async () => {
    if (selectedPlayerIds.length === 0) return toast.error("Please select at least one player");
    const teamIdToAssign = assignTeamId === "" || assignTeamId === "null" ? null : assignTeamId;
    try {
      setAssigning(true);
      await Promise.all(selectedPlayerIds.map(id => assignPlayerToTeam(id, teamIdToAssign)));
      const groupName = teamIdToAssign ? teams.find(t => t.id === teamIdToAssign)?.name : "No Group";
      toast.success(`Assigned ${selectedPlayerIds.length} player(s) to ${groupName}`);
      setSelectedPlayerIds([]);
      await loadPlayers();
      onPlayersChanged?.();
    } catch {
      toast.error("Failed to assign players");
    } finally {
      setAssigning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl h-[85vh] flex flex-col p-0 gap-0 overflow-hidden outline-none">
        <LoadingOverlay isLoading={loading || loadingPlayers} fullScreen message="Loading..." />

        <DialogHeader className="p-6 pb-4 border-b shrink-0">
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Manage Groups & Players
          </DialogTitle>
          <DialogDescription>
            Manage your groups and assign players to them.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="groups" className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 pt-4 pb-2 shrink-0 border-b">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="groups">Groups</TabsTrigger>
              <TabsTrigger value="players">Players</TabsTrigger>
            </TabsList>
          </div>

          {/* GROUPS TAB */}
          <TabsContent value="groups" className="flex-1 flex flex-col overflow-hidden m-0 p-0 data-[state=inactive]:hidden">
            <div className="px-6 py-3 flex justify-end shrink-0 border-b bg-background">
              <Button size="sm" onClick={() => setIsCreatingTeam(true)}>
                <Plus className="h-4 w-4 mr-2" /> Add Group
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="px-6 py-4 space-y-3">
                {teams.length === 0 && !loading && (
                  <div className="text-center py-10 text-muted-foreground">
                    No groups found. Add one above.
                  </div>
                )}
                {teams.map((team) => (
                  <Card key={team.id} className="group hover:border-primary/50 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-full">
                            <Users className="h-4 w-4 text-primary" />
                          </div>
                          <p className="font-semibold">{team.name}</p>
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="icon" variant="ghost" onClick={() => setEditingTeam(team)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteTeam(team.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Invite code row */}
                      <div className="mt-3 ml-11 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Invite code</span>
                        <span className="font-mono text-sm font-bold tracking-[0.2em] text-foreground">
                          {team.invite_code ?? '------'}
                        </span>
                        {team.invite_code && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-xs gap-1"
                            onClick={() => {
                              navigator.clipboard.writeText(team.invite_code);
                              toast.success('Invite code copied!');
                            }}
                          >
                            <Copy className="h-3 w-3" />
                            Copy
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* PLAYERS TAB */}
          <TabsContent value="players" className="flex-1 flex flex-col overflow-hidden m-0 p-0 data-[state=inactive]:hidden">
            <ScrollArea className="flex-1">
              <div className="px-6 py-4 space-y-4">
                <div className="space-y-2">
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
                                onSelect={() => togglePlayer(player.id)}
                              >
                                <div className={cn(
                                  "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                  selectedPlayerIds.includes(player.id)
                                    ? "bg-primary text-primary-foreground"
                                    : "opacity-50 [&_svg]:invisible"
                                )}>
                                  <Check className="h-4 w-4" />
                                </div>
                                <div className="flex flex-col">
                                  <span>{player.full_name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {player.current_team_name
                                      ? `Current: ${player.current_team_name}`
                                      : "Unassigned"}
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

                {selectedPlayerIds.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Selected:{" "}
                    {selectedPlayerIds
                      .map(id => existingPlayers.find(p => p.id === id)?.full_name)
                      .join(", ")}
                  </p>
                )}

                <div className="space-y-2">
                  <Label>Assign to Group</Label>
                  <Select value={assignTeamId || ""} onValueChange={setAssignTeamId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a group" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="null">No Group (Unassign)</SelectItem>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    onClick={handleAssignPlayers}
                    disabled={assigning || selectedPlayerIds.length === 0}
                  >
                    {assigning ? "Assigning..." : `Assign ${selectedPlayerIds.length} Player(s)`}
                  </Button>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>

      {/* Create Group Modal */}
      <Dialog open={isCreatingTeam} onOpenChange={setIsCreatingTeam}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create New Group</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Group Name</Label>
              <Input
                placeholder="e.g. Varsity Basketball"
                value={newTeamName}
                onChange={e => setNewTeamName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreateTeam}>Create Group</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Group Modal */}
      <Dialog open={!!editingTeam} onOpenChange={() => setEditingTeam(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Group</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Group Name</Label>
              <Input
                value={editingTeam?.name || ''}
                onChange={e => setEditingTeam({ ...editingTeam, name: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleUpdateTeam}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};
