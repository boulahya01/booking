import { register, init, getLocaleFromNavigator } from 'svelte-i18n'
import en from '../locales/en.json'
import ar from '../locales/ar.json'

register('en', () => Promise.resolve(en))
register('ar', () => Promise.resolve(ar))

export function initializeI18n(initialLocale = 'en') {
  init({
    fallbackLocale: 'en',
    initialLocale: initialLocale || getLocaleFromNavigator() || 'en'
  })
}
