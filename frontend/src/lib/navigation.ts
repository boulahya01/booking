export const primaryNavigation = [
  { href: '/home', en: 'Play', ar: 'العب', icon: 'play', paths: ['/home', '/pitch', '/matches'] },
  { href: '/bookings', en: 'My activity', ar: 'نشاطي', icon: 'calendar-days', paths: ['/bookings'] },
  { href: '/menu', en: 'Account', ar: 'حسابي', icon: 'user', paths: ['/menu', '/profile', '/verification', '/settings', '/pending-approval', '/notifications', '/report', '/admin'] }
]
export function navigationActive(pathname: string, paths: string[]) {
  return paths.some(path => pathname === path || pathname.startsWith(path + '/'))
}
export const playNavigation = [
  { href: '/home', en: 'Facilities', ar: 'المرافق' },
  { href: '/matches', en: 'Open matches', ar: 'المباريات المفتوحة' }
]
export const accountNavigation = [
  { href: '/menu', en: 'Overview', ar: 'نظرة عامة' },
  { href: '/profile', en: 'Profile', ar: 'الملف الشخصي' },
  { href: '/verification', en: 'Verification', ar: 'التحقق' },
  { href: '/settings', en: 'Settings', ar: 'الإعدادات' }
]
