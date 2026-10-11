import { register, init, getLocaleFromNavigator } from 'svelte-i18n'
import en from '../locales/en.json'

register('en', () => Promise.resolve(en))
register('ar', () => import('../locales/ar.json').then((module) => module.default))

export function initializeI18n(initialLocale = 'en') {
  init({
    fallbackLocale: 'en',
    initialLocale: initialLocale || getLocaleFromNavigator() || 'en'
  })
}
