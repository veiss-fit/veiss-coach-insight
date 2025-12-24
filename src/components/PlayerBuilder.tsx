import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { sportsList } from "@/data/mockData";

interface PlayerBuilderProps {
  open: boolean;
  onClose: () => void;
}

export const PlayerBuilder = ({ open, onClose }: PlayerBuilderProps) => {
  const [playerName, setPlayerName] = useState("");
  const [playerSport, setPlayerSport] = useState("");
  const [playerLevel, setPlayerLevel] = useState("");
  const [playerGroup, setPlayerGroup] = useState("");

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

  return (
    <Dialog open={open} onOpenChange={onClose}>
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
            <Label>Sport</Label>
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
  );
};