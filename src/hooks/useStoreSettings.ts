import { useCallback, useEffect, useRef, useState } from 'react'
import type { RecordModel, RecordSubscription } from 'pocketbase'

import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { mapStoreSettings } from '@/lib/pocketbase/maps'
import type { StoreSettings, StoreSettingsInput } from '@/types'

/**
 * Convert a File / Blob into a base64 data URL string via FileReader.
 * Used to embed the store logo into printable receipts (which cannot rely on
 * token-authenticated URLs in a freshly opened print window).
 */
export async function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'))
    reader.readAsDataURL(file)
  })
}

/**
 * Fetch a (possibly token-authenticated) file URL and return its contents as a
 * base64 data URL. Adds an `Authorization` header using the current auth token
 * for safety (the URL may already include `?token=`). Returns null on any
 * failure so callers can fall back silently.
 */
export async function fetchFileAsDataUrl(url: string): Promise<string | null> {
  try {
    const headers: Record<string, string> = {}
    const token = pb.authStore.token
    if (token) headers['Authorization'] = token
    const res = await fetch(url, { headers })
    if (!res.ok) return null
    const blob = await res.blob()
    return await fileToDataUrl(blob)
  } catch {
    return null
  }
}

/**
 * Default settings used before the record has been fetched (or on a fresh
 * install where no record exists yet). Mirrors the spec defaults.
 */
export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  id: '',
  storeName: 'Minha Loja',
  storeLogo: null,
  storeLogoUrl: null,
  storePhone: null,
  storeWhatsapp: null,
  storeInstagram: null,
  storeAddress: null,
  storeThankYouMessage: 'Obrigado pela preferência!',
  storePrimaryColor: null,
  devBrandName: null,
  devBrandWhatsapp: null,
  devBrandShowOnReceipt: false,
  devBrandLandingPageUrl: null,
  createdAt: '',
  updatedAt: '',
}

export interface UseStoreSettings {
  settings: StoreSettings
  loading: boolean
  error: boolean
  /**
   * Update (or create) the store_settings record with a partial payload.
   * Pass a `logoFile` File to upload a new logo, `null` to clear the existing
   * logo, or `undefined` to leave the logo untouched.
   */
  updateSettings: (partial: StoreSettingsInput, logoFile?: File | null) => Promise<StoreSettings>
  /** Convert a File/Blob to a base64 data URL. */
  fileToDataUrl: (file: File | Blob) => Promise<string>
  /** Fetch a file URL and return it as a base64 data URL (or null). */
  fetchFileAsDataUrl: (url: string) => Promise<string | null>
  /** Re-fetch the record from the backend. */
  refetch: () => Promise<void>
}

/**
 * Build the full (token-authenticated) URL for the store logo file field, or
 * null when no logo is stored. Works for both the fetched record and realtime
 * event records.
 */
function logoUrlFromRecord(record: RecordModel | null): string | null {
  if (!record) return null
  const filename = (record as unknown as { storeLogo?: unknown }).storeLogo
  if (!filename || typeof filename !== 'string' || filename === '') return null
  return pb.files.getUrl(record, filename)
}

/**
 * useStoreSettings — loads the single `store_settings` record, keeps it in
 * sync via realtime (UPDATE/CREATE events), and exposes `updateSettings`
 * which creates the record first if it doesn't exist, then updates it.
 *
 * Used app-wide (Layout, Login, Pos, Settings) so every surface reflects the
 * configured white-label data. Falls back to `DEFAULT_STORE_SETTINGS` while
 * loading or on fetch failure.
 */
