import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import type { Pitch } from '../types/database'
import '../styles/Home.css'
import { SlotCard } from '../ui'
import { FiBriefcase, FiChevronDown, FiMapPin, FiClock } from 'react-icons/fi'
import { useTranslation } from 'react-i18next'

interface VirtualSlot {
  id: string
  pitch_id: string
  pitch_name: string
  datetime_start: string
  datetime_end: string
  is_available: boolean
  booker_id?: string
  booker_name?: string
}

interface SlotWithBooker extends VirtualSlot {
  bookerName?: string
  isBookedByMe?: boolean
}

export function Home() {
  const { t, i18n } = useTranslation()
  const { user, isApproved } = useAuth()
  const toast = useToast()
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)
  const [pitches, setPitches] = useState<Pitch[]>([])
  const [selectedPitch, setSelectedPitch] = useState<string>('')
  const [showPitchMenu, setShowPitchMenu] = useState(false)
  const [slots, setSlots] = useState<SlotWithBooker[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [, setError] = useState('')

  const movePitchToTop = (id: string) => {
    setPitches((prev) => {
      const idx = prev.findIndex((p) => p.id === id)
      if (idx <= 0) return prev
      const copy = [...prev]
      const [item] = copy.splice(idx, 1)
      return [item, ...copy]
    })
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowPitchMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Manage focus when menu opens/closes and when focusedIndex changes
  useEffect(() => {
    if (showPitchMenu) {
      const start = pitches.findIndex((p) => p.id === selectedPitch)
      setFocusedIndex(start >= 0 ? start : 0)
    } else {
      setFocusedIndex(-1)
    }
  }, [showPitchMenu, pitches, selectedPitch])

  useEffect(() => {
    if (focusedIndex >= 0) {
      const el = itemRefs.current[focusedIndex]
      if (el) {
        el.focus()
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      }
    }
  }, [focusedIndex])

  const handleMenuKeyDown = (e: React.KeyboardEvent) => {
    if (!showPitchMenu) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIndex((i) => (i < 0 ? 0 : Math.min(pitches.length - 1, i + 1)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIndex((i) => (i < 0 ? 0 : Math.max(0, i - 1)))
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (focusedIndex >= 0) {
        const p = pitches[focusedIndex]
        if (p) {
          movePitchToTop(p.id)
          setSelectedPitch(p.id)
          setShowPitchMenu(false)
        }
      }
    } else if (e.key === 'Escape') {
      setShowPitchMenu(false)
    } else if (e.key.length === 1) {
      // Type-ahead: jump to first pitch starting with typed character
      const ch = e.key.toLowerCase()
      const idx = pitches.findIndex((p) => (p.name || '').toLowerCase().startsWith(ch))
      if (idx >= 0) setFocusedIndex(idx)
    }
  }

  // Load all pitches on mount and restore saved pitch from localStorage
  useEffect(() => {
    console.log('[Home] Page loaded - isApproved:', isApproved)
    if (user) {
      fetchPitches()
      // Restore previously selected pitch from localStorage
      const savedPitch = localStorage.getItem('selectedPitchId')
      if (savedPitch) {
        console.log('[Home] Restoring saved pitch from localStorage:', savedPitch)
        setSelectedPitch(savedPitch)
      }
    }
  }, [user, isApproved])

  // Persist selectedPitch to localStorage whenever it changes
  useEffect(() => {
    if (selectedPitch) {
      localStorage.setItem('selectedPitchId', selectedPitch)
      console.log('[Home] Saved pitch to localStorage:', selectedPitch)
    }
  }, [selectedPitch])

  // Update current time and refresh slots every 2 minutes
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
      // Refresh slots every 2 minutes to ensure UI always shows current available slots
      if (selectedPitch) {
        console.log('[Home] Auto-refreshing slots (time-based)...')
        fetchAvailableSlots(selectedPitch)
      }
    }, 120000) // Refresh every 120 seconds (2 minutes)
    return () => clearInterval(timer)
  }, [selectedPitch])

  // Refresh slots when page becomes visible (user switches back to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && selectedPitch) {
        console.log('[Home] Page became visible, refreshing slots...')
        fetchAvailableSlots(selectedPitch)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [selectedPitch])

  // Fetch slots when pitch changes
  useEffect(() => {
    console.log('[Home] selectedPitch changed:', selectedPitch)
    if (selectedPitch) {
      fetchAvailableSlots(selectedPitch)
    } else {
      setSlots([])
      setLoading(false)
    }
  }, [selectedPitch])

  const fetchPitches = async () => {
    try {
      console.log('[Home] Fetching all pitches...')
      const { data, error: fetchError } = await supabase
        .from('pitches')
        .select('*')
        .order('sort_order', { ascending: true })

      if (fetchError) {
        console.error('[Home] Fetch pitches error:', fetchError)
        throw fetchError
      }

      const pitchList = data || []
      console.log('[Home] Fetched pitches:', pitchList.length, pitchList)
      setPitches(pitchList)

      // Try to restore from localStorage, otherwise auto-select first pitch
      if (pitchList.length > 0) {
        const savedPitch = localStorage.getItem('selectedPitchId')
        if (savedPitch && pitchList.some(p => p.id === savedPitch)) {
          console.log('[Home] Restoring saved pitch from localStorage:', savedPitch)
          setSelectedPitch(savedPitch)
        } else if (!selectedPitch) {
          console.log('[Home] Auto-selecting first pitch:', pitchList[0].id)
          setSelectedPitch(pitchList[0].id)
        }
      }
    } catch (err: any) {
      const errMsg = 'Failed to fetch pitches'
      console.error('[Home] Error:', errMsg, err)
      toast.error(errMsg)
    }
  }

  const fetchAvailableSlots = async (pitchId: string) => {
    try {
      setLoading(true)
      console.log('[Home] Fetching available slots for pitch:', pitchId)

      // Try invoke first
      let virtualSlots: VirtualSlot[] = []
      try {
        console.log('[Home] Attempting supabase.functions.invoke()...')
        const { data, error: invokeError } = await supabase.functions.invoke('available-slots', {
          body: { pitch_id: pitchId },
        })

        if (invokeError) {
          console.warn('[Home] invoke() error:', invokeError)
        } else if (!data) {
          console.warn('[Home] invoke() returned no data, falling back')
        } else {
          console.log('[Home] Received slots via invoke():', data?.length || 0)
          virtualSlots = Array.isArray(data) ? data : []
        }
      } catch (invokeEx) {
        console.warn('[Home] invoke() threw:', invokeEx)
      }

      // Fallback
      if (!virtualSlots || virtualSlots.length === 0) {
        try {
          const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL
          const session = (await supabase.auth.getSession()).data.session
          const token = session?.access_token || ''

          if (!supabaseUrl || !token) {
            throw new Error('Missing config or token')
          }

          console.log('[Home] Using fallback fetch...')
          const resp = await fetch(`${supabaseUrl}/functions/v1/available-slots`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ pitch_id: pitchId }),
          })

          if (!resp.ok) throw new Error(`Status ${resp.status}`)
          const parsed = await resp.json()
          console.log('[Home] Fallback fetch returned:', parsed?.length || 0)
          virtualSlots = Array.isArray(parsed) ? parsed : []
        } catch (fetchErr: any) {
          console.error('[Home] Fallback fetch error:', fetchErr)
          throw fetchErr
        }
      }

      // Filter to ALL slots (both available and booked)
      const filtered = (virtualSlots || []).filter(
        (slot) => slot.pitch_id === pitchId
      )

      // Map slots to SlotWithBooker format (booker_name already included from backend)
      const enriched: SlotWithBooker[] = filtered.map(slot => ({
        ...slot,
        bookerName: slot.booker_name,
        isBookedByMe: slot.booker_id === user?.id,
      }))

      // Client-side safeguard: filter out any slots that have already started or are in the current hour
      // Only show slots that start in the FUTURE (not at or before now)
      const nowTs = Date.now()
      const nowDate = new Date(nowTs)
      const currentHour = nowDate.getUTCHours()

      const visibleSlots = enriched.filter(s => {
        const startTs = new Date(s.datetime_start).getTime()
        const slotDate = new Date(startTs)
        const slotHour = slotDate.getUTCHours()

        // Exclude if slot is in the current hour or past
        if (slotHour === currentHour) {
          console.log(`[Home] EXCLUDING slot ${slotDate.toISOString()}: same hour as current time (${currentHour})`)
          return false
        }
        // Only show future slots (strictly greater than now)
        if (startTs <= nowTs) {
          console.log(`[Home] EXCLUDING slot ${slotDate.toISOString()}: already started`)
          return false
        }
        return true
      })

      console.log('[Home] Slots fetched:', enriched.length, 'visible after filtering:', visibleSlots.length)
      console.log('[Home] Current time:', new Date(nowTs).toISOString(), 'UTC Hour:', currentHour)
      setSlots(visibleSlots)
      setError('')
    } catch (err: any) {
      const errMsg = err.message || 'Failed to fetch available slots'
      console.error('[Home] Error:', errMsg)
      setError(errMsg)
      setSlots([])
    } finally {
      setLoading(false)
    }
  }

  const handleBookSlot = async (virtualSlotId: string) => {
    if (!user) {
      setError(t('home.must_login'))
      return
    }

    if (!isApproved) {
      setError(t('home.not_approved'))
      return
    }

    try {
      setActionLoading(virtualSlotId)

      // Find the slot to get pitch_id and datetime_start
      const slot = slots.find((s) => s.id === virtualSlotId)
      if (!slot) {
        throw new Error(t('home.slot_not_found'))
      }

      // Check if user already has an active *upcoming* booking (prevent double booking)
      // We allow booking again if the user's active booking has already passed.
      const { data: activeBookings, error: activeErr } = await supabase
        .from('bookings')
        .select('id,slot_datetime,slot_datetime_end,slot_id')
        .eq('user_id', user.id)
        .eq('status', 'active')

      if (activeErr) throw activeErr

      let hasActiveUpcomingBooking = false
      const nowTs = Date.now()

      if (Array.isArray(activeBookings) && activeBookings.length > 0) {
        for (const b of activeBookings) {
          if (b.slot_datetime_end) {
            const bookingEnd = new Date(b.slot_datetime_end).getTime()
            if (bookingEnd > nowTs) {
              hasActiveUpcomingBooking = true
              break
            }
            // if bookingEnd <= now, treat it as past and ignore
          } else if (b.slot_datetime) {
            const bookingTime = new Date(b.slot_datetime).getTime()
            // Fallback: assume 1 hour slot length
            if (bookingTime + 60 * 60 * 1000 > nowTs) {
              hasActiveUpcomingBooking = true
              break
            }
            // if bookingTime +1h <= now, treat as past
          } else if (b.slot_id) {
            // For bookings referencing real slots, fetch the slot end time
            const { data: slotData, error: slotErr } = await supabase
              .from('slots')
              .select('datetime_end')
              .eq('id', b.slot_id)
              .maybeSingle()

            if (slotErr) throw slotErr
            if (slotData && slotData.datetime_end) {
              const slotEndTs = new Date(slotData.datetime_end).getTime()
              if (slotEndTs > nowTs) {
                hasActiveUpcomingBooking = true
                break
              }
            } else {
              // If slot info missing, conservatively treat as active
              hasActiveUpcomingBooking = true
              break
            }
          } else {
            // No slot info: conservatively treat as active
            hasActiveUpcomingBooking = true
            break
          }
        }
      }

      if (hasActiveUpcomingBooking) {
        toast.error(t('home.already_active_booking'))
        setActionLoading(null)
        return
      }

      console.log('[Home] Booking slot:', {
        user_id: user.id,
        pitch_id: slot.pitch_id,
        slot_datetime: slot.datetime_start,
        slot_datetime_end: slot.datetime_end,
      })

      const { error: bookError } = await supabase
        .from('bookings')
        .insert([
          {
            user_id: user.id,
            pitch_id: slot.pitch_id,
            slot_datetime: slot.datetime_start,
            slot_datetime_end: slot.datetime_end,
            status: 'active',
          },
        ])

      if (bookError) throw bookError

      console.log('[Home] ✅ Booking created successfully, refreshing slots...')
      toast.success(t('home.slot_booked_success'))
      
      // Refresh slots to show updated state
      await fetchAvailableSlots(selectedPitch)
    } catch (err: any) {
      if (err.message?.includes('no_double_booking')) {
        toast.error(t('home.already_active_booking'))
      } else {
        toast.error(err.message || t('home.failed_book_slot'))
      }
      console.error('[Home] Booking error:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleCancelSlot = async (virtualSlotId: string) => {
    if (!user) {
      setError(t('home.must_login'))
      return
    }

    try {
      setActionLoading(virtualSlotId)

      // Find the virtual slot to get pitch_id and datetime_start
      const slot = slots.find((s) => s.id === virtualSlotId)
      if (!slot) {
        toast.error(t('home.slot_not_found'))
        setActionLoading(null)
        return
      }

      console.log('[Home] Cancelling slot booking for slot:', virtualSlotId, { pitch_id: slot.pitch_id, slot_datetime: slot.datetime_start })

      // Find the user's active booking that matches this virtual slot
      const { data: found, error: findErr } = await supabase
        .from('bookings')
        .select('id')
        .eq('user_id', user.id)
        .eq('pitch_id', slot.pitch_id)
        .eq('slot_datetime', slot.datetime_start)
        .eq('status', 'active')
        .maybeSingle()

      if (findErr) throw findErr
      if (!found || !found.id) {
        throw new Error('No active booking found for this slot')
      }

      const bookingId = found.id

      const { error: cancelError } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', bookingId)

      if (cancelError) throw cancelError

      // Refresh available slots for the selected pitch so UI updates
      await fetchAvailableSlots(selectedPitch)
      toast.success(t('home.slot_cancelled_success'))
    } catch (err: any) {
      console.error('[Home] Cancel error:', err)
      toast.error(err.message || t('home.failed_cancel_slot'))
    } finally {
      setActionLoading(null)
    }
  }

  const formatTime = (dateString: string) => {
    // Parse ISO string that represents local time (no timezone conversion)
    const parts = dateString.split('T')
    if (parts.length === 2) {
      const timePart = parts[1].split(':')
      if (timePart.length >= 2) {
        return `${timePart[0]}:${timePart[1]}`
      }
    }
    // Fallback: parse as date (will apply timezone conversion)
    const date = new Date(dateString)
    const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-GB'
    return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false, numberingSystem: 'latn' }).format(date)
  }

  const formatTimeString = (timeStr: string) => {
    // Format time string like "08:00:00" to "08:00"
    if (timeStr === '24:00' || timeStr === '24:00:00') {
      return '00:00 (next)'
    }
    return timeStr.substring(0, 5)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-GB'
    return new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric', numberingSystem: 'latn' }).format(date)
  }

  const groupSlotsByDate = (slots: SlotWithBooker[]) => {
    const grouped: { [key: string]: SlotWithBooker[] } = {}

    slots.forEach((slot) => {
      const dateKey = new Date(slot.datetime_start).toISOString().split('T')[0]
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(slot)
    })

    return Object.entries(grouped).map(([date, daySlots]) => ({
      date,
      displayDate: formatDate(daySlots[0].datetime_start),
      slots: daySlots,
      currentTime: currentTime,
    }))
  }

  const getSlotStatus = (slot: SlotWithBooker): 'available' | 'booked' | 'booked-by-you' => {
    if (slot.isBookedByMe) return 'booked-by-you'
    if (!slot.is_available) return 'booked'
    return 'available'
  }

  return (
    <div className="home-container">
    

      {/* Pitch Selection Menu */}
      <div className="pitches-section">
        {pitches.length === 0 ? (
          <div className="alert alert-warning">{t('home.no_pitches')}</div>
        ) : (
          <div className="pitch-dropdown-wrapper" ref={menuRef}>
            <button
              className="pitch-dropdown-button"
              onClick={() => setShowPitchMenu(!showPitchMenu)}
              aria-haspopup="listbox"
              aria-expanded={showPitchMenu}
            >
              <div className="pitch-dropdown-content">
                {selectedPitch ? (
                  <>
                    <div className="pitch-icon">
                      <FiBriefcase size={20} />
                    </div>
                    <div className="pitch-dropdown-text">
                      <div className="pitch-dropdown-label">
                        {pitches.find(p => p.id === selectedPitch)?.name}
                      </div>
                      <div className="pitch-dropdown-sublabel">
                        <FiMapPin size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                        {pitches.find(p => p.id === selectedPitch)?.location || 'Location'}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="pitch-icon">
                      <FiBriefcase size={20} />
                    </div>
                    <div className="pitch-dropdown-text">
                      <div className="pitch-dropdown-label">{t('home.choose_pitch')}</div>
                      <div className="pitch-dropdown-sublabel">{pitches.length} {t('home.available_pitches', 'pitches available')}</div>
                    </div>
                  </>
                )}
              </div>
              <FiChevronDown 
                className={`chevron-icon ${showPitchMenu ? 'open' : ''}`}
                size={20}
              />
            </button>

            {showPitchMenu && (
              <div className="pitch-dropdown-menu" role="listbox" tabIndex={0} onKeyDown={handleMenuKeyDown}>
                {pitches.map((pitch, idx) => (
                  <button
                    key={pitch.id}
                    ref={(el) => (itemRefs.current[idx] = el)}
                    className={`pitch-menu-item ${selectedPitch === pitch.id ? 'active' : ''}`}
                    onClick={() => {
                          movePitchToTop(pitch.id)
                          setSelectedPitch(pitch.id)
                          setShowPitchMenu(false)
                        }}
                    onMouseEnter={() => setFocusedIndex(idx)}
                    role="option"
                    aria-selected={selectedPitch === pitch.id}
                    tabIndex={focusedIndex === idx ? 0 : -1}
                  >
                    <div className="pitch-menu-item-icon">
                      <FiBriefcase size={18} />
                    </div>
                    <div className="pitch-menu-item-content">
                      <div className="pitch-menu-item-name">{pitch.name}</div>
                      <div className="pitch-menu-item-details">
                        <span className="pitch-menu-item-location">
                          <FiMapPin size={14} />
                          {pitch.location || 'Location'}
                        </span>
                        <span className="pitch-menu-item-hours">
                          <FiClock size={14} />
                          {formatTimeString(pitch.open_time)} - {formatTimeString(pitch.close_time)}
                        </span>
                      </div>
                    </div>
                    {selectedPitch === pitch.id && (
                      <div className="pitch-menu-item-checkmark">✓</div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Slots Grid */}
      {selectedPitch && (
        <div className="slots-section">
          {loading ? (
            <div className="loading">{t('home.loading_slots')}</div>
          ) : slots.length === 0 ? (
            <div className="alert alert-info">{t('home.no_slots')}</div>
          ) : (
            <div className="slots-by-date">
              {groupSlotsByDate(slots).map((dayGroup) => (
                <div key={dayGroup.date} className="date-group">
                  <div className="date-header">
                    <span className="date-header-left">{dayGroup.displayDate}</span>
                    <span className="date-header-right">
                      {new Intl.DateTimeFormat(i18n.language === 'ar' ? 'ar-EG' : 'en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, numberingSystem: 'latn' }).format(dayGroup.currentTime)}
                    </span>
                  </div>
                  <div className="slots-grid">
                    {dayGroup.slots.map((slot) => (
                      <SlotCard
                        key={slot.id}
                        time={formatTime(slot.datetime_start)}
                        endTime={formatTime(slot.datetime_end)}
                        status={getSlotStatus(slot)}
                        pitchName={slot.pitch_name}
                        bookerName={slot.bookerName}
                        onBook={() => handleBookSlot(slot.id)}
                        onCancel={() => handleCancelSlot(slot.id)}
                        isLoading={actionLoading === slot.id}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Home
