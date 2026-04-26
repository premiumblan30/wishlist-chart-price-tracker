import { ItemCard } from './ItemCard'
import { ShoppingBag } from 'lucide-react'
import type { Item, PriceHistory } from '@/types'

interface ItemListProps {
  items: Item[]
  itemPrices?: Record<string, number>
  priceHistoryMap?: Map<string, PriceHistory[]>
  onEdit: (item: Item) => void
  onDelete: (id: string) => void
}

export function ItemList({ items, itemPrices, priceHistoryMap, onEdit, onDelete }: ItemListProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ShoppingBag className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Belum ada item wishlist</h3>
        <p className="text-muted-foreground mb-6">Mulai lacak harga produk yang kamu inginkan</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          currentPrice={itemPrices?.[item.id]}
          priceHistory={priceHistoryMap?.get(item.id)}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
