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
					const coachResult = (await Promise.race([
						supabase.from('coaches').select('*, teams(*)').eq('id', profile.coach_id).single(),
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

// // Helper function to get user profile with role (for coaches)
// export const getUserProfile = async (userId: string) => {
// 	try {
// 		console.log('🔵 getUserProfile: START - Fetching profile for userId:', userId)

// 		// Test the connection first
// 		console.log('🔵 getUserProfile: Executing profiles query...')
// 		const profileQuery = supabase.from('profiles').select('*').eq('id', userId).single()

// 		console.log('🔵 getUserProfile: Query created, awaiting result...')
// 		const { data: profile, error: profileError } = await profileQuery
// 		console.log('🟢 getUserProfile: Query completed!', {
// 			hasData: !!profile,
// 			hasError: !!profileError,
// 		})

// 		if (profileError) {
// 			console.error('🔴 getUserProfile: Error getting user profile:', profileError)
// 			throw profileError
// 		}

// 		if (!profile) {
// 			console.warn('⚠️ getUserProfile: No profile found for userId:', userId)
// 			return null
// 		}

// 		console.log('✅ getUserProfile: Profile found:', {
// 			id: (profile as any).id,
// 			role: (profile as any).role,
// 			coach_id: (profile as any).coach_id,
// 		})

// 		// If role is coach, get coach data
// 		if (profile.role === 'coach') {
// 			if (profile.coach_id) {
// 				console.log('🔵 getUserProfile: Fetching coach data for coach_id:', profile.coach_id)

// 				try {
// 					const { data: coach, error: coachError } = await supabase
// 						.from('coaches')
// 						.select('*, teams(*)')
// 						.eq('id', profile.coach_id)
// 						.single()

// 					console.log('🟢 getUserProfile: Coach query completed', {
// 						hasCoach: !!coach,
// 						hasError: !!coachError,
// 					})

// 					if (coachError) {
// 						console.error('🔴 getUserProfile: Error getting coach data:', coachError)
// 						// Don't throw - return profile without coach data
// 					} else if (coach) {
// 						console.log('✅ getUserProfile: Coach data loaded:', {
// 							id: coach.id,
// 							team_id: coach.team_id,
// 						})
// 						profile.coach = coach
// 					} else {
// 						console.warn(
// 							'⚠️ getUserProfile: No coach record found for coach_id:',
// 							profile.coach_id
// 						)
// 					}
// 				} catch (coachError) {
// 					console.error('🔴 getUserProfile: Exception fetching coach data:', coachError)
// 					// Continue without coach data - don't fail the whole profile load
// 				}
// 			} else {
// 				console.warn('⚠️ getUserProfile: Profile has coach role but no coach_id set')
// 			}
// 		}

// 		console.log('✅ getUserProfile: COMPLETE - Returning profile')
// 		return profile
// 	} catch (error) {
// 		console.error('🔴 getUserProfile: EXCEPTION:', error)
// 		throw error
// 	}
// }

// Helper function to sign out
export const signOut = async () => {
	const { error } = await supabase.auth.signOut()
	if (error) {
		console.error('Error signing out:', error)
		throw error
	}
}
