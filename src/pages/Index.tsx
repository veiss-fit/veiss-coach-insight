import { useState, useMemo } from "react";
import { TopNav } from "@/components/TopNav";
import { StatCard } from "@/components/StatCard";
import { AthleteTable } from "@/components/AthleteTable";
import { AthleteDetailPanel } from "@/components/AthleteDetailPanel";
import { FilterSidebar } from "@/components/FilterSidebar";
import { SummaryStrip } from "@/components/SummaryStrip";
import { mockAthletes, teamStats, weeklyStats, Athlete } from "@/data/mockData";
import { Users, Activity, TrendingUp, Clock, Zap } from "lucide-react";
import veissLogo from "@/assets/veiss-logo.png";

const Index = () => {
  const [selectedTeam, setSelectedTeam] = useState("varsity-football");
  const [selectedAthlete, setSelectedAthlete] = useState<Athlete | null>(null);
  const [sportFilter, setSportFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");

  const filteredAthletes = useMemo(() => {
    return mockAthletes.filter((athlete) => {
      if (sportFilter !== "all" && athlete.sport !== sportFilter) return false;
      if (levelFilter !== "all" && athlete.level !== levelFilter) return false;
      if (groupFilter !== "all" && athlete.group !== groupFilter) return false;
      return true;
    });
  }, [sportFilter, levelFilter, groupFilter]);

  return (
    <div className="min-h-screen bg-background">
      <TopNav selectedTeam={selectedTeam} onTeamChange={setSelectedTeam} />

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-80 p-6 border-r border-border bg-background">
          <FilterSidebar
            sportFilter={sportFilter}
            levelFilter={levelFilter}
            groupFilter={groupFilter}
            onSportChange={setSportFilter}
            onLevelChange={setLevelFilter}
            onGroupChange={setGroupFilter}
          />
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 space-y-6">
          {/* Overview Stats */}
          <div>
            <h2 className="text-2xl font-bold mb-4">Team Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard
                title="Active Athletes"
                value={teamStats.activeAthletes}
                icon={Users}
                status="success"
              />
              <StatCard
                title="Avg Velocity"
                value={`${teamStats.avgVelocity} m/s`}
                icon={Activity}
              />
              <StatCard
                title="Avg Range of Motion"
                value={`${teamStats.avgROM} cm`}
                icon={TrendingUp}
              />
              <StatCard
                title="Avg Tempo"
                value={`${teamStats.avgTempo} s`}
                icon={Clock}
              />
              <StatCard
                title="Load Rec Index"
                value={teamStats.loadRecIndex}
                icon={Zap}
                status="success"
                subtitle="Increase recommended"
              />
            </div>
          </div>

          {/* Athlete Table */}
          <div>
            <h2 className="text-2xl font-bold mb-4">Athletes</h2>
            <AthleteTable athletes={filteredAthletes} onAthleteSelect={setSelectedAthlete} />
          </div>

          {/* Summary Strip */}
          <div>
            <h2 className="text-2xl font-bold mb-4">Weekly Summary</h2>
            <SummaryStrip
              totalSessions={weeklyStats.totalSessions}
              avgTeamLoad={weeklyStats.avgTeamLoad}
              topPerformer={weeklyStats.topPerformer}
              lowestAttendance={weeklyStats.lowestAttendance}
            />
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-navy-dark border-t border-navy-light py-6">
        <div className="container mx-auto px-6 flex items-center justify-center">
          <img src={veissLogo} alt="Veiss" className="h-6 opacity-70" />
        </div>
      </footer>

      {/* Athlete Detail Panel */}
      <AthleteDetailPanel
        athlete={selectedAthlete}
        open={!!selectedAthlete}
        onClose={() => setSelectedAthlete(null)}
      />
    </div>
  );
};

export default Index;
