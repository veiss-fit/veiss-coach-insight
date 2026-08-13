import { supabase } from '@/lib/supabase'

/**
 * Idempotent coach account setup.
 *
 * A coach account is four rows/links that must all exist:
 *   1. profiles row with role 'coach'
 *   2. coaches row for this auth user
 *   3. at least one group owned by that coach
 *   4. profiles.coach_id pointing at the coaches row
 *
 * These were previously written inline in two places — AuthContext.signup (the
 * immediate-session path) and AuthCallback (the email-confirmation path) — which
 * drifted apart and produced AUDIT_FINDINGS.md §2.2, where the callback path linked
 * everything to the auth uid instead of the real coaches.id. Both now call this, so
 * they cannot diverge again.
 *
 * Every step is safe to re-run: it checks before inserting and never assumes a
 * clean slate. That is what lets a signup retry resume a half-finished account
 * instead of failing with a bare "already registered" (§1.2).
 */

export interface CoachSetupResult {
  ok: boolean
  /** Set when setup could not be completed; safe to surface to the user. */
  error?: string
  /** The coaches.id for this user, once known. */
  coachId?: string
}

export const ensureCoachSetup = async (
  userId: string,
  fullName: string,
  email: string
): Promise<CoachSetupResult> => {
  try {
    // 1. Profile must exist and carry role 'coach'. Upsert because handle_new_user
    //    may have already created it (possibly with a different role).
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: userId,
          full_name: fullName,
          role: 'coach' as const,
          email,
          created_at: new Date().toISOString(),
        } as never,
        { onConflict: 'id' }
      )

    if (profileError) {
      console.error('[ensureCoachSetup] profile upsert failed:', profileError)
      return { ok: false, error: 'Account created but failed to initialize profile' }
    }

    // 2. Coaches row — reuse if present, otherwise create.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingCoach } = await (supabase as any)
      .from('coaches')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle() as { data: { id: string } | null }

    let coachId = existingCoach?.id ?? null

    if (!coachId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: created, error: coachError } = await (supabase as any)
        .from('coaches')
        .insert({ full_name: fullName, email, user_id: userId })
        .select('id')
        .single() as { data: { id: string } | null; error: unknown }

      if (coachError || !created) {
        console.error('[ensureCoachSetup] coaches insert failed:', coachError)
        return { ok: false, error: 'Account created but failed to set up your coach profile' }
      }
      coachId = created.id
    }

    // 3. Default group — only when this coach has none at all, so a coach who has
    //    since deleted or renamed their groups does not get a surprise new one.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingGroups } = await (supabase as any)
      .from('groups')
      .select('id')
      .eq('coach_id', coachId)
      .limit(1) as { data: Array<{ id: string }> | null }

    if (!existingGroups || existingGroups.length === 0) {
      // Non-fatal: an account with no default group is usable (the coach can create
      // one), so a failure here must not block them from reaching the dashboard.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: groupError } = await (supabase as any)
        .from('groups')
        .insert({ name: `${fullName}'s Group`, coach_id: coachId })

      if (groupError) {
        console.error('[ensureCoachSetup] default group insert failed:', groupError)
      }
    }

    // 4. Link profile -> coaches.id (NOT the auth uid; see §2.2).
    const { error: linkError } = await supabase
      .from('profiles')
      .update({ coach_id: coachId } as never)
      .eq('id', userId)

    if (linkError) {
      console.error('[ensureCoachSetup] profile->coach link failed:', linkError)
      return { ok: false, error: 'Account created but failed to finish linking your profile' }
    }

    return { ok: true, coachId }
  } catch (error) {
    console.error('[ensureCoachSetup] unexpected failure:', error)
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to finish setting up your account',
    }
  }
}

/**
 * True when Supabase rejected a sign-up because the email already has an account.
 * Wording varies by project settings, so match on code and message.
 */
export const isAlreadyRegistered = (error: {
  message?: string
  code?: string
  status?: number
}): boolean =>
  error?.code === 'user_already_exists' ||
  /already registered|already exists|already been registered/i.test(error?.message ?? '')
