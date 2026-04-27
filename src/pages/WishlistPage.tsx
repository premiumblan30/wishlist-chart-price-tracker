import { useState, useEffect, useMemo, useCallback } from 'react'
import { flushSync } from 'react-dom'
import { Layout } from '@/components/layout/Layout'
import { Button } from '@/components/ui/button'
import { ItemList } from '@/components/items/ItemList'
import { ItemForm } from '@/components/items/ItemForm'
import { useItems } from '@/hooks/useItems'
import { Plus, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { Item } from '@/types'
import { isHitTarget } from '@/lib/utils'

type SortOption = 'Terbaru' | 'Penurunan Terbesar' | 'Terdekat ke Target' | 'Nama A-Z'
type FilterOption = 'Semua' | 'Tokopedia' | 'Shopee' | 'Lazada' | 'Hit Target'

export function WishlistPage() {
  const { items, loading, error, createItem, updateItem, deleteItem, priceHistoryMap, fetchPriceHistoryForAllItems } = useItems()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Item | undefined>()
  const [modalKey, setModalKey] = useState(0)
  const [sortBy, setSortBy] = useState<SortOption>('Terbaru')
  const [filterBy, setFilterBy] = useState<FilterOption>('Semua')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<Item | null>(null)

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    if (items.length > 0) {
      fetchPriceHistoryForAllItems()
    }
  }, [items, fetchPriceHistoryForAllItems])

  const handleAddItem = () => {
    flushSync(() => {
      setEditingItem(null)
    })
    setModalKey(prev => prev + 1)
    setIsFormOpen(true)
  }

  const handleEditItem = (item: Item) => {
    setEditingItem(item)
    setModalKey(prev => prev + 1)
    setIsFormOpen(true)
  }

  const handleSubmit = async (itemData: Omit<Item, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (editingItem) {
      await updateItem(editingItem.id, itemData)
    } else {
      await createItem(itemData)
    }
  }

  const handleDelete = async (id: string) => {
    // Find the item
    const item = items.find(i => i.id === id)
    if (item) {
      setItemToDelete(item)
      setDeleteConfirmationOpen(true)
    }
  }

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return
    await deleteItem(itemToDelete.id)
    setDeleteConfirmationOpen(false)
    setItemToDelete(null)
  }

  const handleCancelDelete = () => {
    setDeleteConfirmationOpen(false)
    setItemToDelete(null)
  }

  // Filter and sort items
  const filteredAndSortedItems = useMemo(() => {
    let filtered = items

    // Apply search filter
    if (debouncedSearch) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(debouncedSearch.toLowerCase())
      )
    }

    // Apply filter
    if (filterBy === 'Hit Target') {
      filtered = filtered.filter(item => {
        const history = priceHistoryMap?.get(item.id)
        if (!history || history.length === 0) return false
        // Get the latest price (first entry since ordered by scraped_at DESC)
        const latestPrice = history[0].price
        return isHitTarget(item.target_price, latestPrice)
      })
    } else if (filterBy !== 'Semua') {
      filtered = filtered.filter(item => item.marketplace.toLowerCase() === filterBy.toLowerCase())
    }

    // Apply sort
    const sorted = [...filtered]
    switch (sortBy) {
      case 'Terbaru':
        sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        break
      case 'Penurunan Terbesar':
        sorted.sort((a, b) => {
          const historyA = priceHistoryMap?.get(a.id) || []
          const historyB = priceHistoryMap?.get(b.id) || []
          if (historyA.length < 2 || historyB.length < 2) return 0
          const dropA = ((historyA[0].price - historyA[historyA.length - 1].price) / historyA[0].price) * 100
          const dropB = ((historyB[0].price - historyB[historyB.length - 1].price) / historyB[0].price) * 100
          return dropB - dropA
        })
        break
      case 'Terdekat ke Target':
        sorted.sort((a, b) => {
          const historyA = priceHistoryMap?.get(a.id) || []
          const historyB = priceHistoryMap?.get(b.id) || []
          const latestA = historyA.length > 0 ? historyA[historyA.length - 1].price : 0
          const latestB = historyB.length > 0 ? historyB[historyB.length - 1].price : 0
          const gapA = a.target_price ? Math.abs(latestA - a.target_price) / a.target_price : Infinity
          const gapB = b.target_price ? Math.abs(latestB - b.target_price) / b.target_price : Infinity
          return gapA - gapB
        })
        break
      case 'Nama A-Z':
        sorted.sort((a, b) => a.name.localeCompare(b.name))
        break
    }

    return sorted
  }, [items, filterBy, sortBy, priceHistoryMap, debouncedSearch])

  return (
    <Layout title="Wishlist">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">My Wishlist</h2>
            <p className="text-muted-foreground">
              {items.length} {items.length === 1 ? 'item' : 'items'} in your wishlist
            </p>
          </div>
          <Button onClick={handleAddItem}>
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>

        {/* Sort & Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          {/* Search Bar */}
          <div className="relative w-full sm:w-64">
            <Input
              placeholder="Cari item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-8"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Sort:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-3 py-2 border rounded-md bg-background text-sm"
            >
              <option value="Terbaru">Terbaru</option>
              <option value="Penurunan Terbesar">Penurunan Terbesar</option>
              <option value="Terdekat ke Target">Terdekat ke Target</option>
              <option value="Nama A-Z">Nama A-Z</option>
            </select>
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-sm font-medium">Filter:</label>
            {(['Semua', 'Tokopedia', 'Shopee', 'Lazada', 'Hit Target'] as FilterOption[]).map((option) => (
              <button
                key={option}
                onClick={() => setFilterBy(option)}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  filterBy === option
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-4 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-md">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex">
                    <div className="w-32 h-32 bg-muted animate-pulse flex-shrink-0" />
                    <div className="flex-1 p-4 flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                        <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
                        <div className="h-8 w-20 bg-muted animate-pulse rounded mt-2" />
                      </div>
                      <div className="space-y-1">
                        <div className="h-3 bg-muted animate-pulse rounded w-full" />
                        <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <ItemList
            items={filteredAndSortedItems}
            priceHistoryMap={priceHistoryMap}
            onEdit={handleEditItem}
            onDelete={handleDelete}
          />
        )}

        <ItemForm
          key={modalKey}
          open={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onSubmit={handleSubmit}
          initialData={editingItem ?? undefined}
        />

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteConfirmationOpen} onClose={handleCancelDelete}>
          <DialogHeader>
            <DialogTitle>Hapus item ini?</DialogTitle>
          </DialogHeader>
          <DialogContent>
            <p>
              Semua data harga <strong>{itemToDelete?.name}</strong> akan ikut terhapus.
            </p>
          </DialogContent>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelDelete}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Hapus
            </Button>
          </DialogFooter>
        </Dialog>
      </div>
    </Layout>
  )
}
