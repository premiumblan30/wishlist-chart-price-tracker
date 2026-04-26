import { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Edit, Trash2, ExternalLink, TrendingUp, TrendingDown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { LineChart, Line } from 'recharts'
import { formatCurrency, getMarketplaceBadgeColor, calculatePriceGap, formatRelativeTime, formatAbbreviatedCurrency } from '@/lib/utils'
import type { Item, PriceHistory } from '@/types'

interface ItemCardProps {
  item: Item
  currentPrice?: number
  priceHistory?: PriceHistory[]
  onEdit: (item: Item) => void
  onDelete: (id: string) => void
}

export function ItemCard({ item, currentPrice, priceHistory, onEdit, onDelete }: ItemCardProps) {
  const navigate = useNavigate()
  const badgeColor = getMarketplaceBadgeColor(item.marketplace)
  const displayPrice = currentPrice || item.target_price || 0
  const priceGap = item.target_price ? calculatePriceGap(displayPrice, item.target_price) : 0

  // Calculate badges
  const latestPrice = priceHistory && priceHistory.length > 0 ? priceHistory[0].price : displayPrice
  const firstPrice = priceHistory && priceHistory.length > 0 ? priceHistory[priceHistory.length - 1].price : displayPrice
  const hitTarget = item.target_price && latestPrice <= item.target_price
  const priceDrop = firstPrice > 0 ? ((firstPrice - latestPrice) / firstPrice) * 100 : 0
  const significantDrop = priceDrop >= 5

  // Price change badge (compare two most recent entries)
  const priceChangeBadge = useMemo(() => {
    if (!priceHistory || priceHistory.length < 2) return null
    const recent = priceHistory[0]
    const previous = priceHistory[1]
    const change = recent.price - previous.price
    const isDrop = change < 0
    return {
      show: true,
      isDrop,
      amount: Math.abs(change)
    }
  }, [priceHistory])

  // Price gap color: green if current price < target (good), red if current price > target (not yet)
  const priceGapColor = latestPrice < item.target_price ? 'text-green-500' : 'text-red-500'

  // Prepare sparkline data (last 7 entries, reversed for chart)
  const sparklineData = priceHistory && priceHistory.length > 0
    ? priceHistory.slice(0, 7).reverse().map(h => ({ price: h.price }))
    : [{ price: displayPrice }]

  // Marketplace initial for placeholder
  const marketplaceInitial = item.marketplace.charAt(0).toUpperCase()

  const handleCardClick = () => {
    navigate(`/items/${item.id}`)
  }

  const handleCardKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleCardClick()
    }
  }

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onEdit(item)
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(item.id)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={`overflow-hidden cursor-pointer hover:shadow-lg transition-shadow ${
        hitTarget ? 'border-2 border-green-500 animate-pulse' : ''
      }`}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
    >
      {hitTarget && (
        <div className="bg-green-500 text-white text-center py-2 text-sm font-medium">
          🎯 Target Tercapai!
        </div>
      )}
      <Card className="border-0 shadow-none hover:shadow-lg transition-shadow">
        <CardContent className="p-0">
          <div className="flex">
          {item.image_url ? (
            <div className="w-32 h-32 flex-shrink-0 bg-muted">
              <img
                src={item.image_url}
                alt={item.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            </div>
          ) : (
            <div className="w-32 h-32 flex-shrink-0 bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center">
              <span className="text-3xl font-bold text-white">{marketplaceInitial}</span>
            </div>
          )}

          <div className="flex-1 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold line-clamp-2">{item.name}</h3>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    <span className={`px-2 py-1 text-xs font-medium text-white rounded ${badgeColor}`}>
                      {item.marketplace}
                    </span>
                    {hitTarget && (
                      <span className="px-2 py-1 text-xs font-medium text-white bg-green-500 rounded">
                        🎯 Hit Target
                      </span>
                    )}
                    {significantDrop && (
                      <span className="px-2 py-1 text-xs font-medium text-white bg-blue-500 rounded">
                        📉 Drop
                      </span>
                    )}
                    {priceChangeBadge && priceChangeBadge.show && (
                      <span className={`px-2 py-1 text-xs font-medium text-white rounded flex items-center gap-1 ${
                        priceChangeBadge.isDrop ? 'bg-green-500' : 'bg-red-500'
                      }`}>
                        {priceChangeBadge.isDrop ? (
                          <TrendingDown className="h-3 w-3" />
                        ) : (
                          <TrendingUp className="h-3 w-3" />
                        )}
                        {priceChangeBadge.isDrop ? '↓' : '↑'} {formatAbbreviatedCurrency(priceChangeBadge.amount)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Added {formatRelativeTime(item.created_at)}
                  </p>
                </div>
              </div>

              {/* Sparkline */}
              <div className="mb-2 h-8 w-20">
                {priceHistory && priceHistory.length > 0 ? (
                  <LineChart width={80} height={32} data={sparklineData}>
                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                ) : (
                  <div className="h-8 w-20 flex items-center justify-center">
                    <div className="w-full h-px bg-gray-300" />
                  </div>
                )}
              </div>

              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current:</span>
                  <span className="font-medium">{formatCurrency(displayPrice, item.currency)}</span>
                </div>

                {item.target_price && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Target:</span>
                      <span className="font-medium">{formatCurrency(item.target_price, item.currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gap:</span>
                      <span className={`font-medium ${priceGapColor}`}>
                        {priceGap >= 0 ? '+' : ''}{priceGap.toFixed(1)}%
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                View
              </a>

              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleEditClick}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={handleDeleteClick}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
    </div>
  )
}
