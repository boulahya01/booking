// OTP password-reset helpers removed.
// The project now uses Supabase's built-in recovery emails (ConfirmationURL).
// These functions intentionally throw to surface any accidental usage.

export function requestOtpReset(): never {
    throw new Error('OTP password reset is disabled. Use Supabase recovery emails instead.')
}

export function verifyOtpReset(): never {
    throw new Error('OTP password reset is disabled. Use Supabase recovery emails instead.')
}
