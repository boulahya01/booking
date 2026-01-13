import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { useTranslation } from 'react-i18next'
import type { Booking } from '../types/database'
import { FiClock, FiX } from 'react-icons/fi'
import Loading from '../components/Loading'
import '../styles/Bookings.css'

export function Bookings() {
  const { t, i18n } = useTranslation()
  const { user, isApproved } = useAuth()
  const toast = useToast()
  const [myBookings, setMyBookings] = useState<(Booking & { pitch_name?: string; pitch_location?: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    console.log('[Bookings] Page loaded - isApproved:', isApproved)
    if (user && isApproved) {
      console.log('[Bookings] Loading my bookings...')
      fetchMyBookings()
    } else {
      setLoading(false)
    }
  }, [user, isApproved])

  const fetchMyBookings = async () => {
    try {
      if (!user) return

      console.log('[Bookings] Fetching bookings for user:', user.id)
      const { data, error: fetchError } = await supabase
        .from('bookings')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('slot_datetime', { ascending: true })

      if (fetchError) throw fetchError
      
      // Fetch pitch data for each booking
      const bookingsWithPitches = await Promise.all(
        (data || []).map(async (booking) => {
          const { data: pitchData, error: pitchError } = await supabase
            .from('pitches')
            .select('id, name, location')
            .eq('id', booking.pitch_id)
            .maybeSingle()
          
          return {
            ...booking,
            pitch_name: pitchError ? 'Unknown' : pitchData?.name || 'Unknown',
            pitch_location: pitchError ? 'Unknown' : pitchData?.location || 'Unknown',
          }
        })
      )
      
      console.log('[Bookings] Fetched bookings with pitches:', bookingsWithPitches.length)
      setMyBookings(bookingsWithPitches)
    } catch (err: any) {
      console.error('[Bookings] Error:', err)
      toast.error(err.message || 'Failed to fetch bookings')
      setMyBookings([])
    } finally {
      setLoading(false)
    }
  }

  const handleCancelBooking = async (bookingId: string) => {
    try {
      setActionLoading(bookingId)
      console.log('[Bookings] Cancelling booking:', bookingId)

      const { error: cancelError } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', bookingId)

      if (cancelError) throw cancelError

      await fetchMyBookings()
      toast.success(t('bookings.cancelled_success'))
    } catch (err: any) {
      console.error('[Bookings] Error:', err)
      toast.error(err.message || t('bookings.failed_cancel'))
    } finally {
      setActionLoading(null)
    }
  }

  const formatDateTime = (dateString?: string | null) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-GB'
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', numberingSystem: 'latn' }).format(date)
  }

  if (!isApproved) {
    return (
      <div className="bookings-container">
        <div className="alert alert-warning">
          <h3><FiClock style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} /> {t('bookings.pending_approval')}</h3>
          <p>{t('bookings.approval_message')}</p>
          <p>
            <strong>{t('bookings.what_next')}</strong> {t('bookings.approval_timeframe')}
          </p>
          <p className="approval-note">{t('bookings.approval_note')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bookings-container">
      <h1><FiClock style={{ display: 'inline', marginRight: '12px', verticalAlign: 'middle' }} /> {t('bookings.title')}</h1>

      {loading ? (
        <Loading />
      ) : myBookings.length === 0 ? (
        <div className="alert alert-info">
          <p>
            {t('bookings.no_bookings')} <Link to="/">{t('bookings.go_home')}</Link>
          </p>
        </div>
      ) : (
        <div className="bookings-grid">
          <p className="bookings-count">
            {t('bookings.booking_count', { count: myBookings.length })}
          </p>
          <div className="bookings-list">
            {myBookings.map((booking) => (
              <div key={booking.id} className="booking-card">
                <div className="booking-card-header">
                  <div className="booking-pitch-name">{booking.pitch_name}</div>
                  <div className="booking-pitch-location">
                    <span>📍</span> {booking.pitch_location}
                  </div>
                </div>
                <div className="booking-card-content">
                  <div className="booking-slot-time">
                    <span className="label">{t('bookings.slot_time_label')}</span>{' '}
                    {formatDateTime(booking.slot_datetime)}
                  </div>
                  <div className="booking-date">
                    <span className="label">{t('bookings.booked_label')}</span> {formatDateTime(booking.created_at)}
                  </div>
                  <div className="booking-status">
                    <span className="status-badge">{t('bookings.status_active')}</span>
                  </div>
                </div>
                <button
                  className="btn-cancel"
                  onClick={() => handleCancelBooking(booking.id)}
                  disabled={actionLoading === booking.id}
                >
                  <FiX style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                  {actionLoading === booking.id ? t('bookings.cancelling') : t('bookings.cancel_booking')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default Bookings
