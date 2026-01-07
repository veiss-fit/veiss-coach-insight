// import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
// import { User } from '@supabase/supabase-js'
// import { supabase, getUserProfile } from '@/lib/supabase'

// interface CoachProfile {
// 	id: string
// 	full_name: string | null
// 	role: 'player' | 'coach' | 'admin'
// 	coach_id: string | null
// 	coach?: {
// 		id: string
// 		full_name: string
// 		email: string | null
// 		team_id: string
// 		teams?: {
// 			id: string
// 			name: string
// 			sport: string
// 		}
// 	}
// }

// interface AuthContextType {
// 	isAuthenticated: boolean
// 	user: User | null
// 	profile: CoachProfile | null
// 	login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
// 	logout: () => Promise<void>
// 	loading: boolean
// }

// const AuthContext = createContext<AuthContextType | undefined>(undefined)

// export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
// 	const [user, setUser] = useState<User | null>(null)
// 	const [profile, setProfile] = useState<CoachProfile | null>(null)
// 	const [loading, setLoading] = useState(true)
// 	const loadingProfileRef = useRef(false)
// 	const profileLoadPromiseRef = useRef<Promise<void> | null>(null)
// 	const initializingRef = useRef(false)

// 	// Check for existing session on mount
// 	useEffect(() => {
// 		let mounted = true

// 		const initialize = async () => {
// 			if (initializingRef.current) {
// 				console.log('⚠️ [initialize] Already initializing, skipping')
// 				return
// 			}

// 			initializingRef.current = true

// 			try {
// 				console.log('🚀 [initialize] Starting auth initialization...')
// 				const {
// 					data: { session },
// 					error: sessionError,
// 				} = await supabase.auth.getSession()

// 				if (!mounted) {
// 					console.log('⚠️ [initialize] Component unmounted, aborting')
// 					return
// 				}

// 				if (sessionError) {
// 					console.error('🔴 [initialize] Error getting session:', sessionError)
// 					setLoading(false)
// 					return
// 				}

// 				if (session?.user) {
// 					console.log('✅ [initialize] Session found for user:', session.user.id)
// 					setUser(session.user)
// 					await loadProfile(session.user.id)
// 				} else {
// 					console.log('ℹ️ [initialize] No existing session found')
// 					setUser(null)
// 					setProfile(null)
// 				}
// 			} catch (error) {
// 				console.error('🔴 [initialize] Error initializing auth:', error)
// 				if (mounted) {
// 					setUser(null)
// 					setProfile(null)
// 				}
// 			} finally {
// 				if (mounted) {
// 					console.log('✅ [initialize] Auth initialization complete, setting loading to false')
// 					setLoading(false)
// 					initializingRef.current = false
// 				}
// 			}
// 		}

// 		initialize()

// 		// Listen for auth state changes
// 		const {
// 			data: { subscription },
// 		} = supabase.auth.onAuthStateChange(async (event, session) => {
// 			if (!mounted) return

// 			console.log('🔔 Auth state changed:', event, 'Session:', !!session)

// 			// IMPORTANT: Skip if we're still initializing to avoid race condition
// 			if (initializingRef.current) {
// 				console.log('⚠️ [onAuthStateChange] Still initializing, skipping this event')
// 				return
// 			}

// 			// Handle sign out
// 			if (event === 'SIGNED_OUT') {
// 				setUser(null)
// 				setProfile(null)
// 				setLoading(false)
// 				return
// 			}

// 			// Handle sign in or token refresh
// 			if (session?.user) {
// 				// Only reload if user actually changed or we don't have a profile
// 				const userChanged = !user || user.id !== session.user.id
// 				const needsProfile = !profile

// 				if (userChanged || needsProfile) {
// 					console.log('🔄 [onAuthStateChange] User changed or missing profile, reloading...', {
// 						userChanged,
// 						needsProfile,
// 					})
// 					setUser(session.user)
// 					setLoading(true)
// 					try {
// 						await loadProfile(session.user.id)
// 					} catch (error) {
// 						console.error('🔴 [onAuthStateChange] Error loading profile:', error)
// 					} finally {
// 						if (mounted) {
// 							setLoading(false)
// 						}
// 					}
// 				} else {
// 					console.log(
// 						'ℹ️ [onAuthStateChange] User unchanged and profile exists, skipping reload'
// 					)
// 				}
// 			} else {
// 				setUser(null)
// 				setProfile(null)
// 				setLoading(false)
// 			}
// 		})

