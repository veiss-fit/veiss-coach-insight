import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Validators } from "@/lib/validators";
import veissLogo from "@/assets/veiss-logo.png";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'confirmation_failed') {
      toast.error('Email confirmation failed. Please try signing up again.');
    }
    if (params.get('message') === 'password_updated') {
      toast.success('Password updated successfully. Please log in.');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    const emailError = Validators.email(email);
    if (emailError) {
      toast.error(emailError);
      return;
    }

    const passwordError = Validators.password(password);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }

    setLoading(true);
    
    try {
      const result = await login(email, password);
      if (result.success) {
        toast.success("Welcome back!");
        navigate("/");
      } else {
        toast.error(result.error || "Invalid credentials. Please try again.");
      }
    } catch (error) {
      toast.error("An error occurred during login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-dark via-navy to-navy-light flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-gold/20">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-24 h-24 relative">
            <img 
              src={veissLogo} 
              alt="Veiss Logo" 
              className="w-full h-full object-contain"
            />
          </div>
          <CardTitle className="text-3xl font-bold text-foreground">VEISS Dashboard</CardTitle>
          <CardDescription className="text-muted-foreground">
            Sign in to access your training dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-background border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-background border-border"
              />
              <div className="flex justify-end mt-1">
                <a href="/forgot-password" className="text-xs font-medium" style={{ color: '#205783' }}>
                  Forgot password?
                </a>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full bg-gold text-navy-dark hover:bg-gold/90 font-semibold"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link to="/signup" className="text-gold hover:text-gold/80 font-medium">
                Sign Up
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
