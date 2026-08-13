import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { ensureCoachSetup } from '@/lib/coachSetup';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [setupError, setSetupError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        navigate('/login?error=confirmation_failed');
        return;
      }

      const user = data.session.user;
      const userId = user.id;
      const email = user.email ?? '';
      const fullName = (user.user_metadata?.full_name as string | undefined) ?? '';

      // Full DB setup: profile (role 'coach') -> coaches row -> default group ->
      // profiles.coach_id link. This MUST complete before we hand back to
      // AuthProvider; a missing or wrong role here is what caused the
      // race-condition logout bug. Shared with AuthContext.signup so the two
      // signup paths cannot drift apart again (that divergence caused §2.2).
      const setup = await ensureCoachSetup(userId, fullName, email);

      if (!setup.ok) {
        console.error('[AuthCallback] Coach setup failed:', setup.error);
        setSetupError(setup.error ?? 'We hit a problem setting up your account. Please contact support or try again.');
        return;
      }

      // All writes are committed — hand control back to AuthProvider with a full
      // page load rather than a client-side navigate. AuthProvider deliberately
      // skips loading the profile while on this route (see the /auth/callback
      // guard in AuthContext.initialize), and no further auth event fires after an
      // in-app transition, so navigate('/') would land on the dashboard with a
      // null profile and render it empty. A real navigation re-runs initialize()
      // on '/', which reads the now fully-committed profile/coaches/groups rows.
      window.location.replace('/');
    };

    handleCallback();
  }, [navigate]);

  if (setupError) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #071c32 0%, #205783 100%)' }}
      >
        <div className="bg-white rounded-2xl p-10 max-w-md w-full text-center shadow-2xl">
          <p className="text-base font-semibold mb-2" style={{ color: '#071c32' }}>
            Account setup failed
          </p>
          <p className="text-sm mb-6" style={{ color: '#5b6577' }}>{setupError}</p>
          <button
            className="text-sm font-medium underline"
            style={{ color: '#205783' }}
            onClick={() => navigate('/login')}
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

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
          Confirming your account...
        </p>
      </div>
    </div>
  );
}
