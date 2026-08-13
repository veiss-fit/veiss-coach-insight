import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase, getUserProfile, resetPassword as supabaseResetPassword } from '@/lib/supabase'
import { ensureCoachSetup, isAlreadyRegistered } from '@/lib/coachSetup'

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
		groups?: {
			id: string
			name: string
		}
	}
}

interface AuthContextType {
	isAuthenticated: boolean
	user: User | null
	profile: CoachProfile | null
	login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
	signup: (email: string, password: string, fullName: string) => Promise<{ success: boolean; needsConfirmation?: boolean; error?: string }>
	resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>
	logout: () => Promise<void>
	refreshProfile: () => Promise<void>
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
	const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

					// AuthCallback.tsx owns the full setup sequence for users arriving via the
					// email-confirmation link (profile upsert -> coaches -> group -> coach_id link).
					// Racing it here reads whatever handle_new_user left behind before that upsert
					// commits; if role isn't yet 'coach', loadProfile force-logs-out the user and
					// hard-redirects to /login with no error shown — which is what users report as
					// "failed to create account". Same guard as the onAuthStateChange listener below.
					// AuthCallback hands control back with a full page load, which re-runs this.
					if (window.location.pathname === '/auth/callback') {
						console.log('⏭️ [initialize] On /auth/callback — deferring profile load to AuthCallback')
						return
					}

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

			// AuthCallback.tsx owns the full setup sequence for new users arriving via
			// email confirmation (profile upsert, coaches insert, group, coach_id link).
			// If we race with it and fetch the profile before the upsert commits, we'll
			// see the handle_new_user trigger's row which may not have role:'coach', and
			// the role check in loadProfile will force-logout the user mid-confirmation.
			if (window.location.pathname === '/auth/callback') {
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

				// loadProfile already enforces the coach check: on a non-coach it logs the
				// user out and throws. The previous code additionally slept 100ms and
				// re-fetched the profile to "verify" — a band-aid for the /auth/callback
				// race now fixed at its source in initialize() (§1.1), which cost every
				// login an extra round trip plus the sleep.
				try {
					await loadProfile(data.user.id)
				} catch (profileError) {
					if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current)
					const message = profileError instanceof Error ? profileError.message : ''
					if (message === 'User is not a coach') {
						return {
							success: false,
							error: 'Access denied. This dashboard is for coaches only.',
						}
					}
					return {
						success: false,
						error: 'Signed in, but your profile could not be loaded. Please try again.',
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
					emailRedirectTo: `${window.location.origin}/auth/callback`,
					data: {
						full_name: fullName,
						role: 'coach',
					},
				},
			})

			if (error) {
				// An "already registered" error is ambiguous: it may be a genuine duplicate,
				// or a retry after an earlier attempt created the auth user but died partway
				// through DB setup (there is no rollback — §1.2). Sign in with the credentials
				// just supplied; if they are valid, this is that user resuming, so finish the
				// setup idempotently instead of failing with a confusing generic message.
				if (isAlreadyRegistered(error)) {
					const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
						email,
						password,
					})

					if (!signInError && signInData?.user) {
						console.log('[signup] Account exists and credentials are valid — resuming setup')
						const setup = await ensureCoachSetup(signInData.user.id, fullName, email)
						if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current)
						if (!setup.ok) return { success: false, error: setup.error }

						setUser(signInData.user)
						await loadProfile(signInData.user.id)
						return { success: true }
					}
				}

				console.error('Signup error:', error)
				if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current)
				return { success: false, error: error.message }
			}

			if (data.user) {
				// When email confirmation is required, data.session is null and
				// auth.uid() is not yet set — DB setup runs in AuthCallback.tsx instead.
				const needsConfirmation = data.session === null;
				if (needsConfirmation) {
					if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current)
					return { success: true, needsConfirmation: true };
				}

				// Session is immediately available — run the same setup the confirmation
				// path uses, so the two cannot drift apart again (this divergence is what
				// produced §2.2).
				const setup = await ensureCoachSetup(data.user.id, fullName, email)
				if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current)
				if (!setup.ok) return { success: false, error: setup.error }

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
			// Reset all in-flight loading state before redirect
			loadingProfileRef.current = false
			profileLoadPromiseRef.current = null
			if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current)

			// Clear state immediately so nothing renders with stale data
			setUser(null)
			setProfile(null)

			await supabase.auth.signOut()
		} catch (error) {
			console.error('Error signing out:', error)
		} finally {
			// Hard redirect forces a full page reload, clearing all React state
			// and ensuring the next session starts completely fresh
			window.location.href = '/login'
		}
	}

	const refreshProfile = async () => {
		const uid = userRef.current?.id
		if (!uid) return
		const { data } = await supabase
			.from('profiles')
			.select('*')
			.eq('id', uid)
			.single()
		if (data) {
			if (data.role !== 'coach') {
				console.error('[refreshProfile] Role changed to non-coach, signing out')
				await logout()
				return
			}
			setProfile(data as CoachProfile)
		}
	}

	const resetPassword = async (email: string) => {
		try {
			const result = await supabaseResetPassword(email)
			return result
		} catch (error: any) {
			console.error('Reset password exception:', error)
			return { success: false, error: error.message || 'An error occurred during password reset' }
		}
	}

	const isAuthenticated = !!user && !!profile && profile.role === 'coach'

	return (
		<AuthContext.Provider value={{ isAuthenticated, user, profile, login, signup, resetPassword, logout, refreshProfile, loading }}>
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
