import { useState, useMemo } from "react";
import { toast } from "sonner";
import { TopNav } from "@/components/TopNav";
import { StatCard } from "@/components/StatCard";
import { AthleteTable } from "@/components/AthleteTable";
import { AthleteDetailPanel } from "@/components/AthleteDetailPanel";
import { FilterSidebar } from "@/components/FilterSidebar";
import { WorkoutBuilder } from "@/components/WorkoutBuilder";
import { AnnouncementBuilder } from "@/components/AnnouncementBuilder";
import { PlayerBuilder } from "@/components/PlayerBuilder";
import { Button } from "@/components/ui/button";
import { mockAthletes, teamStats, weeklyStats, Athlete } from "@/data/mockData";
import { Users, UserCheck, Layers, Send, CalendarDays, Megaphone, UserPlus } from "lucide-react";


const Index = () => {
  const [selectedAthlete, setSelectedAthlete] = useState<Athlete | null>(null);
  const [workoutBuilderOpen, setWorkoutBuilderOpen] = useState(false);
  const [announcementBuilderOpen, setAnnouncementBuilderOpen] = useState(false);
  const [playerBuilderOpen, setPlayerBuilderOpen] = useState(false);
  const [sportFilter, setSportFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");

  const filteredAthletes = useMemo(() => {
    return mockAthletes.filter((athlete) => {
      // Sidebar filters
      if (sportFilter !== "all" && athlete.sport !== sportFilter) return false;
      if (levelFilter !== "all" && athlete.level !== levelFilter) return false;
      return true;
    });
  }, [sportFilter, levelFilter]);

  return (
    <div className="min-h-screen bg-background">
      <TopNav />

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-80 p-6 border-r border-border bg-background">
          <FilterSidebar
            sportFilter={sportFilter}
            levelFilter={levelFilter}
            onSportChange={setSportFilter}
            onLevelChange={setLevelFilter}
          />
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 space-y-6">
          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline"
              onClick={() => setAnnouncementBuilderOpen(true)}
            >
              <Megaphone className="h-4 w-4 mr-2" />
              Announcements
            </Button>
            <Button 
              variant="outline"
              onClick={() => setPlayerBuilderOpen(true)}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add New Player
            </Button>
            <Button 
              onClick={() => setWorkoutBuilderOpen(true)}
              className="bg-primary text-navy-dark hover:bg-primary/90"
            >
              <Send className="h-4 w-4 mr-2" />
              Send Workout
            </Button>
          </div>

          {/* Overview Stats */}
          <div>
            <h2 className="text-2xl font-bold mb-4">Team Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard
                title="Workout Sessions"
                value={weeklyStats.totalSessions}
                icon={CalendarDays}
              />
              <StatCard
                title="Active Athletes"
                value={teamStats.activeAthletes}
                icon={Users}
                status="success"
              />
              <StatCard
                title="Average Attendance"
                value={`${teamStats.avgAttendance}%`}
                icon={UserCheck}
                status="success"
              />
              <StatCard
                title="Total Teams"
                value={teamStats.totalTeams}
                icon={Layers}
              />
            </div>
          </div>

          {/* Athlete Table */}
          <div>
            <h2 className="text-2xl font-bold mb-4">Athletes</h2>
            <AthleteTable 
              athletes={filteredAthletes} 
              onAthleteSelect={setSelectedAthlete}
              filtersActive={sportFilter !== "all" || levelFilter !== "all"}
            />
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-navy-dark border-t border-navy-light py-4">
        <div className="container mx-auto px-6 flex items-center justify-center">
          <p className="text-sm text-white/70">© {new Date().getFullYear()} Veiss. All rights reserved.</p>
        </div>
      </footer>

      {/* Athlete Detail Panel */}
      <AthleteDetailPanel
        athlete={selectedAthlete}
        open={!!selectedAthlete}
        onClose={() => setSelectedAthlete(null)}
      />

      {/* Workout Builder */}
      <WorkoutBuilder
        open={workoutBuilderOpen}
        onClose={() => setWorkoutBuilderOpen(false)}
      />

      {/* Announcement Builder */}
      <AnnouncementBuilder
        open={announcementBuilderOpen}
        onClose={() => setAnnouncementBuilderOpen(false)}
      />

      {/* Player Builder */}
      <PlayerBuilder
        open={playerBuilderOpen}
        onClose={() => setPlayerBuilderOpen(false)}
      />
    </div>
  );
};

export default Index;