// 		return () => {
// 			mounted = false
// 			subscription.unsubscribe()
// 		}
// 	}, [])

// 	const loadProfile = async (userId: string): Promise<void> => {
// 		// If already loading this user's profile, wait for that to complete
// 		if (loadingProfileRef.current && profileLoadPromiseRef.current) {
// 			console.log('⏳ [loadProfile] Already loading, returning existing promise')
// 			return profileLoadPromiseRef.current
// 		}

// 		loadingProfileRef.current = true

// 		profileLoadPromiseRef.current = (async () => {
// 			try {
// 				console.log('🔵 [loadProfile] Starting for userId:', userId)
// 				const profileData = await getUserProfile(userId)

// 				console.log('🟢 [loadProfile] Data received:', !!profileData)

// 				if (profileData) {
// 					if (profileData.role !== 'coach') {
// 						console.error('🔴 [loadProfile] Not a coach, role:', profileData.role)
// 						await logout()
// 						throw new Error('User is not a coach')
// 					}
// 					console.log('✅ [loadProfile] Setting profile')
// 					setProfile(profileData as CoachProfile)
// 				} else {
// 					console.warn('⚠️ [loadProfile] No profile data')
// 					setProfile(null)
// 				}
// 			} catch (error) {
// 				console.error('🔴 [loadProfile] Error:', error)
// 				setProfile(null)
// 				throw error
// 			} finally {
// 				loadingProfileRef.current = false
// 				profileLoadPromiseRef.current = null
// 				console.log('✅ [loadProfile] Complete')
// 			}
// 		})()

// 		return profileLoadPromiseRef.current
// 	}

// 	const login = async (email: string, password: string) => {
// 		try {
// 			setLoading(true)
// 			const { data, error } = await supabase.auth.signInWithPassword({
// 				email,
// 				password,
// 			})

// 			if (error) {
// 				console.error('Login error:', error)
// 				return { success: false, error: error.message }
// 			}

// 			if (data.user) {
// 				setUser(data.user)
// 				await loadProfile(data.user.id)

// 				// Profile is now loaded, check if user is a coach
// 				// Wait a bit for state to update
// 				await new Promise((resolve) => setTimeout(resolve, 100))

// 				// Re-fetch to verify
// 				const profileData = await getUserProfile(data.user.id)
// 				if (profileData?.role !== 'coach') {
// 					await logout()
// 					return {
// 						success: false,
// 						error: 'Access denied. This dashboard is for coaches only.',
// 					}
// 				}

// 				return { success: true }
// 			}

// 			return { success: false, error: 'Login failed' }
// 		} catch (error: any) {
// 			console.error('Login exception:', error)
// 			return { success: false, error: error.message || 'An error occurred during login' }
// 		} finally {
// 			setLoading(false)
// 		}
// 	}

// 	const logout = async () => {
// 		try {
// 			await supabase.auth.signOut()
// 			setUser(null)
// 			setProfile(null)
// 		} catch (error) {
// 			console.error('Error signing out:', error)
// 		}
// 	}

// 	const isAuthenticated = !!user && !!profile && profile.role === 'coach'

// 	return (
// 		<AuthContext.Provider value={{ isAuthenticated, user, profile, login, logout, loading }}>
// 			{children}
// 		</AuthContext.Provider>
// 	)
// }

// export const useAuth = () => {
// 	const context = useContext(AuthContext)
// 	if (!context) {
// 		throw new Error('useAuth must be used within AuthProvider')
// 	}
// 	return context
// }

import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase, getUserProfile } from '@/lib/supabase'

interface CoachProfile {
	id: string
	full_name: string | null
	role: 'player' | 'coach' | 'admin'
	coach_id: string | null
	coach?: {
		id: string
		full_name: string
		email: string | null
		team_id: string
		teams?: {
			id: string
			name: string
			sport: string
		}
	}
}

interface AuthContextType {
	isAuthenticated: boolean
	user: User | null
	profile: CoachProfile | null
	login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
	signup: (email: string, password: string, fullName: string) => Promise<{ success: boolean; error?: string }>
	logout: () => Promise<void>
	loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
	const [user, setUser] = useState<User | null>(null)
	const [profile, setProfile] = useState<CoachProfile | null>(null)
	const [loading, setLoading] = useState(true)
	const loadingProfileRef = useRef(false)
	const profileLoadPromiseRef = useRef<Promise<void> | null>(null)
	const initializingRef = useRef(false)
	const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

