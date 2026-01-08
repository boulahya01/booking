import { supabase } from './supabaseClient'
import type { Profile } from '../types/database'

export interface AuthResponse {
    data?: any
    error?: { message: string }
}

/**
 * Register a new user with email, password, student ID, and full name
 * User status starts as 'pending' until admin approves
 * User can login immediately after registration but cannot book
 *
 * NOTE: Profile creation is handled by a database trigger (on_auth_user_created)
 * when the auth user is created. The client should NOT attempt to create profiles.
 */
export async function register(
    email: string,
    password: string,
    studentId: string,
    fullName: string
): Promise<AuthResponse> {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { student_id: studentId, full_name: fullName },
        },
    })

    if (error) {
        console.error('[register] supabase.auth.signUp error:', error)
    }

    return { data, error: error ? { message: error.message } : undefined }
}

/**
 * Login with email and password
 * Allows all users to login (pending, approved, rejected, suspended)
 * Booking restrictions are enforced at the database level via RLS
 */
export async function loginWithEmail(
    email: string,
    password: string
): Promise<AuthResponse> {
    try {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        console.log('[loginWithEmail] signInWithPassword result:', { data, signInError })

        // Check session after sign-in
        try {
            const sessionRes = await supabase.auth.getSession()
            console.log('[loginWithEmail] supabase.auth.getSession():', sessionRes)
        } catch (e) {
            console.error('[loginWithEmail] error getting session after sign-in', e)
        }
        if (signInError) {
            return { error: { message: signInError.message } }
        }

        if (!data.user) {
            return { error: { message: 'Login failed' } }
        }

        // Fetch user profile to include in response
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single()

        if (profileError || !profile) {
            await supabase.auth.signOut()
            return { error: { message: 'Profile not found' } }
        }

        // Allow login for any user (pending, approved, or other status)
        // Booking restrictions are enforced by RLS policy and UI
        return { data }
    } catch (err: any) {
        return { error: { message: err.message || 'Login failed' } }
    }
}

/**
 * Get user's profile data
 */
export async function getUserProfile(userId: string): Promise<Profile | null> {
    try {
        console.log('[getUserProfile] Starting query for user:', userId)

        const { data, error, status } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single()
        console.log('[getUserProfile] Query result:', { status, hasError: !!error, hasData: !!data })

        if (error) {
            console.error('[getUserProfile] Error details:', {
                message: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint
            })
            // Propagate DB/auth errors so callers can respond (e.g., surface RLS issues)
            throw new Error(error.message || 'Error fetching profile')
        }

        if (!data) {
            console.error('[getUserProfile] No data returned (null result)')
            return null
        }

        console.log('[getUserProfile] Success:', {
            id: data.id,
            role: data.role,
            status: data.status,
            student_id: data.student_id
        })
        return data
    } catch (err: any) {
        console.error('[getUserProfile] Exception:', {
            message: err.message,
            stack: err.stack
        })
        // Re-throw so callers may detect and handle appropriately
        throw err
    }
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<{ error?: any }> {
    const { error } = await supabase.auth.signOut()
    return { error }
}
