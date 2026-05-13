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
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
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
      ((athlete as any).group || '').toLowerCase().includes(searchTerm.toLowerCase())
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
          placeholder="Search athletes by name or group..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1);
          }}
          className="pl-10 bg-card border-border"
        />
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        <Table className="w-full table-fixed">
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-1/3 py-2 font-semibold text-center">Athlete</TableHead>
              <TableHead className="w-1/3 py-2 font-semibold text-center">Group</TableHead>
              <TableHead className="w-1/3 py-2 font-semibold text-center">Attendance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedAthletes.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={3} className="text-center py-10 text-muted-foreground">
                        No athletes found.
                    </TableCell>
                </TableRow>
            ) : (
                displayedAthletes.map((athlete) => (
                    <TableRow
                      key={athlete.id}
                      className="h-12 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => onAthleteSelect(athlete)}
                    >
                      <TableCell className="py-2 text-center font-medium">{athlete.name}</TableCell>
                      <TableCell className="py-2 text-center">
                        <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{(athlete as any).group || '—'}</span>
                      </TableCell>
                      <TableCell className="py-2 text-center font-medium">{athlete.attendance}%</TableCell>
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