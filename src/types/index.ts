export type Marketplace = 'tokopedia' | 'shopee' | 'lazada' | 'blibli' | 'official' | 'other'

export interface Item {
  id: string
  user_id: string
  name: string
  url: string
  marketplace: Marketplace
  image_url?: string
  target_price?: number
  currency: string
  is_active: boolean
  notes?: string
  variant_key?: string
  created_at: string
  updated_at: string
}

export interface PriceHistory {
  id: string
  item_id: string
  price: number
  scraped_at: string
  source: 'cron' | 'manual' | 'import'
  status: 'success' | 'failed' | 'unavailable' | 'changed_url'
  source_url?: string
}

export interface User {
  id: string
  email: string
  created_at: string
}
