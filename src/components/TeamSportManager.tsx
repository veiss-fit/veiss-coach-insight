import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Trophy, 
  Users, 
  Pencil, 
  Trash2, 
  Plus, 
  AlertCircle 
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { updateTeam, deleteTeam, updateSportName, getSportsList } from "@/services/playersService";

interface TeamSportManagerProps {
  open: boolean;
  onClose: () => void;
}

export const TeamSportManager = ({ open, onClose }: TeamSportManagerProps) => {
  const [teams, setTeams] = useState<any[]>([]);
  const [sports, setSports] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Edit States
  const [editingTeam, setEditingTeam] = useState<any | null>(null);
  const [editingSport, setEditingSport] = useState<{ old: string, new: string } | null>(null);
  
  // Create States
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [newTeamData, setNewTeamData] = useState({ name: '', sport: '' });

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load Teams
      const { data: teamsData } = await supabase
        .from('teams')
        .select('*')
        .order('name');
      setTeams(teamsData || []);

      // Load Sports
      const sportsList = await getSportsList();
      setSports(sportsList);
    } catch (error) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  // --- TEAM ACTIONS ---

  const handleCreateTeam = async () => {
    if (!newTeamData.name || !newTeamData.sport) {
      toast.error("Name and Sport are required");
      return;
    }
    try {
      const { error } = await supabase.from('teams').insert(newTeamData);
      if (error) throw error;
      toast.success("Team created");
      setIsCreatingTeam(false);
      setNewTeamData({ name: '', sport: '' });
      loadData();
    } catch (e) {
      toast.error("Failed to create team");
    }
  };

  const handleUpdateTeam = async () => {
    if (!editingTeam) return;
    const success = await updateTeam(editingTeam.id, { 
      name: editingTeam.name, 
      sport: editingTeam.sport 
    });
    if (success) {
      toast.success("Team updated");
      setEditingTeam(null);
      loadData();
    } else {
      toast.error("Update failed");
    }
  };

  const handleDeleteTeam = async (id: string) => {
    if (!confirm("Are you sure? This will fail if players are assigned to this team.")) return;
    const success = await deleteTeam(id);
    if (success) {
      toast.success("Team deleted");
      loadData();
    } else {
      toast.error("Cannot delete team (likely has players assigned)");
    }
  };

  // --- SPORT ACTIONS ---

  const handleRenameSport = async () => {
    if (!editingSport) return;
    const success = await updateSportName(editingSport.old, editingSport.new);
    if (success) {
      toast.success(`Renamed ${editingSport.old} to ${editingSport.new}`);
      setEditingSport(null);
      loadData();
    } else {
      toast.error("Rename failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl h-[85vh] flex flex-col p-0 gap-0 overflow-hidden outline-none">
        
        {/* Header - Fixed Height */}
        <DialogHeader className="p-6 pb-2 border-b shrink-0">
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Trophy className="h-6 w-6 text-primary" />
            Manage Teams & Sports
          </DialogTitle>
          <DialogDescription>
            Edit team names, correct sport categories, or remove unused entries.
          </DialogDescription>
        </DialogHeader>

        {/* Tabs - Flex Column that Fills Space */}
        <Tabs defaultValue="teams" className="flex-1 flex flex-col overflow-hidden w-full">
          
          <div className="px-6 py-4 shrink-0 border-b">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="teams">Teams</TabsTrigger>
              <TabsTrigger value="sports">Sports Categories</TabsTrigger>
            </TabsList>
          </div>

          {/* === TEAMS TAB === */}
          {/* FIX: h-full, w-full, overflow-hidden to contain ScrollArea */}
          <TabsContent 
            value="teams" 
            className="flex-1 flex flex-col h-full w-full overflow-hidden m-0 p-0 data-[state=inactive]:hidden"
          >
            <div className="px-6 py-4 flex justify-end shrink-0 bg-background z-10">
              <Button size="sm" onClick={() => setIsCreatingTeam(true)}>
                <Plus className="h-4 w-4 mr-2" /> Add Team
              </Button>
            </div>

            <ScrollArea className="flex-1 h-full w-full">
              <div className="px-6 pb-6 space-y-3">
                {teams.length === 0 && !loading && (
                   <div className="text-center py-10 text-muted-foreground">No teams found. Add one above.</div>
                )}
                {teams.map((team) => (
                  <Card key={team.id} className="group hover:border-primary/50 transition-colors">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-full">
                          <Users className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold">{team.name}</p>
                          <p className="text-xs text-muted-foreground">{team.sport}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          onClick={() => setEditingTeam(team)}
                        >
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
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* === SPORTS TAB === */}
          <TabsContent 
            value="sports" 
            className="flex-1 flex flex-col h-full w-full overflow-hidden m-0 p-0 data-[state=inactive]:hidden"
          >
            <div className="px-6 pt-4 shrink-0">
              <div className="bg-muted/30 p-3 rounded-md mb-4 flex gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <p>Renaming a sport here will update it for all associated teams automatically.</p>
              </div>
            </div>

            <ScrollArea className="flex-1 h-full w-full">
              <div className="px-6 pb-6 space-y-3">
                {sports.map((sport) => (
                  <Card key={sport} className="group hover:border-secondary transition-colors">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-secondary/20 rounded-full">
                          <Trophy className="h-4 w-4 text-secondary-foreground" />
                        </div>
                        <p className="font-medium">{sport}</p>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setEditingSport({ old: sport, new: sport })}
                      >
                        Rename
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>

      {/* --- MODALS --- */}

      {/* Edit Team Modal */}
      <Dialog open={!!editingTeam} onOpenChange={() => setEditingTeam(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Team</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Team Name</Label>
              <Input 
                value={editingTeam?.name || ''} 
                onChange={e => setEditingTeam({...editingTeam, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Sport</Label>
              <Input 
                value={editingTeam?.sport || ''} 
                onChange={e => setEditingTeam({...editingTeam, sport: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleUpdateTeam}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Team Modal */}
      <Dialog open={isCreatingTeam} onOpenChange={setIsCreatingTeam}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create New Team</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Team Name</Label>
              <Input 
                placeholder="e.g. JV Basketball"
                value={newTeamData.name} 
                onChange={e => setNewTeamData({...newTeamData, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Sport</Label>
              <Input 
                placeholder="e.g. Basketball"
                value={newTeamData.sport} 
                onChange={e => setNewTeamData({...newTeamData, sport: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreateTeam}>Create Team</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Sport Modal */}
      <Dialog open={!!editingSport} onOpenChange={() => setEditingSport(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename Sport Category</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Sport Name</Label>
              <Input 
                value={editingSport?.new || ''} 
                onChange={e => setEditingSport(prev => prev ? {...prev, new: e.target.value} : null)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              This will change "{editingSport?.old}" to "{editingSport?.new}" for all teams.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={handleRenameSport}>Update All Teams</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </Dialog>
  );
};