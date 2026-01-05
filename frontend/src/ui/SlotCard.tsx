import React from 'react'
import './SlotCard.css'
import { Card } from './Card'
import { Button } from './Button'
import { FiUser } from 'react-icons/fi'

export type SlotCardProps = {
  time: string
  status: 'available' | 'booked' | 'booked-by-you'
  onBook?: () => void
  onCancel?: () => void
  isLoading?: boolean
  pitchName?: string
  bookerName?: string
}

export const SlotCard: React.FC<SlotCardProps> = ({
  time,
  status,
  onBook,
  onCancel,
  isLoading = false,
  bookerName,
}) => {
  const statusConfig = {
    available: { label: 'Available', action: 'book', bgClass: 'available' },
    booked: { label: 'Booked', action: null, bgClass: 'booked' },
    'booked-by-you': { label: 'Your Booking', action: 'cancel', bgClass: 'booked-by-you' },
  }

  const config = statusConfig[status]
  
  // Extract just the time (HH:MM) from full datetime string
  const timeOnly = time.includes(':') ? time.split(' ')[0] : time

  return (
    <Card className={`ui-slot-card slot-card-${config.bgClass}`}>
      <div className="slot-card-content">
        <div className="slot-time-display">{timeOnly}</div>
      </div>

      {bookerName && (status === 'booked' || status === 'booked-by-you') && (
        <div className="slot-booker-name">
          <span className="booker-avatar"><FiUser size={16} /></span>
          <span className="booker-full-name">{bookerName}</span>
        </div>
      )}

      {!bookerName && status === 'booked' && (
        <div className="slot-booker-name" style={{ opacity: 0.6 }}>
          <span className="booker-avatar"><FiUser size={16} /></span>
          <span className="booker-full-name">Reserved</span>
        </div>
      )}

      {config.action && (
        <div className="slot-card-action">
          {config.action === 'book' ? (
            <Button variant="primary" onClick={onBook} disabled={isLoading} style={{ width: '100%' }}>
              {isLoading ? '...' : 'Available'}
            </Button>
          ) : (
            <Button variant="danger" onClick={onCancel} disabled={isLoading} style={{ width: '100%' }}>
              {isLoading ? '...' : 'Cancel'}
            </Button>
          )}
        </div>
      )}

      {status === 'booked' && !config.action && (
        <div className="slot-booked-badge">Booked</div>
      )}
    </Card>
  )
}

export default SlotCard