	// Refs to avoid stale closures
	const userRef = useRef<User | null>(null)
	const profileRef = useRef<CoachProfile | null>(null)

	// Update refs whenever state changes
	useEffect(() => {
		userRef.current = user
		profileRef.current = profile
	}, [user, profile])

	// Safety mechanism to prevent stuck loading
	const ensureLoadingEnds = () => {
		if (loadingTimeoutRef.current) {
			clearTimeout(loadingTimeoutRef.current)
		}

		loadingTimeoutRef.current = setTimeout(() => {
			console.warn('⚠️ [ensureLoadingEnds] Loading stuck for 15s, forcing to false')
			setLoading(false)
			loadingProfileRef.current = false
			profileLoadPromiseRef.current = null
		}, 15000)
	}

	// Check for existing session on mount
	useEffect(() => {
		let mounted = true

		const initialize = async () => {
			if (initializingRef.current) {
				console.log('⚠️ [initialize] Already initializing, skipping')
				return
			}

			initializingRef.current = true
			ensureLoadingEnds()

			try {
				console.log('🚀 [initialize] Starting auth initialization...')
				const {
					data: { session },
					error: sessionError,
				} = await supabase.auth.getSession()

				if (!mounted) {
					console.log('⚠️ [initialize] Component unmounted, aborting')
					return
				}

				if (sessionError) {
					console.error('🔴 [initialize] Error getting session:', sessionError)
					setLoading(false)
					if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current)
					return
				}

				if (session?.user) {
					console.log('✅ [initialize] Session found for user:', session.user.id)
					setUser(session.user)
					await loadProfile(session.user.id)
				} else {
					console.log('ℹ️ [initialize] No existing session found')
					setUser(null)
					setProfile(null)
				}
			} catch (error) {
				console.error('🔴 [initialize] Error initializing auth:', error)
				if (mounted) {
					setUser(null)
					setProfile(null)
				}
			} finally {
				if (mounted) {
					console.log('✅ [initialize] Auth initialization complete, setting loading to false')
					setLoading(false)
					initializingRef.current = false
					if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current)
				}
			}
		}

		initialize()

		// Monitor tab visibility changes
		const handleVisibilityChange = () => {
			console.log('👁️ [Visibility] Tab visibility changed:', {
				isVisible: !document.hidden,
				loading,
				hasUser: !!userRef.current,
				hasProfile: !!profileRef.current,
				userId: userRef.current?.id,
				initializingRef: initializingRef.current,
				loadingProfileRef: loadingProfileRef.current,
			})
		}

		document.addEventListener('visibilitychange', handleVisibilityChange)

