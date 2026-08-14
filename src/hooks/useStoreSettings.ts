import { useCallback, useEffect, useRef, useState } from 'react'
import type { RecordModel, RecordSubscription } from 'pocketbase'

import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { mapStoreSettings } from '@/lib/pocketbase/maps'
import type { StoreSettings, StoreSettingsInput } from '@/types'

/**
 * Default settings used before the record has been fetched (or on a fresh
 * install where no record exists yet). Mirrors the spec defaults.
 */
export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  id: '',
  storeName: 'Minha Loja',
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
  /** Update (or create) the store_settings record with a partial payload. */
  updateSettings: (partial: StoreSettingsInput) => Promise<StoreSettings>
  /** Re-fetch the record from the backend. */
  refetch: () => Promise<void>
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
      setSettings(mapStoreSettings(record))
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
    async (partial: StoreSettingsInput): Promise<StoreSettings> => {
      // Merge the partial onto the current settings to compute the full
      // payload — PocketBase requires `storeName` (required field).
      const merged: StoreSettings = { ...settings, ...partial }
      const payload = {
        storeName: merged.storeName || 'Minha Loja',
        storeLogoUrl: merged.storeLogoUrl ?? '',
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

      const id = recordIdRef.current
      let record
      if (id) {
        record = await pb.collection('store_settings').update(id, payload)
      } else {
        record = await pb.collection('store_settings').create(payload)
        recordIdRef.current = record.id
      }
      const mapped = mapStoreSettings(record)
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
    refetch: load,
  }
}

export default useStoreSettings
