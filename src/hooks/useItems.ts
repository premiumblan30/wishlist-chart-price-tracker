import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { Item, PriceHistory } from '@/types'

export function useItems() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [priceHistoryMap, setPriceHistoryMap] = useState<Map<string, PriceHistory[]>>(new Map())

  const fetchItems = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setItems(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch items')
    } finally {
      setLoading(false)
    }
  }

  const createItem = async (item: Omit<Item, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    try {
      setError(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('items')
        .insert({
          ...item,
          user_id: user.id,
        })
        .select()
        .single()

      if (error) throw error

      // Re-fetch items from database to ensure data consistency
      await fetchItems()
      toast.success('Item berhasil ditambahkan')
      return { data, error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create item'
      setError(errorMessage)
      toast.error(errorMessage)
      return { data: null, error: new Error(errorMessage) }
    }
  }

  const updateItem = async (id: string, updates: Partial<Item>) => {
    try {
      setError(null)

      const { data, error } = await supabase
        .from('items')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      // Re-fetch items from database to ensure data consistency
      await fetchItems()
      toast.success('Item berhasil diperbarui')
      return { data, error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update item'
      setError(errorMessage)
      toast.error(errorMessage)
      return { data: null, error: new Error(errorMessage) }
    }
  }

  const deleteItem = async (id: string) => {
    try {
      setError(null)

      const { error } = await supabase
        .from('items')
        .delete()
        .eq('id', id)

      if (error) throw error

      // Re-fetch items from database to ensure data consistency
      await fetchItems()
      toast.success('Item berhasil dihapus')
      return { error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete item'
      setError(errorMessage)
      toast.error(errorMessage)
      return { error: new Error(errorMessage) }
    }
  }

  const getItemPriceHistory = async (itemId: string): Promise<PriceHistory[]> => {
    try {
      const { data, error } = await supabase
        .from('price_history')
        .select('*')
        .eq('item_id', itemId)
        .order('scraped_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (err) {
      console.error('Failed to fetch price history:', err)
      return []
    }
  }

  const fetchRecentPriceHistory = async (itemId: string, limit: number = 7): Promise<PriceHistory[]> => {
    try {
      const { data, error } = await supabase
        .from('price_history')
        .select('*')
        .eq('item_id', itemId)
        .order('scraped_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data || []
    } catch (err) {
      console.error('Failed to fetch recent price history:', err)
      return []
    }
  }

  const fetchPriceHistoryForAllItems = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('price_history')
        .select('*')
        .in('item_id', items.map(item => item.id))
        .order('scraped_at', { ascending: false })

      if (error) throw error

      const map = new Map<string, PriceHistory[]>()
      data?.forEach(entry => {
        const existing = map.get(entry.item_id) || []
        map.set(entry.item_id, [...existing, entry])
      })

      setPriceHistoryMap(map)
    } catch (err) {
      console.error('Failed to fetch price history for all items:', err)
    }
  }

  useEffect(() => {
    fetchItems()
  }, [])

  return {
    items,
    loading,
    error,
    fetchItems,
    createItem,
    updateItem,
    deleteItem,
    getItemPriceHistory,
    fetchRecentPriceHistory,
    fetchPriceHistoryForAllItems,
    priceHistoryMap,
  }
}