		// Listen for auth state changes
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange(async (event, session) => {
			if (!mounted) return

			console.log('🔔 Auth state changed:', event, 'Session:', !!session)

			// Skip if we're still initializing
			if (initializingRef.current) {
				console.log('⚠️ [onAuthStateChange] Still initializing, skipping this event')
				return
			}

			// Handle sign out
			if (event === 'SIGNED_OUT') {
				setUser(null)
				setProfile(null)
				setLoading(false)
				if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current)
				return
			}

			// Handle token refresh - DON'T reload profile
			if (event === 'TOKEN_REFRESHED') {
				console.log(
					'🔄 [onAuthStateChange] Token refreshed, updating user but keeping profile'
				)
				if (session?.user) {
					setUser(session.user)
				}
				return
			}

			// Handle sign in or initial session
			if (session?.user) {
				// Use refs instead of state variables to avoid stale closures
				const userChanged = userRef.current?.id !== session.user.id
				const needsProfile = !profileRef.current

				if (userChanged || needsProfile) {
					console.log('🔄 [onAuthStateChange] User changed or missing profile, reloading...', {
						userChanged,
						needsProfile,
						currentUserId: userRef.current?.id,
						sessionUserId: session.user.id,
						event,
					})
					setUser(session.user)
					setLoading(true)
					ensureLoadingEnds()
					try {
						await loadProfile(session.user.id)
					} catch (error) {
						console.error('🔴 [onAuthStateChange] Error loading profile:', error)
					} finally {
						if (mounted) {
							setLoading(false)
							if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current)
						}
					}
				} else {
					console.log(
						'ℹ️ [onAuthStateChange] User unchanged and profile exists, skipping reload'
					)
				}
			} else {
				setUser(null)
				setProfile(null)
				setLoading(false)
				if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current)
			}
		})

		return () => {
			mounted = false
			subscription.unsubscribe()
			document.removeEventListener('visibilitychange', handleVisibilityChange)
			if (loadingTimeoutRef.current) {
				clearTimeout(loadingTimeoutRef.current)
			}
		}
	}, [])

	const loadProfile = async (userId: string): Promise<void> => {
		// If already loading this user's profile, wait for that to complete
		if (loadingProfileRef.current && profileLoadPromiseRef.current) {
			console.log('⏳ [loadProfile] Already loading, returning existing promise')
			return profileLoadPromiseRef.current
		}

		loadingProfileRef.current = true

		profileLoadPromiseRef.current = (async () => {
			try {
				console.log('🔵 [loadProfile] Starting for userId:', userId)
				const profileData = await getUserProfile(userId)

				console.log('🟢 [loadProfile] Data received:', !!profileData)

				if (profileData) {
					if (profileData.role !== 'coach') {
						console.error('🔴 [loadProfile] Not a coach, role:', profileData.role)
						await logout()
						throw new Error('User is not a coach')
					}
					console.log('✅ [loadProfile] Setting profile')
					setProfile(profileData as CoachProfile)
				} else {
					console.warn('⚠️ [loadProfile] No profile data')
					setProfile(null)
				}
			} catch (error) {
				console.error('🔴 [loadProfile] Error:', error)
				setProfile(null)
				throw error
			} finally {
				loadingProfileRef.current = false
				profileLoadPromiseRef.current = null
				console.log('✅ [loadProfile] Complete')
			}
		})()

		return profileLoadPromiseRef.current
	}

	const login = async (email: string, password: string) => {
		try {
			setLoading(true)
			ensureLoadingEnds()

			const { data, error } = await supabase.auth.signInWithPassword({
				email,
				password,
			})

			if (error) {
				console.error('Login error:', error)
				if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current)
				return { success: false, error: error.message }
			}

			if (data.user) {
				setUser(data.user)
				await loadProfile(data.user.id)

				// Profile is now loaded, check if user is a coach
				await new Promise((resolve) => setTimeout(resolve, 100))

				// Re-fetch to verify
				const profileData = await getUserProfile(data.user.id)
				if (profileData?.role !== 'coach') {
					await logout()
					if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current)
					return {
						success: false,
						error: 'Access denied. This dashboard is for coaches only.',
					}
				}

				if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current)
				return { success: true }
			}

			if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current)
			return { success: false, error: 'Login failed' }
		} catch (error: any) {
			console.error('Login exception:', error)
			if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current)
			return { success: false, error: error.message || 'An error occurred during login' }
		} finally {
			setLoading(false)
		}
	}

	const signup = async (email: string, password: string, fullName: string) => {
		try {
			setLoading(true)
			ensureLoadingEnds()

			// Create auth account
			const { data, error } = await supabase.auth.signUp({
				email,
				password,
				options: {
					data: {
						full_name: fullName,
					},
				},
			})

			if (error) {
				console.error('Signup error:', error)
				if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current)
				return { success: false, error: error.message }
			}

			if (data.user) {
				// Create a profile for the new user
				const { error: profileError } = await supabase
					.from('profiles')
					.insert([
						{
							id: data.user.id,
							full_name: fullName,
							role: 'coach', // Default new signups to coach role
							created_at: new Date().toISOString(),
						},
					])

				if (profileError) {
					console.error('Error creating profile:', profileError)
					if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current)
					return { success: false, error: 'Account created but failed to initialize profile' }
				}

				if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current)
				return { success: true }
			}

			if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current)
			return { success: false, error: 'Signup failed' }
		} catch (error: any) {
			console.error('Signup exception:', error)
			if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current)
			return { success: false, error: error.message || 'An error occurred during signup' }
		} finally {
			setLoading(false)
		}
	}

	const logout = async () => {
		try {
			await supabase.auth.signOut()
			setUser(null)
			setProfile(null)
			if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current)
		} catch (error) {
			console.error('Error signing out:', error)
		}
	}

	const isAuthenticated = !!user && !!profile && profile.role === 'coach'

	return (
		<AuthContext.Provider value={{ isAuthenticated, user, profile, login, signup, logout, loading }}>
			{children}
		</AuthContext.Provider>
	)
}

export const useAuth = () => {
	const context = useContext(AuthContext)
	if (!context) {
		throw new Error('useAuth must be used within AuthProvider')
	}
	return context
}
