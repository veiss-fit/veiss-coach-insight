import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

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

      // Step 1: Upsert profile — handle_new_user trigger may have already created it.
      // This MUST succeed before we navigate away; a missing/wrong role here is what
      // caused the race-condition logout bug.
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          full_name: fullName,
          role: 'coach' as const,
          email,
          created_at: new Date().toISOString(),
        } as any, { onConflict: 'id' });

      if (profileError) {
        console.error('[AuthCallback] Failed to upsert profile:', profileError);
        setSetupError('We hit a problem setting up your account. Please contact support or try again.');
        return;
      }

      // Step 2: Create coaches row only if one doesn't exist yet
      const { data: existing } = await supabase
        .from('coaches')
        .select('id')
        .eq('user_id' as any, userId)
        .maybeSingle();

      if (!existing) {
        const { data: coachData, error: coachError } = await supabase
          .from('coaches')
          .insert({ full_name: fullName, email, user_id: userId } as any)
          .select()
          .single();

        if (coachError) {
          console.error('[AuthCallback] Failed to create coaches row:', coachError);
          setSetupError('We hit a problem setting up your coach account. Please contact support or try again.');
          return;
        }

        if (coachData) {
          // Step 3: Create default group
          await (supabase as any)
            .from('groups')
            .insert({ name: `${fullName}'s Group`, sport: '', coach_id: userId });

          // Step 4: Link profile → coach record
          await supabase
            .from('profiles')
            .update({ coach_id: userId } as any)
            .eq('id', userId);
        }
      }

      // All writes settled — navigate to dashboard. onAuthStateChange will now
      // fire (or has already fired and been suppressed by the pathname guard),
      // and when loadProfile runs it will see role:'coach' correctly.
      navigate('/');
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
