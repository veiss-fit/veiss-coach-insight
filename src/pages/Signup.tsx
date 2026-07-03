import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Validators } from "@/lib/validators";
import { Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";
import veissLogo from "@/assets/veiss-logo.png";

const Signup = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    const fullNameError = Validators.fullName(fullName);
    if (fullNameError) {
      toast.error(fullNameError);
      return;
    }

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

    const confirmError = Validators.passwordConfirm(password, confirmPassword);
    if (confirmError) {
      toast.error(confirmError);
      return;
    }

    setLoading(true);
    
    try {
      const result = await signup(email, password, fullName);
      if (result.success && result.needsConfirmation) {
        setEmailSent(true);
      } else if (result.success) {
        toast.success("Account created! Redirecting...");
        setTimeout(() => navigate("/"), 1500);
      } else {
        toast.error(result.error || "Failed to create account. Please try again.");
      }
    } catch (error) {
      toast.error("An error occurred during signup.");
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #071c32 0%, #205783 100%)' }}
      >
        <div className="bg-white rounded-2xl p-10 max-w-md w-full text-center shadow-2xl">
          <img src={veissLogo} alt="Veiss" className="h-8 mx-auto mb-6" />
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: '#fff4cc' }}
          >
            <Mail className="h-8 w-8" style={{ color: '#f5b400' }} />
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: '#071c32' }}>
            Check your email
          </h2>
          <p className="text-sm mb-6" style={{ color: '#5b6577' }}>
            We sent a confirmation link to{' '}
            <strong style={{ color: '#071c32' }}>{email}</strong>.
            Click the link to activate your account and get started.
          </p>
          <p className="text-xs" style={{ color: '#8d95a4' }}>
            Didn't receive it? Check your spam folder or{' '}
            <button
              className="underline font-medium"
              style={{ color: '#205783' }}
              onClick={async () => {
                await supabase.auth.resend({ type: 'signup', email });
                toast.success('Confirmation email resent');
              }}
            >
              resend the email
            </button>
          </p>
        </div>
      </div>
    );
  }

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
          <CardTitle className="text-3xl font-bold text-foreground">Create Account</CardTitle>
          <CardDescription className="text-muted-foreground">
            Sign up to access VEISS Dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Enter your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="bg-background border-border"
              />
            </div>
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
                placeholder="Create a password (min 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-background border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="bg-background border-border"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full bg-gold text-navy-dark hover:bg-gold/90 font-semibold"
              disabled={loading}
            >
              {loading ? "Creating Account..." : "Sign Up"}
            </Button>
            <div className="space-y-2 text-center text-sm text-muted-foreground">
              <div>
                Already have an account?{" "}
                <Link to="/login" className="text-gold hover:text-gold/80 font-medium">
                  Sign In
                </Link>
              </div>
              <div>
                <Link to="/forgot-password" className="text-gold hover:text-gold/80 font-medium">
                  Forgot Password?
                </Link>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Signup;
