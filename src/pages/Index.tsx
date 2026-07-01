import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { TopNav } from "@/components/TopNav";
import { StatCard } from "@/components/StatCard";
import { AthleteTable } from "@/components/AthleteTable";
import { AthleteDetailPanel } from "@/components/AthleteDetailPanel";
import { FilterSidebar } from "@/components/FilterSidebar";
import { AnnouncementBuilder } from "@/components/AnnouncementBuilder";
import { Users, UserCheck, Layers, CalendarDays } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getPlayersWithStatsByCoach, getCoachTeamIds, PlayerWithStats } from "@/services/playersService";
import { getCoachDashboardStats, DashboardStats } from "@/services/statsService";
import { deliverScheduledMessages } from "@/services/messagesService";
// import { useDashboardSubscription } from "@/hooks/useRealtimeSubscriptions"; // Disabled for free tier
import { TemplateManager } from '@/components/TemplateManager';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';

const Index = () => {
  const { profile, user, loading: authLoading } = useAuth();
  const [selectedAthlete, setSelectedAthlete] = useState<PlayerWithStats | null>(null);
  const [announcementBuilderOpen, setAnnouncementBuilderOpen] = useState(false);
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

  // Deliver any scheduled messages whose time has passed, checked every 60 seconds.
  useEffect(() => {
    if (!user?.id) return;
    deliverScheduledMessages(user.id);
    const interval = setInterval(() => deliverScheduledMessages(user.id!), 60_000);
    return () => clearInterval(interval);
  }, [user?.id]);

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

      // Load players and coach-level stats together so attendance stays in sync across the dashboard and table.
      console.log('Loading players and stats...');
      const coachUserId = user?.id ?? '';
      const teamIds = coachUserId ? await getCoachTeamIds(coachUserId) : [];
      const [players, dashboardStats] = await Promise.all([
        getPlayersWithStatsByCoach(coachUserId),
        getCoachDashboardStats(teamIds),
      ]);

      console.log(`Loaded ${players.length} players`);
      setAthletes(players);

      console.log('Stats loaded:', dashboardStats);
      setStats(dashboardStats);
      
      clearTimeout(timeoutId);
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Error loading data:', error);
      toast.error(`Failed to load dashboard data: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      // TEAM FILTER LOGIC
      if (teamFilter === "unassigned") {
        // Explicitly show ONLY unassigned players
        if (athlete.team_id !== null) return false;
      } else if (teamFilter === "all") {
        // show everyone
      } else {
        // Specific team selected (e.g., "Varsity Basketball")
        if (athlete.team_id !== teamFilter) return false;
      }
      
      return true;
    });
  }, [athletes, teamFilter]);

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
    <div className="min-h-screen bg-gray-100">
      <TopNav
        onAnnouncementsClick={() => setAnnouncementBuilderOpen(true)}
        onCreateTemplateClick={() => setIsTemplateBuilderOpen(true)}
        announcementsOpen={announcementBuilderOpen}
      />

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-80 p-6 bg-gray-100">
          <FilterSidebar
            teamFilter={teamFilter}
            onTeamChange={setTeamFilter}
            onPlayersChanged={() => setTimeout(() => setRefreshKey(prev => prev + 1), 300)}
          />
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 space-y-6">
          <LoadingOverlay isLoading={loading} fullScreen message="Loading dashboard..." />

          {/* Overview Stats */}
          <div>
            <h2 className="text-2xl font-bold mb-4">Group Overview</h2>
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
                title="Total Groups"
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
                filtersActive={teamFilter !== "all"}
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

      {/* Announcement Builder */}
      <AnnouncementBuilder
        open={announcementBuilderOpen}
        onClose={() => setAnnouncementBuilderOpen(false)}
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
