import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { TemplatesProvider } from "@/contexts/TemplatesContext";
import { FollowedAthletesProvider } from "@/contexts/FollowedAthletesContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { MinScreenGate } from "@/components/MinScreenGate";
import { FollowedAthletesPanel } from "@/components/pulse/FollowedAthletesPanel";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import History from "./pages/History";
import Messages from "./pages/Messages";
import SendProgramming from "./pages/SendProgramming";
import AthleteDashboard from "./pages/AthleteDashboard";
import AuthCallback from "./pages/AuthCallback";

const queryClient = new QueryClient();

/** Keyed by pathname so each route change replays the subtle entrance animation.
 *  Login is excluded: its centered card sits alone on an empty background, so the
 *  6px shift reads as a jump rather than a subtle transition. */
const AppRoutes = () => {
  const location = useLocation();
  const isLogin = location.pathname === "/login";
  return (
    <div className={isLogin ? undefined : "route-fade"} key={location.pathname}>
      <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/auth/reset-password" element={<ResetPassword />} />
            {/* <Route path="/forgot-password" element={<ForgotPassword />} /> */}
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
            <Route path="/auth/callback" element={<AuthCallback />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <TemplatesProvider>
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
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
