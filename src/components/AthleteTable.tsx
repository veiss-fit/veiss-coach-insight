import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { Athlete } from "@/data/mockData";

interface AthleteTableProps {
  athletes: Athlete[];
  onAthleteSelect: (athlete: Athlete) => void;
}

export const AthleteTable = ({ athletes, onAthleteSelect }: AthleteTableProps) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredAthletes = athletes.filter(
    (athlete) =>
      athlete.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      athlete.sport.toLowerCase().includes(searchTerm.toLowerCase()) ||
      athlete.level.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getEngagementColor = (engagement: string) => {
    switch (engagement) {
      case "High":
        return "bg-chart-3 text-white";
      case "Moderate":
        return "bg-gold text-navy-dark";
      case "Low":
        return "bg-destructive text-white";
      default:
        return "bg-muted";
    }
  };

  const getLoadRecColor = (loadRec: string) => {
    if (loadRec.includes("+")) return "text-chart-3";
    if (loadRec.includes("-")) return "text-destructive";
    return "text-muted-foreground";
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search athletes by name, sport, or level..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-card border-border"
        />
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="font-semibold">Athlete</TableHead>
              <TableHead className="font-semibold">Sport</TableHead>
              <TableHead className="font-semibold">Level</TableHead>
              <TableHead className="font-semibold text-right">Avg Velocity</TableHead>
              <TableHead className="font-semibold text-right">ROM</TableHead>
              <TableHead className="font-semibold text-right">Tempo</TableHead>
              <TableHead className="font-semibold text-right">Attendance</TableHead>
              <TableHead className="font-semibold text-right">Load Rec</TableHead>
              <TableHead className="font-semibold">Engagement</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAthletes.map((athlete) => (
              <TableRow
                key={athlete.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => onAthleteSelect(athlete)}
              >
                <TableCell className="font-medium">{athlete.name}</TableCell>
                <TableCell>{athlete.sport}</TableCell>
                <TableCell>{athlete.level}</TableCell>
                <TableCell className="text-right">{athlete.avgVelocity} m/s</TableCell>
                <TableCell className="text-right">{athlete.rom} cm</TableCell>
                <TableCell className="text-right">{athlete.tempo} s</TableCell>
                <TableCell className="text-right">{athlete.attendance}%</TableCell>
                <TableCell className={`text-right font-medium ${getLoadRecColor(athlete.loadRec)}`}>
                  {athlete.loadRec}
                </TableCell>
                <TableCell>
                  <Badge className={getEngagementColor(athlete.engagement)}>{athlete.engagement}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
