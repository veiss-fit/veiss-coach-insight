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
import { Button } from "@/components/ui/button";
import { Search, ChevronLeft, ChevronRight, Activity, Maximize2, Timer } from "lucide-react";
import { Athlete } from "@/data/mockData";
import { PlayerWithStats } from "@/services/playersService";

interface AthleteTableProps {
  athletes: PlayerWithStats[]; // Updated to use the rich interface
  onAthleteSelect: (athlete: PlayerWithStats) => void;
  filtersActive?: boolean;
}

const ATHLETES_PER_PAGE = 10;

export const AthleteTable = ({ athletes, onAthleteSelect, filtersActive = false }: AthleteTableProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const filteredAthletes = athletes.filter(
    (athlete) =>
      athlete.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      athlete.sport.toLowerCase().includes(searchTerm.toLowerCase()) ||
      athlete.level.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isPaginationDisabled = filtersActive || searchTerm.length > 0;
  const totalPages = isPaginationDisabled ? 1 : Math.ceil(filteredAthletes.length / ATHLETES_PER_PAGE);
  const displayedAthletes = isPaginationDisabled 
    ? filteredAthletes 
    : filteredAthletes.slice((currentPage - 1) * ATHLETES_PER_PAGE, currentPage * ATHLETES_PER_PAGE);

  const handlePrevPage = () => setCurrentPage(prev => Math.max(1, prev - 1));
  const handleNextPage = () => setCurrentPage(prev => Math.min(totalPages, prev + 1));

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search athletes by name, sport, or level..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1);
          }}
          className="pl-10 bg-card border-border"
        />
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="font-semibold">Athlete</TableHead>
              <TableHead className="font-semibold text-center">Sport</TableHead>
              {/* --- PHASE 22 NEW COLUMNS --- */}
              <TableHead className="font-semibold text-center">
                <div className="flex items-center justify-center gap-1">
                  <Activity className="h-3 w-3" /> Velocity
                </div>
              </TableHead>
              <TableHead className="font-semibold text-center">
                <div className="flex items-center justify-center gap-1">
                  <Maximize2 className="h-3 w-3" /> ROM
                </div>
              </TableHead>
              <TableHead className="font-semibold text-center">
                <div className="flex items-center justify-center gap-1">
                  <Timer className="h-3 w-3" /> Explosiveness
                </div>
              </TableHead>
              {/* ----------------------------- */}
              <TableHead className="font-semibold text-center">Attendance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedAthletes.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                        No athletes found.
                    </TableCell>
                </TableRow>
            ) : (
                displayedAthletes.map((athlete) => (
                    <TableRow
                      key={athlete.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => onAthleteSelect(athlete)}
                    >
                      <TableCell className="font-medium">{athlete.name}</TableCell>
                      <TableCell className="text-center">
                        <span className="text-xs bg-muted px-2 py-1 rounded-full">{athlete.sport}</span>
                      </TableCell>
                      
                      {/* Velocity with color coding */}
                      <TableCell className={`text-center font-bold ${athlete.avgVelocity < 0.4 ? 'text-destructive' : 'text-chart-2'}`}>
                        {athlete.avgVelocity > 0 ? `${athlete.avgVelocity} m/s` : '--'}
                      </TableCell>

                      {/* ROM Summary */}
                      <TableCell className="text-center">
                        {athlete.avgROM > 0 ? `${athlete.avgROM}mm` : '--'}
                      </TableCell>

                      {/* Tempo/Concentric Duration */}
                      <TableCell className="text-center">
                        {athlete.avgTempo > 0 ? `${athlete.avgTempo}s` : '--'}
                      </TableCell>

                      <TableCell className="text-center font-medium">{athlete.attendance}%</TableCell>
                    </TableRow>
                  ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      {!isPaginationDisabled && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * ATHLETES_PER_PAGE + 1}-{Math.min(currentPage * ATHLETES_PER_PAGE, filteredAthletes.length)} of {filteredAthletes.length} athletes
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={currentPage === 1}>
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
            <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage === totalPages}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};