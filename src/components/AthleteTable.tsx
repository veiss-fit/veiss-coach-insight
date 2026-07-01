import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { PlayerWithStats } from "@/services/playersService";

const getInitials = (name: string) =>
  name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

interface AthleteTableProps {
  athletes: PlayerWithStats[];
  onAthleteSelect: (athlete: PlayerWithStats) => void;
  filtersActive?: boolean;
}

const ATHLETES_PER_PAGE = 10;

const TH_STYLE: React.CSSProperties = {
  fontFamily: 'Inter',
  fontSize: 10.5,
  fontWeight: 600,
  color: '#8d95a4',
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  padding: '10px 14px',
  textAlign: 'left',
};

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

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(7,16,31,0.06)' }}>
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#fbfbfc', borderBottom: '1px solid rgba(7,16,31,0.06)' }}>
              <th style={TH_STYLE}>Athlete</th>
              <th style={TH_STYLE}>Group</th>
              <th style={TH_STYLE}>Attendance</th>
              <th style={TH_STYLE}>Last Workout</th>
              <th style={TH_STYLE} />
            </tr>
          </thead>
          <tbody>
            {displayedAthletes.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '40px 0', color: '#8d95a4', fontSize: 13 }}>
                  No athletes found.
                </td>
              </tr>
            ) : (
              displayedAthletes.map((athlete) => (
                <tr
                  key={athlete.id}
                  style={{ height: 44, borderBottom: '1px solid rgba(7,16,31,0.06)', cursor: 'pointer', backgroundColor: '#ffffff' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#fbfbfc')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#ffffff')}
                  onClick={() => onAthleteSelect(athlete)}
                >
                  {/* Athlete */}
                  <td style={{ padding: '0 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        backgroundColor: '#eef1f6', color: '#07101f',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 600, letterSpacing: '0.01em',
                        flexShrink: 0,
                      }}>
                        {getInitials(athlete.name)}
                      </div>
                      <span style={{ fontFamily: 'Inter', fontSize: 13, fontWeight: 500, color: '#07101f' }}>
                        {athlete.name}
                      </span>
                    </div>
                  </td>

                  {/* Group */}
                  <td style={{ padding: '0 14px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      height: 20, padding: '0 7px', borderRadius: 999,
                      backgroundColor: '#f1f2f5', border: '1px solid rgba(7,16,31,0.06)',
                      fontSize: 11, fontWeight: 500, color: '#28344a', letterSpacing: '0.01em',
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#8d95a4', flexShrink: 0 }} />
                      {(athlete as any).group || '—'}
                    </span>
                  </td>

                  {/* Attendance */}
                  <td style={{ padding: '0 14px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: 'Inter', fontSize: 12, color: '#07101f', minWidth: 28, textAlign: 'right' }}>
                        {athlete.attendance}%
                      </span>
                      <div style={{ width: 60, height: 4, borderRadius: 999, backgroundColor: '#d1d5db', overflow: 'hidden' }}>
                        <div style={{
                          width: `${athlete.attendance}%`,
                          height: '100%',
                          borderRadius: 999,
                          backgroundColor: athlete.attendance >= 85 ? '#1f8a5b' : athlete.attendance >= 70 ? '#d97706' : '#c2410c',
                        }} />
                      </div>
                    </div>
                  </td>

                  {/* Last Workout */}
                  <td style={{ padding: '0 14px' }}>
                    {athlete.lastWorkout ? (
                      <div>
                        <span style={{ fontFamily: 'Inter', fontSize: 13, fontWeight: 500, color: '#07101f' }}>
                          {athlete.lastWorkout.name || 'Workout'}
                        </span>
                        <span style={{ fontFamily: 'Inter', fontSize: 11, color: '#8d95a4', marginLeft: 6 }}>
                          {new Date(athlete.lastWorkout.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    ) : (
                      <span style={{ fontFamily: 'Inter', fontSize: 11, color: '#8d95a4' }}>No sessions</span>
                    )}
                  </td>

                  {/* Chevron */}
                  <td style={{ width: 40, padding: '0 14px', textAlign: 'right' }}>
                    <ChevronRight size={16} color="#8d95a4" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!isPaginationDisabled && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * ATHLETES_PER_PAGE + 1}–{Math.min(currentPage * ATHLETES_PER_PAGE, filteredAthletes.length)} of {filteredAthletes.length} athletes
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
