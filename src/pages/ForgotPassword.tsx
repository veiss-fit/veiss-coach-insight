import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import veissLogo from '@/assets/veiss-logo.png';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setEmailSent(true);
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
            <span style={{ fontSize: 32 }}>✉️</span>
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: '#071c32' }}>
            Check your email
          </h2>
          <p className="text-sm mb-6" style={{ color: '#5b6577' }}>
            We sent a password reset link to{' '}
            <strong style={{ color: '#071c32' }}>{email}</strong>.
            Click the link to choose a new password.
          </p>
          <p className="text-xs mb-4" style={{ color: '#8d95a4' }}>
            Didn't receive it? Check your spam folder or{' '}
            <button
              className="underline font-medium"
              style={{ color: '#205783' }}
              onClick={() => setEmailSent(false)}
            >
              try again
            </button>
          </p>
          <Button variant="outline" className="w-full" onClick={() => navigate('/login')}>
            Back to login
          </Button>
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
          Forgot your password?
        </h2>
        <p className="text-sm text-center mb-8" style={{ color: '#5b6577' }}>
          Enter your email and we'll send you a reset link.
        </p>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label htmlFor="email" style={{ color: '#071c32', fontWeight: 600 }}>
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
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
            {loading ? 'Sending...' : 'Send reset link'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            style={{ color: '#5b6577' }}
            onClick={() => navigate('/login')}
          >
            Back to login
          </Button>
        </form>
      </div>
    </div>
  );
}
