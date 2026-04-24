import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

// OTP-based password reset has been removed. If this route is hit, redirect
// users to the Forgot Password page so they can request a Supabase recovery link.
export function VerifyOtp() {
  const navigate = useNavigate()
  useEffect(() => {
    navigate('/forgot-password', { replace: true })
  }, [navigate])
  return null
}
