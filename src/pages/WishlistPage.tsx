import { useState, useEffect } from 'react'
import { Layout } from '@/components/layout/Layout'
import { Button } from '@/components/ui/button'
import { ItemList } from '@/components/items/ItemList'
import { ItemForm } from '@/components/items/ItemForm'
import { useItems } from '@/hooks/useItems'
import { Plus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { Item } from '@/types'

export function WishlistPage() {
  const { items, loading, error, createItem, updateItem, deleteItem, priceHistoryMap, fetchPriceHistoryForAllItems } = useItems()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Item | undefined>()

  useEffect(() => {
    if (items.length > 0) {
      fetchPriceHistoryForAllItems()
    }
  }, [items, fetchPriceHistoryForAllItems])

  const handleAddItem = () => {
    setEditingItem(undefined)
    setIsFormOpen(true)
  }

  const handleEditItem = (item: Item) => {
    setEditingItem(item)
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
    if (confirm('Are you sure you want to delete this item?')) {
      await deleteItem(id)
    }
  }

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
            items={items}
            priceHistoryMap={priceHistoryMap}
            onEdit={handleEditItem}
            onDelete={handleDelete}
          />
        )}

        <ItemForm
          open={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onSubmit={handleSubmit}
          initialData={editingItem}
        />
      </div>
    </Layout>
  )
}
