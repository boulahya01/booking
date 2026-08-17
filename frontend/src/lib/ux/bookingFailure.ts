import type { BookingFailureCode } from '$lib/bookingApi'

const messages = {
  en: {
    authentication_required: 'Your session has ended. Sign in again to continue.',
    account_not_approved: 'Your account is not approved for booking yet.',
    active_booking_exists: 'You already have an active booking. Cancel or complete it before booking another time.',
    pitch_not_found: 'This facility is no longer available.',
    slot_in_past: 'This time has already passed. Choose another slot.',
    outside_booking_window: 'This time is outside the current booking window.',
    invalid_slot: 'This time is not a valid bookable slot.',
    booking_frequency_limited: 'You need to wait before booking this facility again.',
    slot_unavailable: 'That time was just taken. Choose another available slot.',
    booking_not_found: 'This booking could not be found.',
    booking_not_owned: 'You cannot change another student’s booking.',
    booking_not_cancellable: 'This booking can no longer be cancelled.',
    cancellation_window_closed: 'This booking is too close to its start time to cancel.',
    network: 'Connection problem. Check your internet and try again.',
    unknown: 'Something went wrong. Try again.'
  },
  ar: {
    authentication_required: 'انتهت الجلسة. سجّل الدخول من جديد للمتابعة.',
    account_not_approved: 'حسابك غير مفعّل للحجز بعد.',
    active_booking_exists: 'لديك حجز نشط بالفعل. ألغِه أو انتظر انتهاءه قبل حجز موعد آخر.',
    pitch_not_found: 'هذا الملعب لم يعد متاحاً.',
    slot_in_past: 'هذا الموعد انتهى. اختر موعداً آخر.',
    outside_booking_window: 'هذا الموعد خارج فترة الحجز الحالية.',
    invalid_slot: 'هذا الوقت غير متاح للحجز.',
    booking_frequency_limited: 'يجب الانتظار قبل الحجز في هذا الملعب مرة أخرى.',
    slot_unavailable: 'تم حجز هذا الموعد للتو. اختر موعداً متاحاً آخر.',
    booking_not_found: 'تعذر العثور على هذا الحجز.',
    booking_not_owned: 'لا يمكنك تعديل حجز طالب آخر.',
    booking_not_cancellable: 'لم يعد من الممكن إلغاء هذا الحجز.',
    cancellation_window_closed: 'اقترب موعد الحجز كثيراً ولم يعد الإلغاء متاحاً.',
    network: 'مشكلة في الاتصال. تحقق من الإنترنت وحاول من جديد.',
    unknown: 'حدث خطأ. حاول من جديد.'
  }
} as const

export function bookingFailureMessage(code: BookingFailureCode, locale: string | null | undefined): string {
  const language = locale === 'ar' ? 'ar' : 'en'
  return messages[language][code] || messages[language].unknown
}
