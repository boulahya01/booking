import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './locales/en.json'
import ar from './locales/ar.json'

const resources = {
    en: { translation: en },
    ar: { translation: ar },
}

const saved = typeof window !== 'undefined' ? localStorage.getItem('locale') : null
const browser = (typeof navigator !== 'undefined' && navigator.language) ? navigator.language.split('-')[0] : 'en'
// Default to Arabic if no saved preference
const defaultLang = saved || 'ar' || browser || 'en'

i18n.use(initReactI18next).init({
    resources,
    lng: defaultLang,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
})

export default i18n
