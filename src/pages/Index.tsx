import { useState, useMemo, useEffect } from "react";
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
import { Athlete } from "@/data/mockData";
import { Users, UserCheck, Layers, Send, CalendarDays, Megaphone, UserPlus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getPlayersByTeamIds, getPlayersByTeamId, PlayerWithStats } from "@/services/playersService";
import { getCoachDashboardStats, DashboardStats } from "@/services/statsService";
// import { useDashboardSubscription } from "@/hooks/useRealtimeSubscriptions"; // Disabled for free tier
import { TemplateManager } from '@/components/TemplateManager';

const Index = () => {
  const { profile, loading: authLoading } = useAuth();
  const [selectedAthlete, setSelectedAthlete] = useState<Athlete | null>(null);
  const [workoutBuilderOpen, setWorkoutBuilderOpen] = useState(false);
  const [announcementBuilderOpen, setAnnouncementBuilderOpen] = useState(false);
  const [playerBuilderOpen, setPlayerBuilderOpen] = useState(false);
  const [sportFilter, setSportFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [refreshKey, setRefreshKey] = useState(0);
  const [isTemplateBuilderOpen, setIsTemplateBuilderOpen] = useState(false);
  
  // Real data from Supabase
  const [athletes, setAthletes] = useState<PlayerWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalSessions: 0,
    activeAthletes: 0,
    avgAttendance: 0,
    totalTeams: 0,
    avgTeamLoad: 0,
    topPerformer: 'N/A',
    lowestAttendance: 0,
  });

  // Load players and stats from database
  // Only load when auth is done loading AND profile is available
  useEffect(() => {
    console.log('Index useEffect triggered:', { authLoading, profile: !!profile, profileId: profile?.id });
    
    // Wait for auth to finish loading
    if (authLoading) {
      console.log('Auth still loading, waiting...');
      setLoading(true);
      return;
    }
    
    // Only load data if profile is available (user is authenticated)
    if (profile) {
      console.log('Profile available, loading data...');
      loadData();
    } else {
      // If no profile after auth loads, user is not authenticated
      // Set loading to false so UI can show appropriate state
      console.log('No profile after auth loaded, setting loading to false');
      setLoading(false);
    }
  }, [profile, refreshKey, authLoading]);

  const loadData = async () => {
    // Safety check: don't load if profile is not available
    if (!profile) {
      console.warn('loadData called but profile is not available');
      setLoading(false);
      return;
    }

    // Set a timeout to prevent infinite loading (30 seconds max)
    const timeoutId = setTimeout(() => {
      console.error('loadData timeout - taking too long, stopping loading');
      setLoading(false);
      toast.error('Loading is taking longer than expected. Please refresh the page.');
    }, 30000);

    try {
      setLoading(true);
      
      // Always load all players initially - team filter will handle filtering
      // This allows coaches to see unassigned players (team_id = null) and assign them
      console.log('Loading players...');
      const players = await getPlayersByTeamId(profile.coach.team_id);
      console.log(`Loaded ${players.length} players`);
      setAthletes(players);

      // Load dashboard statistics (scoped to coach's team if they have one)
      console.log('Loading stats...');
      const dashboardStats = await getCoachDashboardStats(profile?.coach?.team_id || null);
      console.log('Stats loaded:', dashboardStats);
      setStats(dashboardStats);
      
      clearTimeout(timeoutId);
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error('Error loading data:', error);
      toast.error(`Failed to load dashboard data: ${error.message || 'Unknown error'}`);
      // Set empty data so UI doesn't get stuck
      setAthletes([]);
      setStats({
        totalSessions: 0,
        activeAthletes: 0,
        avgAttendance: 0,
        totalTeams: 0,
        avgTeamLoad: 0,
        topPerformer: 'N/A',
        lowestAttendance: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredAthletes = useMemo(() => {
    return athletes.filter((athlete) => {
      // Sidebar filters
      if (sportFilter !== "all" && athlete.sport !== sportFilter) return false;
      if (levelFilter !== "all" && athlete.level !== levelFilter) return false;
      
      // TEAM FILTER LOGIC
      if (teamFilter === "unassigned") {
        // Explicitly show ONLY unassigned players
        if (athlete.team_id !== null) return false;
      } else if (teamFilter === "all") {
        // "All Teams" now means "Anyone assigned to a team"
        // Hides unassigned players from the default view
        if (athlete.team_id === null) return false; 
      } else {
        // Specific team selected (e.g., "Varsity Basketball")
        if (athlete.team_id !== teamFilter) return false;
      }
      
      return true;
    });
  }, [athletes, sportFilter, levelFilter, teamFilter]);

  const handlePlayerBuilderClose = () => {
    setPlayerBuilderOpen(false);
    setRefreshKey(prev => prev + 1); // Trigger re-render to show new player
  };

  /* Real-time subscription disabled (requires Supabase Pro plan)
  // Subscribe to real-time updates
  useDashboardSubscription(
    {
      onNewPlayer: (player) => {
        console.log('Real-time: New player added', player);
        // Refresh data when new player is added
        if (profile?.coach?.team_id && player.team_id === profile.coach.team_id) {
          toast.success(`New player added: ${player.full_name}`);
          loadData();
        }
      },
      onNewSession: (session) => {
        console.log('Real-time: New session completed', session);
        // Refresh stats when new session is completed
        toast.success('A new workout session was completed!');
        loadData();
      },
      onNewMessage: (message) => {
        console.log('Real-time: New message sent', message);
        // Could show a notification that message was delivered
      },
      onPlanUpdate: (plan) => {
        console.log('Real-time: Workout plan updated', plan);
        // Refresh when workout plan status changes (e.g., completed)
        if (plan.is_completed) {
          toast.success('A workout plan was completed!');
          loadData();
        }
      },
    },
    !!profile // Only subscribe when user is logged in
  );
  */

  return (
    <div className="min-h-screen bg-background">
      <TopNav />

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-80 p-6 border-r border-border bg-background">
          <FilterSidebar
            sportFilter={sportFilter}
            levelFilter={levelFilter}
            teamFilter={teamFilter}
            onSportChange={setSportFilter}
            onLevelChange={setLevelFilter}
            onTeamChange={setTeamFilter}
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
            <Button variant="outline" onClick={() => setIsTemplateBuilderOpen(true)}>
              <Layers className="h-4 w-4 mr-2" />
              Create Template
            </Button>
            {/* ------------------------- */}
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
                value={loading ? "..." : stats.totalSessions}
                icon={CalendarDays}
              />
              <StatCard
                title="Active Athletes"
                value={loading ? "..." : stats.activeAthletes}
                icon={Users}
                status="success"
              />
              <StatCard
                title="Average Attendance"
                value={loading ? "..." : `${stats.avgAttendance}%`}
                icon={UserCheck}
                status="success"
              />
              <StatCard
                title="Total Teams"
                value={loading ? "..." : stats.totalTeams}
                icon={Layers}
              />
            </div>
          </div>

          {/* Athlete Table */}
          <div>
            <h2 className="text-2xl font-bold mb-4">Athletes</h2>
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="text-muted-foreground">Loading players...</div>
              </div>
            ) : (
              <AthleteTable 
                athletes={filteredAthletes} 
                onAthleteSelect={setSelectedAthlete}
                filtersActive={sportFilter !== "all" || levelFilter !== "all" || teamFilter !== "all"}
              />
            )}
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
        onClose={handlePlayerBuilderClose}
      />
      <TemplateManager 
        open={isTemplateBuilderOpen} 
        onClose={() => setIsTemplateBuilderOpen(false)} 
      />
      {/* ---------------------------- */}
    </div>
  );
};

export default Index;
