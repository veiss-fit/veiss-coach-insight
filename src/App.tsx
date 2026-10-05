import { Suspense, lazy, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { TemplatesProvider } from "@/contexts/TemplatesContext";
import { FollowedAthletesProvider } from "@/contexts/FollowedAthletesContext";
import { UnitsProvider } from "@/contexts/UnitsContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Layout } from "@/components/Layout";
import { MinScreenGate } from "@/components/MinScreenGate";
import { FollowedAthletesPanel } from "@/components/pulse/FollowedAthletesPanel";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { deliverScheduledMessages } from "@/services/messagesService";
import Login from "./pages/Login";

// Every page except Login is lazy-loaded — Login is the first thing an
// unauthenticated visitor sees, so it stays in the main bundle.
const Index = lazy(() => import("./pages/Index"));
const Signup = lazy(() => import("./pages/Signup"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Profile = lazy(() => import("./pages/Profile"));
const NotFound = lazy(() => import("./pages/NotFound"));
const History = lazy(() => import("./pages/History"));
const Messages = lazy(() => import("./pages/Messages"));
const SendProgramming = lazy(() => import("./pages/SendProgramming"));
const AthleteDashboard = lazy(() => import("./pages/AthleteDashboard"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));

const RouteFallback = () => <LoadingOverlay isLoading fullScreen message="Loading..." />;

// App-level (not page-level) so scheduled announcements still deliver no matter
// which page the coach is on, instead of only while Index happens to be mounted.
const ScheduledMessageDelivery = () => {
  const { user } = useAuth();
  useEffect(() => {
    if (!user?.id) return;
    deliverScheduledMessages(user.id);
    const interval = setInterval(() => deliverScheduledMessages(user.id!), 60_000);
    return () => clearInterval(interval);
  }, [user?.id]);
  return null;
};

const queryClient = new QueryClient();

// TopNav'd routes share one <Layout> (mounted once, survives route changes) which
// replays the fade animation itself, keyed on pathname, around just the page content.
// Bare routes (login/signup/etc) get their own fade wrapper since each is a distinct,
// naturally-remounting component with no shared chrome to preserve.
const AppRoutes = () => {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<div className="route-fade"><Signup /></div>} />
        <Route path="/forgot-password" element={<div className="route-fade"><ForgotPassword /></div>} />
        <Route path="/auth/reset-password" element={<div className="route-fade"><ResetPassword /></div>} />
        <Route path="/auth/callback" element={<div className="route-fade"><AuthCallback /></div>} />

        <Route element={<Layout />}>
          <Route
            path="/history"
            element={
              <ProtectedRoute allowedRoles={['coach']}>
                <History />
              </ProtectedRoute>
            }
          />
          <Route
            path="/athlete/:id"
            element={
              <ProtectedRoute allowedRoles={['coach']}>
                <AthleteDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/messages"
            element={
              <ProtectedRoute allowedRoles={['coach']}>
                <Messages />
              </ProtectedRoute>
            }
          />
          <Route
            path="/send-programming"
            element={
              <ProtectedRoute allowedRoles={['coach']}>
                <SendProgramming />
              </ProtectedRoute>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Index />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<div className="route-fade"><NotFound /></div>} />
      </Routes>
    </Suspense>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <UnitsProvider>
      <AuthProvider>
        <TemplatesProvider>
        <ScheduledMessageDelivery />
        <Toaster />
        <Sonner />
        <MinScreenGate>
          <BrowserRouter>
            <FollowedAthletesProvider>
              <FollowedAthletesPanel />
              <AppRoutes />
            </FollowedAthletesProvider>
          </BrowserRouter>
        </MinScreenGate>
        </TemplatesProvider>
      </AuthProvider>
      </UnitsProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
