import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
	throw new Error('Missing Supabase environment variables. Please check your .env.local file.')
}

// Create Supabase client with TypeScript support
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
	auth: {
		autoRefreshToken: true,
		persistSession: true,
		detectSessionInUrl: true,
	},
})

// Helper function to get current user
export const getCurrentUser = async () => {
	const {
		data: { user },
		error,
	} = await supabase.auth.getUser()

	if (error) {
		console.error('Error getting current user:', error)
		return null
	}

	return user
}

// Helper function to get user profile with role (for coaches)
export const getUserProfile = async (userId: string) => {
	try {
		console.log('getUserProfile: Fetching profile for userId:', userId)

		// Create a timeout promise
		const timeoutPromise = new Promise((_, reject) =>
			setTimeout(() => reject(new Error('getUserProfile timeout after 8 seconds')), 8000)
		)

		// Race between profile fetch and timeout
		const profileResult = (await Promise.race([
			supabase.from('profiles').select('*').eq('id', userId).single(),
			timeoutPromise,
		])) as any

		// If timeout won, profileResult will be an error
		if (profileResult instanceof Error) {
			throw profileResult
		}

		const { data: profile, error: profileError } = profileResult

		if (profileError) {
			console.error('Error getting user profile:', profileError)
			throw profileError
		}

		if (!profile) {
			console.warn('No profile found for userId:', userId)
			return null
		}

		console.log('getUserProfile: Profile found:', {
			id: profile.id,
			role: profile.role,
			coach_id: profile.coach_id,
		})

		// If role is coach, get coach data
		if (profile.role === 'coach') {
			if (profile.coach_id) {
				console.log('getUserProfile: Fetching coach data for coach_id:', profile.coach_id)

				// Add timeout for coach data fetch too
				const coachTimeoutPromise = new Promise((_, reject) =>
					setTimeout(() => reject(new Error('getCoachData timeout after 8 seconds')), 8000)
				)

				try {
					// team_id is now an array of every group the coach owns (kept in sync by a
					// DB trigger), so there's no longer a single-row FK to embed here.
					const coachResult = (await Promise.race([
						supabase.from('coaches').select('*').eq('id', profile.coach_id).single(),
						coachTimeoutPromise,
					])) as any

					if (coachResult instanceof Error) {
						throw coachResult
					}

					const { data: coach, error: coachError } = coachResult

					if (coachError) {
						console.error('Error getting coach data:', coachError)
						// Don't throw - return profile without coach data
					} else if (coach) {
						console.log('getUserProfile: Coach data loaded:', {
							id: coach.id,
							team_id: coach.team_id,
						})
						profile.coach = coach
					} else {
						console.warn('No coach record found for coach_id:', profile.coach_id)
					}
				} catch (timeoutError) {
					console.error('Timeout fetching coach data:', timeoutError)
					// Continue without coach data
				}
			} else {
				console.warn('Profile has coach role but no coach_id set')
			}
		}

		return profile
	} catch (error) {
		console.error('getUserProfile exception:', error)
		throw error
	}
}

// Helper function to sign out
export const signOut = async () => {
	const { error } = await supabase.auth.signOut()
	if (error) {
		console.error('Error signing out:', error)
		throw error
	}
}

// Helper function to request password reset
export const resetPassword = async (email: string) => {
	try {
		const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
			redirectTo: `${window.location.origin}/auth/reset-password`,
		})

		if (error) {
			console.error('Error requesting password reset:', error)
			return { success: false, error: error.message }
		}

		console.log('Password reset email sent to:', email)
		return { success: true, data }
	} catch (error: any) {
		console.error('Password reset exception:', error)
		return { success: false, error: error.message || 'An error occurred while requesting password reset' }
	}
}

// Helper function to update password with recovery token
export const updatePassword = async (newPassword: string) => {
	try {
		const { data, error } = await supabase.auth.updateUser({
			password: newPassword,
		})

		if (error) {
			console.error('Error updating password:', error)
			return { success: false, error: error.message }
		}

		console.log('Password updated successfully')
		return { success: true, data }
	} catch (error: any) {
		console.error('Update password exception:', error)
		return { success: false, error: error.message || 'An error occurred while updating password' }
	}
}
