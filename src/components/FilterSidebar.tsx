import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"; // Import useNavigate
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Plus, Users, History, Clock } from "lucide-react"; // Import History/Clock icons
import { toast } from "sonner";
import { getSportsList } from "@/services/playersService";
import { supabase } from "@/lib/supabase";

interface FilterSidebarProps {
  sportFilter: string;
  levelFilter: string;
  teamFilter?: string;
  onSportChange: (value: string) => void;
  onLevelChange: (value: string) => void;
  onTeamChange?: (value: string) => void;
}

export const FilterSidebar = ({
  sportFilter,
  levelFilter,
  teamFilter = "all",
  onSportChange,
  onLevelChange,
  onTeamChange,
}: FilterSidebarProps) => {
  const navigate = useNavigate(); // Initialize hook
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
  const [isAddSportOpen, setIsAddSportOpen] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamSport, setTeamSport] = useState("");
  // const [teamLevel, setTeamLevel] = useState(""); // Unused
  const [newSport, setNewSport] = useState("");
  const [sportsList, setSportsList] = useState<string[]>([]);
  const [teamsList, setTeamsList] = useState<Array<{ id: string; name: string; sport: string }>>([]);

  // Load sports and teams from database
  useEffect(() => {
    loadSports();
    loadTeams();
  }, []);

  const loadSports = async () => {
    try {
      const sports = await getSportsList();
      setSportsList(sports);
    } catch (error) {
      console.error('Error loading sports:', error);
      // Fallback to default sports if loading fails
      setSportsList(["Football", "Basketball", "Soccer", "Volleyball"]);
    }
  };

  const loadTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, sport')
        .order('name', { ascending: true });

      if (error) throw error;
      setTeamsList(data || []);
    } catch (error) {
      console.error('Error loading teams:', error);
    }
  };

  const handleCreateTeam = async () => {
    if (!teamName.trim() || !teamSport) {
      toast.error("Please fill out team name and sport");
      return;
    }
    
    try {
      const { error } = await supabase
        .from('teams')
        .insert({
          name: teamName.trim(),
          sport: teamSport,
        });

      if (error) throw error;
      
      toast.success(`Team "${teamName}" created successfully`);
      setIsCreateTeamOpen(false);
      setTeamName("");
      setTeamSport("");
      
      // Reload sports and teams list
      await loadSports();
      await loadTeams();
      
      // Trigger page refresh to show new team
      window.location.reload();
    } catch (error) {
      console.error('Error creating team:', error);
      toast.error('Failed to create team');
    }
  };

  const handleAddSport = () => {
    if (!newSport.trim()) {
      toast.error("Please enter a sport name");
      return;
    }
    if (sportsList.includes(newSport.trim())) {
      toast.error("This sport already exists");
      return;
    }
    
    // Add to local list (will be added to DB when team is created with this sport)
    setSportsList([...sportsList, newSport.trim()]);
    toast.success(`"${newSport.trim()}" added to sports list`);
    setNewSport("");
    setIsAddSportOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* 1. Quick Actions Card (New) */}
      <Card className="bg-white border-border">
        <CardHeader>
          <CardTitle className="text-navy-dark flex items-center gap-2">
            <Users className="h-5 w-5" />
            Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button 
            onClick={() => navigate('/history')} 
            className="w-full justify-start"
            variant="ghost"
          >
            <History className="h-4 w-4 mr-2" />
            Communication History
          </Button>
          
          <Separator />

          <Button 
            onClick={() => setIsCreateTeamOpen(true)} 
            className="w-full justify-start"
            variant="ghost"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Team
          </Button>
        </CardContent>
      </Card>

      {/* 2. Filters Card (Existing) */}
      <Card className="bg-white border-border">
        <CardHeader>
          <CardTitle className="text-navy-dark">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sport-filter" className="text-navy-dark">Sport</Label>
            <Select value={sportFilter} onValueChange={onSportChange}>
              <SelectTrigger id="sport-filter" className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sports</SelectItem>
                {sportsList.map((sport) => (
                  <SelectItem key={sport} value={sport}>{sport}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="level-filter" className="text-navy-dark">Level</Label>
            <Select value={levelFilter} onValueChange={onLevelChange}>
              <SelectTrigger id="level-filter" className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="Varsity">Varsity</SelectItem>
                <SelectItem value="JV">JV</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {onTeamChange && (
            <div className="space-y-2">
              <Label htmlFor="team-filter" className="text-navy-dark">Team</Label>
              <Select value={teamFilter} onValueChange={onTeamChange}>
                <SelectTrigger id="team-filter" className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teams</SelectItem>
                  <SelectItem value="unassigned">No Team (Unassigned)</SelectItem>
                  {teamsList.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name} ({team.sport})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Sport Dialog */}
      <Dialog open={isAddSportOpen} onOpenChange={setIsAddSportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Sport</DialogTitle>
            <DialogDescription>
              Add a new sport to your organization
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="new-sport">Sport Name</Label>
              <Input
                id="new-sport"
                placeholder="e.g., Tennis"
                value={newSport}
                onChange={(e) => setNewSport(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddSportOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddSport}>
                Add Sport
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateTeamOpen} onOpenChange={setIsCreateTeamOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Create New Team
            </DialogTitle>
            <DialogDescription>
              Add a new team to your organization
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="team-name">Team Name</Label>
              <Input
                id="team-name"
                placeholder="e.g., Varsity Football"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Sport</Label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 px-2 text-xs"
                  onClick={() => {
                    setIsCreateTeamOpen(false);
                    setIsAddSportOpen(true);
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add New
                </Button>
              </div>
              <Select value={teamSport} onValueChange={setTeamSport}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a sport" />
                </SelectTrigger>
                <SelectContent>
                  {sportsList.map((sport) => (
                    <SelectItem key={sport} value={sport}>{sport}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsCreateTeamOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateTeam}>
                Create Team
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};