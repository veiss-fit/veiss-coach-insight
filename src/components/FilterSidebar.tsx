import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

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

      </CardContent>
    </Card>
  );
};
