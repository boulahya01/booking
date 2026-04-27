/**
 * Production-safe logger that strips debug output in production builds.
 * Usage:
 *   import { logger } from '$lib/logger'
 *   logger.debug('debug message')     // stripped in production
 *   logger.warn('warning message')    // kept in production
 *   logger.error('error message')     // kept in production
 */

const IS_PROD = import.meta.env.PROD

function noop() {}

export const logger = {
  debug: IS_PROD ? noop : (...args: any[]) => { /* eslint-disable-next-line no-console */ console.log(...args) },
  warn: (...args: any[]) => { /* eslint-disable-next-line no-console */ console.warn(...args) },
  error: (...args: any[]) => { /* eslint-disable-next-line no-console */ console.error(...args) }
}
