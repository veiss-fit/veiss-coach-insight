import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
// 1. Updated Imports: Added Trophy, removed Plus (if no longer used elsewhere)
import { Users, History, Trophy, Plus } from "lucide-react"; 
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
// 2. Import the new Manager
import { TeamSportManager } from "@/components/TeamSportManager";

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
  const navigate = useNavigate();
  const { profile } = useAuth();
  // 3. New State for the Manager
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  
  // Keep these for the separate "Add Sport" dialog if you still want it
  const [isAddSportOpen, setIsAddSportOpen] = useState(false);
  const [newSport, setNewSport] = useState("");
  
  const [sportsList, setSportsList] = useState<string[]>([]);
  const [teamsList, setTeamsList] = useState<Array<{ id: string; name: string; sport: string }>>([]);

  useEffect(() => {
    loadTeams();
  }, [profile?.coach?.team_id]);

  const loadTeams = async () => {
    try {
      const coachTeamId = profile?.coach?.team_id;
      if (!coachTeamId) {
        setSportsList([]);
        setTeamsList([]);
        return;
      }

      const { data, error } = await supabase
        .from('teams')
        .select('id, name, sport')
        .eq('id', coachTeamId)
        .order('name', { ascending: true });

      if (error) throw error;
      const scopedTeams = data || [];
      setTeamsList(scopedTeams);
      const coachSports = Array.from(new Set(scopedTeams.map((team) => team.sport))).sort();
      setSportsList(coachSports);
    } catch (error) {
      console.error('Error loading teams:', error);
      setSportsList([]);
      setTeamsList([]);
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
    setSportsList([...sportsList, newSport.trim()]);
    toast.success(`"${newSport.trim()}" added to sports list`);
    setNewSport("");
    setIsAddSportOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Management Card */}
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

          {/* 4. REPLACED: Old "Create New Team" with "Manage Teams & Sports" */}
          <Button 
            onClick={() => setIsManagerOpen(true)} 
            className="w-full justify-start"
            variant="ghost"
          >
            <Trophy className="h-4 w-4 mr-2" />
            Manage Teams & Sports
          </Button>
        </CardContent>
      </Card>

      {/* Filters Card */}
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

      {/* 5. ADDED: New Manager Component */}
      <TeamSportManager 
        open={isManagerOpen} 
        onClose={() => {
          setIsManagerOpen(false);
          loadTeams(); // Reload teams when manager closes to reflect updates
          loadSports();
        }} 
      />

      {/* Legacy Add Sport Dialog (Optional, can be removed if handled in Manager) */}
      <Dialog open={isAddSportOpen} onOpenChange={setIsAddSportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Sport</DialogTitle>
            <DialogDescription>Add a new sport to your organization</DialogDescription>
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
              <Button variant="outline" onClick={() => setIsAddSportOpen(false)}>Cancel</Button>
              <Button onClick={handleAddSport}>Add Sport</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};