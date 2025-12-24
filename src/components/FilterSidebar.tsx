import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Plus, Users } from "lucide-react";
import { toast } from "sonner";

interface FilterSidebarProps {
  sportFilter: string;
  levelFilter: string;
  onSportChange: (value: string) => void;
  onLevelChange: (value: string) => void;
}

export const FilterSidebar = ({
  sportFilter,
  levelFilter,
  onSportChange,
  onLevelChange,
}: FilterSidebarProps) => {
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamSport, setTeamSport] = useState("");
  const [teamLevel, setTeamLevel] = useState("");

  const handleCreateTeam = () => {
    if (!teamName.trim() || !teamSport || !teamLevel) {
      toast.error("Please fill out all fields");
      return;
    }
    toast.success(`Team "${teamName}" created successfully`);
    setIsCreateTeamOpen(false);
    setTeamName("");
    setTeamSport("");
    setTeamLevel("");
  };

  return (
    <>
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
                <SelectItem value="Football">Football</SelectItem>
                <SelectItem value="Basketball">Basketball</SelectItem>
                <SelectItem value="Soccer">Soccer</SelectItem>
                <SelectItem value="Volleyball">Volleyball</SelectItem>
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

          <Separator className="my-4" />

          <Button 
            onClick={() => setIsCreateTeamOpen(true)} 
            className="w-full"
            variant="outline"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Team
          </Button>
        </CardContent>
      </Card>

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
              <Label>Sport</Label>
              <Select value={teamSport} onValueChange={setTeamSport}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a sport" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Football">Football</SelectItem>
                  <SelectItem value="Basketball">Basketball</SelectItem>
                  <SelectItem value="Soccer">Soccer</SelectItem>
                  <SelectItem value="Volleyball">Volleyball</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Level</Label>
              <Select value={teamLevel} onValueChange={setTeamLevel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Varsity">Varsity</SelectItem>
                  <SelectItem value="JV">JV</SelectItem>
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
    </>
  );
};
