import { useState, useEffect } from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { detectMarketplace } from '@/lib/utils'
import type { Marketplace, Item } from '@/types'

const itemSchema = z.object({
  name: z.string().min(1, 'Nama item wajib diisi'),
  url: z.string().url('URL tidak valid'),
  marketplace: z.enum(['shopee', 'tokopedia', 'lazada', 'blibli', 'official', 'other']),
  target_price: z.number().positive('Harga harus lebih dari 0').optional(),
  image_url: z.string().url('URL gambar tidak valid').optional(),
  notes: z.string().optional(),
  variant_key: z.string().optional(),
})

interface ItemFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (item: Omit<Item, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => void
  initialData?: Item
}

export function ItemForm({ open, onClose, onSubmit, initialData }: ItemFormProps) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [marketplace, setMarketplace] = useState<Marketplace>('other')
  const [targetPrice, setTargetPrice] = useState<number | undefined>()
  const [imageUrl, setImageUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [variantKey, setVariantKey] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (initialData) {
      setName(initialData.name)
      setUrl(initialData.url)
      setMarketplace(initialData.marketplace)
      setTargetPrice(initialData.target_price)
      setImageUrl(initialData.image_url || '')
      setNotes(initialData.notes || '')
      setVariantKey(initialData.variant_key || '')
    } else {
      setName('')
      setUrl('')
      setMarketplace('other')
      setTargetPrice(undefined)
      setImageUrl('')
      setNotes('')
      setVariantKey('')
    }
  }, [initialData, open])

  const handleUrlChange = (value: string) => {
    setUrl(value)
    const detected = detectMarketplace(value)
    if (detected) setMarketplace(detected)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate with zod
    const result = itemSchema.safeParse({
      name,
      url,
      marketplace,
      target_price: targetPrice,
      image_url: imageUrl || undefined,
      notes: notes || undefined,
      variant_key: variantKey || undefined,
    })
    
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.issues.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message
        }
      })
      setErrors(fieldErrors)
      return
    }
    
    onSubmit({
      name,
      url,
      marketplace,
      image_url: imageUrl || undefined,
      target_price: targetPrice,
      currency: 'IDR',
      is_active: true,
      notes: notes || undefined,
      variant_key: variantKey || undefined,
    })
    
    setErrors({})
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialData ? 'Edit Item' : 'Add New Item'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Item Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Nike Air Max"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="url">Product URL *</Label>
              <Input
                id="url"
                type="url"
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="https://shopee.co.id/product/..."
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="marketplace">Marketplace</Label>
              <select
                id="marketplace"
                value={marketplace}
                onChange={(e) => setMarketplace(e.target.value as Marketplace)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
              >
                <option value="shopee">Shopee</option>
                <option value="tokopedia">Tokopedia</option>
                <option value="lazada">Lazada</option>
                <option value="blibli">Blibli</option>
                <option value="official">Official Site</option>
                <option value="other">Other</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="targetPrice">Target Price (IDR)</Label>
              <Input
                id="targetPrice"
                type="number"
                value={targetPrice || ''}
                onChange={(e) => setTargetPrice(e.target.value ? Number(e.target.value) : undefined)}
                placeholder="1500000"
                min="1"
              />
              {errors.target_price && (
                <p className="text-sm text-red-500">{errors.target_price}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="imageUrl">Image URL (Optional)</Label>
              <Input
                id="imageUrl"
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..."
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="variantKey">Varian (opsional)</Label>
              <Input
                id="variantKey"
                value={variantKey}
                onChange={(e) => setVariantKey(e.target.value)}
                placeholder="KING|630T Egyptian"
                className="mb-1"
              />
              <p className="text-xs text-muted-foreground">
                Pisahkan varian dengan | jika ada lebih dari satu pilihan (untuk produk multi-variant)
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {initialData ? 'Update' : 'Add'} Item
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
