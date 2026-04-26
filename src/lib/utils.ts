import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Marketplace } from "@/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function detectMarketplace(url: string): Marketplace {
  const lowerUrl = url.toLowerCase()
  
  if (lowerUrl.includes('shopee')) return 'shopee'
  if (lowerUrl.includes('tokopedia')) return 'tokopedia'
  if (lowerUrl.includes('lazada')) return 'lazada'
  if (lowerUrl.includes('blibli')) return 'blibli'
  
  // Check for official brand sites (non-marketplace)
  const marketplaceDomains = ['shopee', 'tokopedia', 'lazada', 'blibli']
  const isMarketplace = marketplaceDomains.some(domain => lowerUrl.includes(domain))
  
  return isMarketplace ? 'other' : 'official'
}

export function formatCurrency(amount: number, currency: string = 'IDR'): string {
  if (currency === 'IDR') {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount)
}

export function getMarketplaceBadgeColor(marketplace: Marketplace): string {
  const colors = {
    shopee: 'bg-orange-500',
    tokopedia: 'bg-green-500',
    lazada: 'bg-blue-500',
    blibli: 'bg-red-500',
    official: 'bg-gray-500',
    other: 'bg-slate-500',
  }
  return colors[marketplace]
}

export function calculatePriceGap(current: number, target: number): number {
  if (target === 0) return 0
  return ((target - current) / target) * 100
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(date))
}

export function formatPriceHistoryDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: '2-digit' })
}

export function formatDistanceToNow(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'baru saja'
  if (diffMins < 60) return `${diffMins} menit lalu`
  if (diffHours < 24) return `${diffHours} jam lalu`
  if (diffDays === 1) return 'kemarin'
  if (diffDays < 7) return `${diffDays} hari lalu`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} minggu lalu`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} bulan lalu`
  return `${Math.floor(diffDays / 365)} tahun lalu`
}

export function formatRelativeTime(date: string): string {
  const now = new Date()
  const past = new Date(date)
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000)

  if (diffInSeconds < 60) return 'Just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)} weeks ago`
  if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} months ago`
  return `${Math.floor(diffInSeconds / 31536000)} years ago`
}

export function formatAbbreviatedCurrency(amount: number, currency: string = 'IDR'): string {
  if (amount >= 1000000) {
    return `Rp${(amount / 1000000).toFixed(1).replace('.', ',')}jt`
  }
  if (amount >= 1000) {
    return `Rp${(amount / 1000).toFixed(0)}rb`
  }
  return `Rp${amount}`
}
