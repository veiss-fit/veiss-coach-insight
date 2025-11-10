import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

interface FilterSidebarProps {
  sportFilter: string;
  levelFilter: string;
  groupFilter: string;
  onSportChange: (value: string) => void;
  onLevelChange: (value: string) => void;
  onGroupChange: (value: string) => void;
}

export const FilterSidebar = ({
  sportFilter,
  levelFilter,
  groupFilter,
  onSportChange,
  onLevelChange,
  onGroupChange,
}: FilterSidebarProps) => {
  return (
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

        <div className="space-y-2">
          <Label htmlFor="group-filter" className="text-navy-dark">Group</Label>
          <Select value={groupFilter} onValueChange={onGroupChange}>
            <SelectTrigger id="group-filter" className="bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Groups</SelectItem>
              <SelectItem value="Offense">Offense</SelectItem>
              <SelectItem value="Defense">Defense</SelectItem>
              <SelectItem value="Guard">Guard</SelectItem>
              <SelectItem value="Forward">Forward</SelectItem>
              <SelectItem value="Center">Center</SelectItem>
              <SelectItem value="Midfielder">Midfielder</SelectItem>
              <SelectItem value="Setter">Setter</SelectItem>
              <SelectItem value="Hitter">Hitter</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator className="bg-navy-light/20" />

        <div className="space-y-2">
          <h4 className="font-semibold text-navy-dark">Team Insights</h4>
          <div className="space-y-1 text-sm">
            <p className="text-navy-dark/80">
              <span className="font-medium">High Performers:</span> 8
            </p>
            <p className="text-navy-dark/80">
              <span className="font-medium">Need Attention:</span> 3
            </p>
            <p className="text-navy-dark/80">
              <span className="font-medium">Fatigue Index:</span> Moderate
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
