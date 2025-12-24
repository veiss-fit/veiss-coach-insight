import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Plus } from "lucide-react";
import { toast } from "sonner";
import { sportsList, addSport } from "@/data/mockData";

interface PlayerBuilderProps {
  open: boolean;
  onClose: () => void;
}

export const PlayerBuilder = ({ open, onClose }: PlayerBuilderProps) => {
  const [playerName, setPlayerName] = useState("");
  const [playerSport, setPlayerSport] = useState("");
  const [playerLevel, setPlayerLevel] = useState("");
  const [playerGroup, setPlayerGroup] = useState("");
  const [isAddSportOpen, setIsAddSportOpen] = useState(false);
  const [newSport, setNewSport] = useState("");
  const [, forceUpdate] = useState(0);

  const handleAddPlayer = () => {
    if (!playerName.trim() || !playerSport || !playerLevel) {
      toast.error("Please fill out name, sport, and level");
      return;
    }
    toast.success(`Player "${playerName}" added successfully`);
    onClose();
    // Reset form
    setPlayerName("");
    setPlayerSport("");
    setPlayerLevel("");
    setPlayerGroup("");
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
    forceUpdate(n => n + 1);
  };

  return (
    <>
      <Dialog open={open && !isAddSportOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Add New Player
            </DialogTitle>
            <DialogDescription>
              Add a new player to your roster
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="player-name">Player Name</Label>
              <Input
                id="player-name"
                placeholder="e.g., John Smith"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Sport</Label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 px-2 text-xs"
                  onClick={() => setIsAddSportOpen(true)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add New
                </Button>
              </div>
              <Select value={playerSport} onValueChange={setPlayerSport}>
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
              <Select value={playerLevel} onValueChange={setPlayerLevel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Varsity">Varsity</SelectItem>
                  <SelectItem value="JV">JV</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="player-group">Group/Position (Optional)</Label>
              <Input
                id="player-group"
                placeholder="e.g., Offense, Guard, Forward"
                value={playerGroup}
                onChange={(e) => setPlayerGroup(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleAddPlayer}>
                Add Player
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
    </>
  );
};