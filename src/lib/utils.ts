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
    year: 'numeric'
  }).format(new Date(date))
}

export function formatPriceHistoryDate(date: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short'
  }).format(new Date(date))
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
