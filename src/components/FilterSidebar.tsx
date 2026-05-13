import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Users, History, Trophy } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { TeamSportManager } from "@/components/TeamSportManager";
import { CommunicationHistory } from "@/components/CommunicationHistory";

interface FilterSidebarProps {
  teamFilter?: string;
  onTeamChange?: (value: string) => void;
  onPlayersChanged?: () => void;
}

export const FilterSidebar = ({
  teamFilter = "all",
  onTeamChange,
  onPlayersChanged,
}: FilterSidebarProps) => {
  const { user } = useAuth();
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [teamsList, setTeamsList] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (user?.id) loadTeams();
  }, [user?.id]);

  const loadTeams = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name')
        .eq('coach_user_id', user.id)
        .order('name', { ascending: true });

      if (error) throw error;
      setTeamsList(data || []);
    } catch (error) {
      console.error('Error loading teams:', error);
      setTeamsList([]);
    }
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
            onClick={() => setIsHistoryOpen(true)}
            className="w-full justify-start"
            variant="ghost"
          >
            <History className="h-4 w-4 mr-2" />
            Communication History
          </Button>

          <Separator />

          <Button
            onClick={() => setIsManagerOpen(true)}
            className="w-full justify-start"
            variant="ghost"
          >
            <Trophy className="h-4 w-4 mr-2" />
            Manage Groups & Players
          </Button>
        </CardContent>
      </Card>

      {/* Filters Card */}
      <Card className="bg-white border-border">
        <CardHeader>
          <CardTitle className="text-navy-dark">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {onTeamChange && (
            <div className="space-y-2">
              <Label htmlFor="team-filter" className="text-navy-dark">Group</Label>
              <Select value={teamFilter} onValueChange={onTeamChange}>
                <SelectTrigger id="team-filter" className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Groups</SelectItem>
                  {teamsList.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      <TeamSportManager
        open={isManagerOpen}
        onClose={() => {
          setIsManagerOpen(false);
          loadTeams();
        }}
        onPlayersChanged={onPlayersChanged}
      />

      <CommunicationHistory
        open={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
      />
    </div>
  );
};
