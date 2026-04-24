import { FiCalendar, FiMenu, FiX, FiUser, FiCheck, FiClock } from 'react-icons/fi'
import React from 'react'

export const IconCalendar: React.FC<{ className?: string }> = ({ className = '' }) => <FiCalendar className={className} />
export const IconMenu: React.FC<{ className?: string }> = ({ className = '' }) => <FiMenu className={className} />
export const IconClose: React.FC<{ className?: string }> = ({ className = '' }) => <FiX className={className} />
export const IconUser: React.FC<{ className?: string }> = ({ className = '' }) => <FiUser className={className} />
export const IconCheck: React.FC<{ className?: string }> = ({ className = '' }) => <FiCheck className={className} />
export const IconClock: React.FC<{ className?: string }> = ({ className = '' }) => <FiClock className={className} />

export default {
  IconCalendar,
  IconMenu,
  IconClose,
  IconUser,
  IconCheck,
  IconClock,
}
