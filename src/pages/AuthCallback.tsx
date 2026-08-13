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
          // coaches.id is DB-generated here (unlike the immediate-session path in
          // AuthContext.signup, which pins id = userId), so it does NOT equal userId.
          // Everything downstream must key off the real row id: groups.coach_id and
          // profiles.coach_id are both resolved against coaches.id elsewhere
          // (getCoachId/getCoachTeamIds, TeamSportManager.loadTeams, getUserProfile).
          // Writing userId here produced a default group and a profile link that no
          // lookup could ever match — a silently invisible group on every account
          // created through the email-confirmation flow.
          const coachId = (coachData as { id: string }).id;

          // Step 3: Create default group
          await (supabase as any)
            .from('groups')
            .insert({ name: `${fullName}'s Group`, coach_id: coachId });

          // Step 4: Link profile → coach record
          await supabase
            .from('profiles')
            .update({ coach_id: coachId } as any)
            .eq('id', userId);
        }
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
