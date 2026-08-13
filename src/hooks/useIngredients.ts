import { useCallback, useEffect, useRef, useState } from 'react'
import type { RecordModel, RecordSubscription } from 'pocketbase'

import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import {
  createIngredient as createIngredientService,
  deleteIngredient as deleteIngredientService,
  listIngredients,
  updateIngredient as updateIngredientService,
} from '@/services/ingredients'
import { mapIngredient } from '@/lib/pocketbase/maps'
import type { Ingredient, IngredientInput } from '@/types'

export interface UseIngredients {
  ingredients: Ingredient[]
  loading: boolean
  error: string | null
  refetch: () => void
  createIngredient: (input: IngredientInput) => Promise<Ingredient>
  updateIngredient: (id: string, input: Partial<IngredientInput>) => Promise<Ingredient>
  deleteIngredient: (id: string) => Promise<void>
}

/**
 * useIngredients — manages the ingredients list with realtime updates.
 * Realtime is the single source of truth; create/update/delete do NOT
 * mutate local state (avoids visual duplication when the WebSocket event
 * arrives before the HTTP response). Does NOT poll.
 */
export function useIngredients(): UseIngredients {
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listIngredients()
      if (!mountedRef.current) return
      setIngredients(data)
    } catch (err) {
      if (!mountedRef.current) return
      setError(err instanceof Error ? err.message : 'Erro ao carregar insumos.')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Realtime subscription — INSERT / UPDATE / DELETE reconciliation.
  useRealtime<RecordModel>(
    'ingredients',
    (e: RecordSubscription<RecordModel>) => {
      if (!mountedRef.current) return
      if (e.action !== 'create' && e.action !== 'update' && e.action !== 'delete') return
      if (e.action === 'delete') {
        setIngredients((prev) => prev.filter((i) => i.id !== e.record.id))
        return
      }
      const record = mapIngredient(e.record)
      setIngredients((prev) => {
        const idx = prev.findIndex((i) => i.id === record.id)
        if (idx === -1) {
          // INSERT — keep alphabetical order (list sorts by name).
          const next = [record, ...prev]
          next.sort((a, b) => a.name.localeCompare(b.name))
          return next
        }
        // UPDATE — replace in place.
        const next = prev.slice()
        next[idx] = record
        return next
      })
    },
    true,
  )

  // Re-load on auth changes so we never show records we can't access.
  useEffect(() => {
    const unsub = pb.authStore.onChange(() => {
      if (pb.authStore.isValid) void load()
    })
    return unsub
  }, [load])

  const createIngredient = useCallback(async (input: IngredientInput) => {
    return createIngredientService(input)
  }, [])

  const updateIngredient = useCallback(async (id: string, input: Partial<IngredientInput>) => {
    return updateIngredientService(id, input)
  }, [])

  const deleteIngredient = useCallback(async (id: string) => {
    await deleteIngredientService(id)
  }, [])

  return {
    ingredients,
    loading,
    error,
    refetch: load,
    createIngredient,
    updateIngredient,
    deleteIngredient,
  }
}