export function useStoreSettings(): UseStoreSettings {
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const mountedRef = useRef(true)
  const recordIdRef = useRef<string | null>(null)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const record = await pb.collection('store_settings').getFirstListItem('1=1', {
        // there is at most one record; pull the newest
        sort: '-created',
      })
      if (!mountedRef.current) return
      recordIdRef.current = record.id
      const mapped = mapStoreSettings(record)
      mapped.storeLogoUrl = logoUrlFromRecord(record)
      setSettings(mapped)
    } catch {
      // NotFound → no settings configured yet; that's the expected empty state.
      if (!mountedRef.current) return
      recordIdRef.current = null
      setSettings(DEFAULT_STORE_SETTINGS)
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Realtime: keep the local record in sync when it changes anywhere.
  useRealtime<RecordModel>(
    'store_settings',
    (e: RecordSubscription<RecordModel>) => {
      if (!mountedRef.current) return
      if (e.action !== 'create' && e.action !== 'update') return
      const updated = mapStoreSettings(e.record)
      updated.storeLogoUrl = logoUrlFromRecord(e.record)
      recordIdRef.current = updated.id
      setSettings(updated)
    },
    true,
  )

  // Re-load when auth state changes (login / logout) so we never serve stale
  // settings across accounts.
  useEffect(() => {
    const unsub = pb.authStore.onChange(() => {
      if (pb.authStore.isValid) void load()
      else {
        recordIdRef.current = null
        setSettings(DEFAULT_STORE_SETTINGS)
      }
    })
    return unsub
  }, [load])

  const updateSettings = useCallback(
    async (partial: StoreSettingsInput, logoFile?: File | null): Promise<StoreSettings> => {
      // Merge the partial onto the current settings to compute the full
      // payload — PocketBase requires `storeName` (required field).
      const merged: StoreSettings = { ...settings, ...partial }
      const id = recordIdRef.current

      let record
      if (logoFile !== undefined) {
        // FormData mode — needed whenever a file is being uploaded or cleared.
        const formData = new FormData()
        formData.append('storeName', merged.storeName || 'Minha Loja')
        formData.append('storePhone', merged.storePhone ?? '')
        formData.append('storeWhatsapp', merged.storeWhatsapp ?? '')
        formData.append('storeInstagram', merged.storeInstagram ?? '')
        formData.append('storeAddress', merged.storeAddress ?? '')
        formData.append('storeThankYouMessage', merged.storeThankYouMessage ?? '')
        formData.append('storePrimaryColor', merged.storePrimaryColor ?? '')
        formData.append('devBrandName', merged.devBrandName ?? '')
        formData.append('devBrandWhatsapp', merged.devBrandWhatsapp ?? '')
        formData.append('devBrandShowOnReceipt', merged.devBrandShowOnReceipt ? 'true' : 'false')
        formData.append('devBrandLandingPageUrl', merged.devBrandLandingPageUrl ?? '')
        if (logoFile) {
          formData.append('storeLogo', logoFile)
        } else {
          // null → clear the existing file.
          formData.append('storeLogo', '')
        }
        if (id) {
          record = await pb.collection('store_settings').update(id, formData)
        } else {
          record = await pb.collection('store_settings').create(formData)
          recordIdRef.current = record.id
        }
      } else {
        // JSON mode — no logo change. Omit `storeLogo` so PocketBase keeps
        // the existing file, and never send `storeLogoUrl` (computed field).
        const payload = {
          storeName: merged.storeName || 'Minha Loja',
          storePhone: merged.storePhone ?? '',
          storeWhatsapp: merged.storeWhatsapp ?? '',
          storeInstagram: merged.storeInstagram ?? '',
          storeAddress: merged.storeAddress ?? '',
          storeThankYouMessage: merged.storeThankYouMessage ?? '',
          storePrimaryColor: merged.storePrimaryColor ?? '',
          devBrandName: merged.devBrandName ?? '',
          devBrandWhatsapp: merged.devBrandWhatsapp ?? '',
          devBrandShowOnReceipt: !!merged.devBrandShowOnReceipt,
          devBrandLandingPageUrl: merged.devBrandLandingPageUrl ?? '',
        }
        if (id) {
          record = await pb.collection('store_settings').update(id, payload)
        } else {
          record = await pb.collection('store_settings').create(payload)
          recordIdRef.current = record.id
        }
      }

      const mapped = mapStoreSettings(record)
      mapped.storeLogoUrl = logoUrlFromRecord(record)
      if (mountedRef.current) setSettings(mapped)
      return mapped
    },
    [settings],
  )

  return {
    settings,
    loading,
    error,
    updateSettings,
    fileToDataUrl,
    fetchFileAsDataUrl,
    refetch: load,
  }
}

export default useStoreSettings
