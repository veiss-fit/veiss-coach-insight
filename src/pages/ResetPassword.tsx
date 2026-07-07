import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import veissLogo from '@/assets/veiss-logo.png';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      navigate('/login?message=password_updated');
    }
  };

  if (!ready) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #071c32 0%, #205783 100%)' }}
      >
        <div className="bg-white rounded-2xl p-10 max-w-md w-full text-center shadow-2xl">
          <div
            className="w-8 h-8 border-2 rounded-full animate-spin mx-auto mb-4"
            style={{ borderColor: '#f5b400', borderTopColor: 'transparent' }}
          />
          <p className="text-sm font-medium" style={{ color: '#071c32' }}>
            Verifying your reset link...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #071c32 0%, #205783 100%)' }}
    >
      <div className="bg-white rounded-2xl p-10 max-w-md w-full shadow-2xl">
        <img src={veissLogo} alt="Veiss" className="h-8 mx-auto mb-8 block" />
        <h2 className="text-2xl font-bold mb-1 text-center" style={{ color: '#071c32' }}>
          Choose a new password
        </h2>
        <p className="text-sm text-center mb-8" style={{ color: '#5b6577' }}>
          Make it strong — at least 8 characters.
        </p>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label htmlFor="password" style={{ color: '#071c32', fontWeight: 600 }}>
              New Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="confirmPassword" style={{ color: '#071c32', fontWeight: 600 }}>
              Confirm Password
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              className="mt-1"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button
            type="submit"
            className="w-full h-12 text-base font-bold"
            style={{ backgroundColor: '#f5b400', color: '#6b4d00' }}
            disabled={loading}
          >
            {loading ? 'Updating...' : 'Update password'}
          </Button>
        </form>
      </div>
    </div>
  );
}
