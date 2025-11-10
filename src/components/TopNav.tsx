import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import veissLogo from "@/assets/veiss-logo.png";

interface TopNavProps {
  selectedTeam: string;
  onTeamChange: (value: string) => void;
}

export const TopNav = ({ selectedTeam, onTeamChange }: TopNavProps) => {
  return (
    <header className="h-16 bg-navy-medium border-b border-navy-light flex items-center justify-between px-6">
      <div className="flex items-center gap-8">
        <img src={veissLogo} alt="Veiss" className="h-8" />
      </div>

      <div className="flex-1 max-w-sm mx-auto">
        <Select value={selectedTeam} onValueChange={onTeamChange}>
          <SelectTrigger className="bg-navy-dark border-navy-light text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-navy-dark border-navy-light">
            <SelectItem value="varsity-football">Varsity Football</SelectItem>
            <SelectItem value="varsity-basketball">Varsity Basketball</SelectItem>
            <SelectItem value="jv-basketball">JV Basketball</SelectItem>
            <SelectItem value="varsity-soccer">Varsity Soccer</SelectItem>
            <SelectItem value="jv-soccer">JV Soccer</SelectItem>
            <SelectItem value="varsity-volleyball">Varsity Volleyball</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="text-foreground hover:text-gold hover:bg-navy-light">
          <Settings className="h-5 w-5" />
        </Button>
        <Avatar>
          <AvatarImage src="" />
          <AvatarFallback className="bg-gold text-navy-dark font-semibold">CM</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
};
