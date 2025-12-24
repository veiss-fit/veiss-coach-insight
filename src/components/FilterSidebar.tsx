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
import { sportsList, addSport } from "@/data/mockData";

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
  const [isAddSportOpen, setIsAddSportOpen] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamSport, setTeamSport] = useState("");
  const [teamLevel, setTeamLevel] = useState("");
  const [newSport, setNewSport] = useState("");
  const [, forceUpdate] = useState(0);

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

  const handleAddSport = () => {
    if (!newSport.trim()) {
      toast.error("Please enter a sport name");
      return;
    }
    if (sportsList.includes(newSport.trim())) {
      toast.error("This sport already exists");
      return;
    }
    addSport(newSport.trim());
    toast.success(`"${newSport.trim()}" added to sports list`);
    setNewSport("");
    setIsAddSportOpen(false);
    forceUpdate(n => n + 1); // Trigger re-render
  };

  return (
    <>
      <Card className="bg-white border-border">
        <CardHeader>
          <CardTitle className="text-navy-dark">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="sport-filter" className="text-navy-dark">Sport</Label>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 px-2 text-xs"
                onClick={() => setIsAddSportOpen(true)}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            </div>
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
              <Label>Sport</Label>
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
