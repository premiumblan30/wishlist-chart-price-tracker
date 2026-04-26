import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, RefreshCw, Home, TrendingUp, TrendingDown, Minus, ExternalLink, Download } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceArea, ResponsiveContainer, Legend } from 'recharts'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate, formatPriceHistoryDate, formatDistanceToNow } from '@/lib/utils'
import { toast } from 'sonner'
import type { Item, PriceHistory } from '@/types'

export function ItemDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [item, setItem] = useState<Item | null>(null)
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [isManualPriceDialogOpen, setIsManualPriceDialogOpen] = useState(false)
  const [manualPrice, setManualPrice] = useState('')
  const [manualDate, setManualDate] = useState('')
  const [isSubmittingPrice, setIsSubmittingPrice] = useState(false)
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false)
  const [entryToDelete, setEntryToDelete] = useState<PriceHistory | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [scrapeJobStatus, setScrapeJobStatus] = useState<string | null>(null)
  const [pollingJobId, setPollingJobId] = useState<string | null>(null)
  const [chartRange, setChartRange] = useState<'7H' | '30H' | '90H' | 'Semua'>('Semua')

  useEffect(() => {
    if (!id) return

    const fetchItemAndHistory = async () => {
      try {
        setLoading(true)

        // Fetch item details
        const { data: itemData, error: itemError } = await supabase
          .from('items')
          .select('*')
          .eq('id', id)
          .single()

        if (itemError) throw itemError
        setItem(itemData)

        // Fetch price history
        const { data: historyData, error: historyError } = await supabase
          .from('price_history')
          .select('*')
          .eq('item_id', id)
          .order('scraped_at', { ascending: true })

        if (historyError) throw historyError
        setPriceHistory(historyData || [])
      } catch (err) {
        console.error('Failed to fetch item details:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchItemAndHistory()
  }, [id])

  const handleManualPriceSubmit = async () => {
    if (!id || !manualPrice || !manualDate) return

    try {
      setIsSubmittingPrice(true)

      const priceValue = parseFloat(manualPrice)
      if (isNaN(priceValue) || priceValue <= 0) {
        toast.error('Harga tidak valid')
        return
      }

      // Validate date is not in the future
      const selectedDate = new Date(manualDate)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (selectedDate > today) {
        toast.error('Tanggal tidak boleh di masa depan')
        return
      }

      const { error } = await supabase
        .from('price_history')
        .insert({
          item_id: id,
          price: priceValue,
          source: 'manual',
          status: 'success',
          scraped_at: `${manualDate}T00:00:00.000Z`,
        })

      if (error) throw error

      toast.success('Harga berhasil ditambahkan')
      setIsManualPriceDialogOpen(false)
      setManualPrice('')
      setManualDate('')

      // Re-fetch price history
      const { data: historyData, error: historyError } = await supabase
        .from('price_history')
        .select('*')
        .eq('item_id', id)
        .order('scraped_at', { ascending: true })

      if (historyError) throw historyError
      setPriceHistory(historyData || [])
    } catch (err) {
      console.error('Failed to add manual price:', err)
      toast.error('Gagal menambahkan harga')
    } finally {
      setIsSubmittingPrice(false)
    }
  }

  const handleOpenManualPriceDialog = () => {
    // Set default date to today
    const today = new Date().toISOString().split('T')[0]
    setManualDate(today)
    setIsManualPriceDialogOpen(true)
  }

  const handleDeleteClick = (entry: PriceHistory) => {
    setEntryToDelete(entry)
    setDeleteConfirmationOpen(true)
  }

  const handleExportCSV = () => {
    if (!item || priceHistory.length === 0) return

    const headers = ['Date', 'Price', 'Source', 'Status', 'Source URL']
    const rows = priceHistory.map(entry => [
      formatDate(entry.scraped_at),
      entry.price.toString(),
      entry.source,
      entry.status,
      entry.source_url || ''
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `${item.name.replace(/[^a-z0-9]/gi, '_')}-price-history.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleConfirmDelete = async () => {
    if (!entryToDelete || !id) return

    try {
      const { error } = await supabase
        .from('price_history')
        .delete()
        .eq('id', entryToDelete.id)

      if (error) throw error

      toast.success('Data harga berhasil dihapus')
      setDeleteConfirmationOpen(false)
      setEntryToDelete(null)

      // Re-fetch price history
      const { data: historyData, error: historyError } = await supabase
        .from('price_history')
        .select('*')
        .eq('item_id', id)
        .order('scraped_at', { ascending: true })

      if (historyError) throw historyError
      setPriceHistory(historyData || [])
    } catch (err) {
      console.error('Failed to delete price history:', err)
      toast.error('Gagal menghapus data harga')
    }
  }

  const handleRefreshPrice = async () => {
    if (!id) return

    try {
      setIsRefreshing(true)

      const { data, error } = await supabase.functions.invoke('manual-scrape', {
        body: { item_id: id },
      })

      if (error) throw error

      if (data.success) {
        toast.success('Scraping dijadwalkan. Harga akan diperbarui dalam beberapa menit.')
        setPollingJobId(data.job_id)
        setScrapeJobStatus('pending')
      } else {
        toast.error('Gagal menjadwalkan scraping. Coba lagi.')
      }
    } catch (err) {
      console.error('Failed to trigger scrape:', err)
      toast.error('Gagal menjadwalkan scraping. Coba lagi.')
    } finally {
      setIsRefreshing(false)
    }
  }

  // Poll scrape job status
  useEffect(() => {
    if (!pollingJobId || !id) return

    let pollInterval: number
    let timeoutId: number

    const pollJobStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('scrape_jobs')
          .select('status, error_msg')
          .eq('id', pollingJobId)
          .single()

        if (error) throw error

        if (data.status === 'done') {
          setScrapeJobStatus('done')
          setPollingJobId(null)
          toast.success('Harga berhasil diperbarui')

          // Re-fetch price history
          const { data: historyData, error: historyError } = await supabase
            .from('price_history')
            .select('*')
            .eq('item_id', id)
            .order('scraped_at', { ascending: true })

          if (!historyError) {
            setPriceHistory(historyData || [])
          }
        } else if (data.status === 'error') {
          setScrapeJobStatus('error')
          setPollingJobId(null)
          toast.error(data.error_msg || 'Gagal melakukan scraping')
        }
      } catch (err) {
        console.error('Failed to poll job status:', err)
      }
    }

    // Poll every 5 seconds
    pollInterval = setInterval(pollJobStatus, 5000)

    // Stop polling after 2 minutes
    timeoutId = setTimeout(() => {
      clearInterval(pollInterval)
      setPollingJobId(null)
      setScrapeJobStatus(null)
    }, 120000)

    return () => {
      clearInterval(pollInterval)
      clearTimeout(timeoutId)
    }
  }, [pollingJobId, id, supabase])

  // Prepare chart data (move before early returns to fix hooks order violation)
  const filteredChartData = useMemo(() => {
    let data = priceHistory.map(h => ({
      date: h.scraped_at,
      price: h.price,
    }))

    if (chartRange !== 'Semua') {
      const now = new Date()
      const daysAgo = chartRange === '7H' ? 7 : chartRange === '30H' ? 30 : 90
      const cutoffDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)
      data = data.filter(h => new Date(h.date) >= cutoffDate)
    }

    return data
  }, [priceHistory, chartRange])

  if (loading) {
    return (
      <Layout title="Item Details">
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </Layout>
    )
  }

  if (!item) {
    return (
      <Layout title="Item Details">
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Item not found</p>
        </div>
      </Layout>
    )
  }

  // Calculate stats
  const lowestPrice = priceHistory.length > 0 ? Math.min(...priceHistory.map(h => h.price)) : 0
  const highestPrice = priceHistory.length > 0 ? Math.max(...priceHistory.map(h => h.price)) : 0
  const averagePrice = priceHistory.length > 0 
    ? priceHistory.reduce((sum, h) => sum + h.price, 0) / priceHistory.length 
    : 0
  const firstPrice = priceHistory.length > 0 ? priceHistory[0].price : 0
  const latestPrice = priceHistory.length > 0 ? priceHistory[priceHistory.length - 1].price : 0
  const percentChange = firstPrice > 0 ? ((latestPrice - firstPrice) / firstPrice) * 100 : 0

  const chartData = filteredChartData

  // Last 10 entries for table
  const recentHistory = priceHistory.slice(-10).reverse()

  return (
    <Layout title="Item Details">
      {!item ? (
        <div className="space-y-6">
          {/* Skeleton Header */}
          <div className="space-y-4">
            <div className="h-4 bg-muted animate-pulse rounded w-32" />
            <div className="h-8 bg-muted animate-pulse rounded w-1/2" />
            <div className="h-4 bg-muted animate-pulse rounded w-1/4" />
          </div>

          {/* Skeleton Chart */}
          <Card>
            <CardHeader>
              <div className="h-6 bg-muted animate-pulse rounded w-1/4" />
              <div className="h-4 bg-muted animate-pulse rounded w-1/3 mt-2" />
            </CardHeader>
            <CardContent>
              <div className="h-[400px] bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>

          {/* Skeleton Stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
                </CardHeader>
                <CardContent>
                  <div className="h-8 bg-muted animate-pulse rounded w-1/3" />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Skeleton Table */}
          <Card>
            <CardHeader>
              <div className="h-6 bg-muted animate-pulse rounded w-1/4" />
              <div className="h-4 bg-muted animate-pulse rounded w-1/3 mt-2" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header */}
          <div className="space-y-4">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <button onClick={() => navigate('/wishlist')} className="hover:text-foreground flex items-center gap-1">
                <Home className="h-4 w-4" />
                Wishlist
              </button>
              <span>/</span>
              <span className="text-foreground truncate max-w-[200px]">{item.name}</span>
            </div>

            {/* Title and actions */}
            <div className="flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold truncate">{item.name}</h1>
                <p className="text-muted-foreground capitalize">{item.marketplace}</p>
                {priceHistory.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Terakhir diperbarui: {formatDistanceToNow(priceHistory[priceHistory.length - 1].scraped_at)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={handleRefreshPrice} disabled={isRefreshing}>
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
                {scrapeJobStatus && (
                  <span className={`px-2 py-1 text-xs font-medium rounded ${
                    scrapeJobStatus === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    scrapeJobStatus === 'done' ? 'bg-green-100 text-green-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {scrapeJobStatus === 'pending' ? 'Scraping...' : scrapeJobStatus}
                  </span>
                )}
                <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={priceHistory.length === 0}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
                <Button onClick={handleOpenManualPriceDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Price
                </Button>
              </div>
            </div>
          </div>

          {/* Target Price Info */}
          {item.target_price && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Target Price</p>
                    <p className="text-2xl font-bold">{formatCurrency(item.target_price, item.currency)}</p>
                  </div>
                  {latestPrice > 0 && (
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Latest Price</p>
                      <p className="text-2xl font-bold">{formatCurrency(latestPrice, item.currency)}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Price History</CardTitle>
              <CardDescription>Price changes over time</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[400px] flex items-end justify-center gap-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-12 bg-gray-800 animate-pulse rounded-t"
                      style={{ height: `${30 + Math.random() * 60}%` }}
                    />
                  ))}
                </div>
              ) : priceHistory.length > 0 ? (
                <>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={formatPriceHistoryDate}
                        />
                        <YAxis
                          tickFormatter={(value) => {
                            if (value >= 1000000) return `Rp ${(value / 1000000).toFixed(1)}jt`
                            if (value >= 1000) return `Rp ${(value / 1000).toFixed(0)}k`
                            return `Rp ${value}`
                          }}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-background border rounded-lg p-3 shadow-lg">
                                  <p className="font-medium">{formatCurrency(payload[0].value as number, 'IDR')}</p>
                                  <p className="text-sm text-muted-foreground">{formatDate(payload[0].payload.date)}</p>
                                </div>
                              )
                            }
                            return null
                          }}
                        />
                        <Legend
                          verticalAlign="top"
                          height={36}
                          content={({ payload }) => (
                            <div className="flex items-center justify-center gap-6">
                              {payload?.map((entry: any, index: number) => (
                                <div key={index} className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                                  <span className="text-sm">{entry.value === 'price' ? 'Harga Aktual' : 'Target Harga'}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        />
                        {item.target_price && (
                          <ReferenceLine
                            y={item.target_price}
                            stroke="red"
                            strokeDasharray="5 5"
                            label="Target"
                          />
                        )}
                        {item.target_price && latestPrice > 0 && (
                          <ReferenceArea
                            y1={lowestPrice}
                            y2={item.target_price}
                            fill={latestPrice <= item.target_price ? '#22c55e' : '#ef4444'}
                            fillOpacity={0.08}
                          />
                        )}
                        <Line
                          type="monotone"
                          dataKey="price"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          dot={{ r: 4 }}
                          name="price"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Chart Range Selector */}
                  <div className="flex items-center justify-center gap-2 mt-4">
                    {(['7H', '30H', '90H', 'Semua'] as const).map((range) => (
                      <button
                        key={range}
                        onClick={() => setChartRange(range)}
                        className={`px-4 py-2 text-sm rounded-md transition-colors ${
                          chartRange === range
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted hover:bg-muted/80'
                        }`}
                      >
                        {range}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <TrendingUp className="h-16 w-16 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Belum ada data harga. Harga akan muncul setelah scraping pertama.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats Row */}
          {priceHistory.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Lowest Price</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{formatCurrency(lowestPrice, item.currency)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Highest Price</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{formatCurrency(highestPrice, item.currency)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Average Price</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{formatCurrency(averagePrice, item.currency)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">% Change</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    {percentChange > 0 ? (
                      <TrendingUp className="h-4 w-4 text-red-500" />
                    ) : percentChange < 0 ? (
                      <TrendingDown className="h-4 w-4 text-green-500" />
                    ) : (
                      <Minus className="h-4 w-4 text-muted-foreground" />
                    )}
                    <p className={`text-2xl font-bold ${percentChange > 0 ? 'text-red-500' : percentChange < 0 ? 'text-green-500' : ''}`}>
                      {percentChange >= 0 ? '+' : ''}{percentChange.toFixed(1)}%
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Price History Table */}
          <Card>
            <CardHeader>
              <CardTitle>Price History</CardTitle>
              <CardDescription>Last 10 entries</CardDescription>
            </CardHeader>
            <CardContent>
              {recentHistory.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[500px]">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium">Date</th>
                        <th className="text-left py-3 px-4 font-medium">Price</th>
                        <th className="text-left py-3 px-4 font-medium">Source</th>
                        <th className="text-left py-3 px-4 font-medium">Status</th>
                        <th className="text-left py-3 px-4 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentHistory.map((entry) => (
                        <tr key={entry.id} className="border-b">
                          <td className="py-3 px-4">{formatDate(entry.scraped_at)}</td>
                          <td className="py-3 px-4 font-medium">
                            {entry.source === 'cron' && entry.source_url ? (
                              <a
                                href={entry.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-teal-600 hover:text-teal-700 hover:underline inline-flex items-center gap-1"
                              >
                                {formatCurrency(entry.price, item.currency)}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              formatCurrency(entry.price, item.currency)
                            )}
                          </td>
                          <td className="py-3 px-4 capitalize">{entry.source}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 text-xs font-medium rounded ${
                              entry.status === 'success' ? 'bg-green-100 text-green-700' :
                              entry.status === 'failed' ? 'bg-red-100 text-red-700' :
                              entry.status === 'unavailable' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {entry.status}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(entry)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex items-center justify-center py-12">
                  <p className="text-muted-foreground">Belum ada data harga. Harga akan muncul setelah scraping pertama.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Manual Price Dialog */}
      <Dialog open={isManualPriceDialogOpen} onClose={() => {
        setIsManualPriceDialogOpen(false)
        setManualDate('')
      }}>
        <DialogHeader>
          <DialogTitle>Add Price Manually</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="manual-date">Date</Label>
              <Input
                id="manual-date"
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div>
              <Label htmlFor="manual-price">Price (IDR)</Label>
              <Input
                id="manual-price"
                type="number"
                value={manualPrice}
                onChange={(e) => setManualPrice(e.target.value)}
                placeholder="e.g. 150000"
              />
            </div>
          </div>
        </DialogContent>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setIsManualPriceDialogOpen(false)
              setManualDate('')
            }}
            disabled={isSubmittingPrice}
          >
            Cancel
          </Button>
          <Button onClick={handleManualPriceSubmit} disabled={isSubmittingPrice || !manualPrice || !manualDate}>
            {isSubmittingPrice ? 'Adding...' : 'Add Price'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmationOpen} onClose={() => {
        setDeleteConfirmationOpen(false)
        setEntryToDelete(null)
      }}>
        <DialogHeader>
          <DialogTitle>Hapus Data Harga?</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <p>
            Data harga {entryToDelete && formatCurrency(entryToDelete.price, item.currency)} pada {entryToDelete && formatDate(entryToDelete.scraped_at)} akan dihapus permanen.
          </p>
        </DialogContent>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setDeleteConfirmationOpen(false)
              setEntryToDelete(null)
            }}
          >
            Batal
          </Button>
          <Button variant="destructive" onClick={handleConfirmDelete}>
            Hapus
          </Button>
        </DialogFooter>
      </Dialog>
    </Layout>
  )
}
