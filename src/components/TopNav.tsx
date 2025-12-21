import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import veissLogo from "@/assets/veiss-logo.png";
import { ProfileMenu } from "./ProfileMenu";

interface TopNavProps {
  selectedTeam: string;
  onTeamChange: (value: string) => void;
}

export const TopNav = ({ selectedTeam, onTeamChange }: TopNavProps) => {
  return (
    <header className="h-16 bg-gold border-b border-gold flex items-center justify-between px-6">
      <div className="flex-1 max-w-sm">
        <Select value={selectedTeam} onValueChange={onTeamChange}>
          <SelectTrigger className="bg-white border-border text-navy-dark">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-white border-border">
            <SelectItem value="all">All Teams</SelectItem>
            <SelectItem value="varsity-football">Varsity Football</SelectItem>
            <SelectItem value="jv-football">JV Football</SelectItem>
            <SelectItem value="varsity-basketball">Varsity Basketball</SelectItem>
            <SelectItem value="jv-basketball">JV Basketball</SelectItem>
            <SelectItem value="varsity-soccer">Varsity Soccer</SelectItem>
            <SelectItem value="jv-soccer">JV Soccer</SelectItem>
            <SelectItem value="varsity-volleyball">Varsity Volleyball</SelectItem>
            <SelectItem value="jv-volleyball">JV Volleyball</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="absolute left-1/2 transform -translate-x-1/2">
        <img src={veissLogo} alt="Veiss" className="h-8" />
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="text-navy-dark hover:text-navy-medium hover:bg-white/20">
          <Settings className="h-5 w-5" />
        </Button>
        <ProfileMenu />
      </div>
    </header>
  );
};
