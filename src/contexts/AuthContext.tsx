import React, { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

interface AuthContextType {
  isAuthenticated: boolean;
  login: (email: string, password: string) => boolean;
  logout: () => void;
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
    if (email === "coach.martin@veiss.com" && password === "teamveiss") {
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

  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);
    localStorage.removeItem("veiss-auth");
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout, user }}>
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
