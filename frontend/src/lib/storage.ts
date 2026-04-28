import { supabase } from '$lib/supabaseClient'
import { logger } from '$lib/logger'

export interface SignedUrlResult {
  success: boolean
  url?: string
  error?: string
  errorCode?: string
}

/**
 * Generate a signed URL for a private storage file
 * Supports both user's own files and admin access to other users' files
 * @param path - Storage path (e.g., "user-id/id-photos_1234.jpg")
 * @param bucket - Storage bucket name (default: "id-photos")
 * @param expiresIn - URL expiration in seconds (default: 3600)
 * @returns SignedUrlResult with URL or error details
 */
export async function getSignedUrl(
  path: string,
  bucket: string = 'id-photos',
  expiresIn: number = 3600
): Promise<SignedUrlResult> {
  if (!path) {
    return {
      success: false,
      error: 'Path is required',
      errorCode: 'EMPTY_PATH'
    }
  }

  try {
    logger.debug('[getSignedUrl] Requesting signed URL', { path, bucket, expiresIn })

    // First, try using the edge function for better admin support
    const edgeResponse = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-signed-url`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`
        },
        body: JSON.stringify({ path, expires: expiresIn })
      }
    )

    if (edgeResponse.ok) {
      const data = await edgeResponse.json()
      if (data.signedUrl) {
        logger.debug('[getSignedUrl] Edge function succeeded', { path })
        return { success: true, url: data.signedUrl }
      }
    }

    // Fallback error handling from edge function
    if (!edgeResponse.ok) {
      const errorData = await edgeResponse.json().catch(() => ({}))
      const statusCode = edgeResponse.status

      if (statusCode === 403) {
        logger.warn('[getSignedUrl] Access denied (likely not admin)', { path })
        return {
          success: false,
          error: 'You do not have permission to view this photo',
          errorCode: 'ACCESS_DENIED'
        }
      } else if (statusCode === 404) {
        logger.warn('[getSignedUrl] File not found', { path })
        return {
          success: false,
          error: 'Photo not found',
          errorCode: 'NOT_FOUND'
        }
      } else if (statusCode === 429) {
        logger.warn('[getSignedUrl] Rate limited', { path })
        return {
          success: false,
          error: 'Too many requests. Please try again later.',
          errorCode: 'RATE_LIMITED'
        }
      }
    }

    // Fallback: Direct Supabase client call (works for own files)
    logger.debug('[getSignedUrl] Edge function failed, trying Supabase client fallback', { path })

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn)

    if (error) {
      logger.error('[getSignedUrl] Supabase client error', { path, error: error.message })

      if (error.message.includes('not found')) {
        return {
          success: false,
          error: 'Photo not found. It may have been deleted.',
          errorCode: 'NOT_FOUND'
        }
      } else if (error.message.includes('permission') || error.message.includes('permission denied')) {
        return {
          success: false,
          error: 'Permission denied to access this photo',
          errorCode: 'PERMISSION_DENIED'
        }
      }

      return {
        success: false,
        error: 'Failed to load photo',
        errorCode: 'UNKNOWN_ERROR'
      }
    }

    if (!data || !data.signedUrl) {
      logger.error('[getSignedUrl] No signed URL in response', { path, data })
      return {
        success: false,
        error: 'Failed to generate photo URL',
        errorCode: 'NO_URL'
      }
    }

    logger.debug('[getSignedUrl] Supabase client succeeded', { path })
    return { success: true, url: data.signedUrl }
  } catch (err: any) {
    logger.error('[getSignedUrl] Exception', { path, error: err.message })
    return {
      success: false,
      error: 'Failed to load photo. Please try again.',
      errorCode: 'NETWORK_ERROR'
    }
  }
}

/**
 * Get user-friendly error message from error code
 */
export function getErrorMessage(errorCode?: string): string {
  const messages: Record<string, string> = {
    'EMPTY_PATH': 'Photo path is missing',
    'ACCESS_DENIED': 'You do not have permission to view this photo',
    'NOT_FOUND': 'Photo not found or has been deleted',
    'PERMISSION_DENIED': 'Permission denied to access this photo',
    'RATE_LIMITED': 'Too many requests. Please try again in a moment.',
    'NETWORK_ERROR': 'Network error. Please check your connection and try again.',
    'UNKNOWN_ERROR': 'Failed to load photo. Please try again.'
  }
  return messages[errorCode || 'UNKNOWN_ERROR'] || 'An error occurred'
}

/**
 * Check if a path looks like a storage path that needs signed URL
 * @param url - URL or path to check
 * @returns true if it looks like a storage path that needs signed URL
 */
export function isStoragePath(url: string | null): boolean {
  if (!url) return false
  // Looks like a storage path if it contains "/" and doesn't start with http/https
  return /^[a-z0-9-]+\/[a-z0-9-_]+_\d+\.[a-z]+$/i.test(url)
}
