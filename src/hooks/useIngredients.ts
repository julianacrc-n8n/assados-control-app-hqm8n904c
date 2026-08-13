import { useCallback, useEffect, useState } from 'react'

import { listIngredients } from '@/services/ingredients'
import type { Ingredient } from '@/types'

export interface UseIngredients {
  ingredients: Ingredient[]
  loading: boolean
  error: string | null
  refetch: () => void
}

/**
 * useIngredients — returns the full list of ingredients for the
 * authenticated user. Used by the recipe editor dropdown.
 */
export function useIngredients(): UseIngredients {
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listIngredients()
      setIngredients(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar insumos.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return { ingredients, loading, error, refetch: load }
}
