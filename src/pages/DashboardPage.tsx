import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TrendingDown, Target, Clock, Package, ShoppingBag } from 'lucide-react'
import { useItems } from '@/hooks/useItems'
import { formatRelativeTime, getMarketplaceBadgeColor, formatIDR, isHitTarget } from '@/lib/utils'
import { Plus } from 'lucide-react'
import type { PriceHistory } from '@/types'

export function DashboardPage() {
  const { items, loading, priceHistoryMap, fetchPriceHistoryForAllItems } = useItems()
  const navigate = useNavigate()

  useEffect(() => {
    if (items.length > 0) {
      fetchPriceHistoryForAllItems()
    }
  }, [items, fetchPriceHistoryForAllItems])

  // Calculate KPI from real data
  const totalItems = items.length

  // Calculate avg price drop for items with price history
  const calculatePriceDrop = (history: PriceHistory[]): number | null => {
    const successEntries = history
      .filter(h => h.status === "success" && h.price > 0)
      .sort((a, b) => new Date(b.scraped_at).getTime() - new Date(a.scraped_at).getTime());

    if (successEntries.length < 2) return null;

    const latest = successEntries[0].price;              // terbaru
    const oldest = successEntries[successEntries.length - 1].price;  // tertua

    if (oldest === 0) return null; // guard division by zero

    return ((latest - oldest) / oldest) * 100;
    // Contoh: (16449000 - 19599000) / 19599000 * 100 = -16.07%
  };

  const drops = items
    .map(item => calculatePriceDrop(priceHistoryMap?.get(item.id) ?? []))
    .filter((v): v is number => v !== null);

  const avgDrop = drops.length === 0
    ? null
    : drops.reduce((sum, v) => sum + v, 0) / drops.length;

  const avgDropDisplay = avgDrop === null
    ? "—"
    : `${avgDrop > 0 ? "+" : ""}${avgDrop.toFixed(1)}%`;

  const isIncrease = avgDrop !== null && avgDrop > 0;

  // Count items that hit target (using same logic as filter)
  let itemsHitTarget = 0
  items.forEach(item => {
    const history = priceHistoryMap?.get(item.id)
    if (history && history.length > 0) {
      // Get the latest price (first entry since ordered by scraped_at DESC)
      const latestPrice = history[0].price
      if (isHitTarget(item.target_price, latestPrice)) {
        itemsHitTarget++
      }
    }
  })

  // Find most recent scraped_at
  let mostRecentScraped: string | null = null
  priceHistoryMap?.forEach(history => {
    history.forEach(entry => {
      if (!mostRecentScraped || new Date(entry.scraped_at) > new Date(mostRecentScraped)) {
        mostRecentScraped = entry.scraped_at
      }
    })
  })
  const lastScraped = mostRecentScraped ? formatRelativeTime(mostRecentScraped) : '—'

  // Get 5 most recent items
  const recentItems = items.slice(0, 5)

  return (
    <Layout title="Dashboard">
      <div className="space-y-6">
        {items.length === 0 ? (
          <Card>
            <CardContent className="pt-16">
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <ShoppingBag className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Selamat datang!</h3>
                <p className="text-muted-foreground mb-6">Mulai lacak harga produk wishlist kamu</p>
                <Button onClick={() => navigate('/wishlist')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Tambah Item Pertama
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="border-l-4 border-l-teal-500">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Items</CardTitle>
                  <Package className="h-4 w-4 text-teal-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalItems}</div>
                  <p className="text-xs text-muted-foreground">In your wishlist</p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-blue-500">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{isIncrease ? "Avg Price Change" : "Avg Price Drop"}</CardTitle>
                  <TrendingDown className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{avgDropDisplay}</div>
                  <p className="text-xs text-muted-foreground">{isIncrease ? "From lowest price" : "From peak price"}</p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-green-500">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Hit Target</CardTitle>
                  <Target className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{itemsHitTarget}</div>
                  <p className="text-xs text-muted-foreground">Items at target price</p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-gray-500">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Last Scraped</CardTitle>
                  <Clock className="h-4 w-4 text-gray-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{lastScraped}</div>
                  <p className="text-xs text-muted-foreground">Prices updated</p>
                </CardContent>
              </Card>
            </div>

            {/* Recent Items */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Recent Items</CardTitle>
                    <CardDescription>Your {recentItems.length} most recently added items</CardDescription>
                  </div>
                  <button
                    onClick={() => navigate('/wishlist')}
                    className="text-sm text-primary hover:underline"
                  >
                    View All
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-muted-foreground">Loading items...</p>
                ) : recentItems.length === 0 ? (
                  <p className="text-muted-foreground">No items yet. Add your first item to get started.</p>
                ) : (
                  <div className="space-y-4">
                    {recentItems.map((item) => {
                      const badgeColor = getMarketplaceBadgeColor(item.marketplace)
                      return (
                        <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/items/${item.id}`)}>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium truncate">{item.name}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`px-2 py-0.5 text-xs font-medium text-white rounded ${badgeColor}`}>
                                {item.marketplace}
                              </span>
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            {item.target_price && (
                              <>
                                <p className="font-medium">{formatIDR(item.target_price)}</p>
                                <p className="text-sm text-muted-foreground">Target price</p>
                              </>
                            )}
                            {!item.target_price && (
                              <p className="text-sm text-muted-foreground">No target set</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  )
}
