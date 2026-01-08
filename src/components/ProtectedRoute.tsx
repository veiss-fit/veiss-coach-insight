import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";

// 1. Update the interface to include allowedRoles (optional array of strings)
interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[]; 
}

export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingOverlay isLoading={loading} fullScreen message="Authenticating..." />;
  }

  // 2. Check if user is logged in
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. (New) Check for Role Authorization
  // If allowedRoles is provided, ensure the user's profile role matches one of them
  if (allowedRoles && profile) {
    if (!allowedRoles.includes(profile.role)) {
      // User is logged in but doesn't have the right permissions
      // Redirect to home or a "Not Authorized" page
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};