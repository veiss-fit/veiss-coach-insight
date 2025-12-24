import React, { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

interface AuthContextType {
  isAuthenticated: boolean;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  changePassword: (currentPassword: string, newPassword: string) => boolean;
  user: { name: string; email: string } | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    const authStatus = localStorage.getItem("veiss-auth");
    if (authStatus === "authenticated") {
      setIsAuthenticated(true);
      setUser({
        name: "Coach Martin",
        email: "coach.martin@veiss.com"
      });
    }
  }, []);

  const login = (email: string, password: string) => {
    const storedPassword = localStorage.getItem("veiss-password") || "teamveiss";
    if (email === "coach.martin@veiss.com" && password === storedPassword) {
      setIsAuthenticated(true);
      setUser({
        name: "Coach Martin",
        email: "coach.martin@veiss.com"
      });
      localStorage.setItem("veiss-auth", "authenticated");
      return true;
    }
    return false;
  };

  const changePassword = (currentPassword: string, newPassword: string) => {
    const storedPassword = localStorage.getItem("veiss-password") || "teamveiss";
    if (currentPassword !== storedPassword) {
      return false;
    }
    localStorage.setItem("veiss-password", newPassword);
    return true;
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);
    localStorage.removeItem("veiss-auth");
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout, changePassword, user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
