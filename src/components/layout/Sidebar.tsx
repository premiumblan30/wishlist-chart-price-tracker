import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Layout, List, Settings } from 'lucide-react'

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: Layout },
  { name: 'Wishlist', href: '/wishlist', icon: List },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const location = useLocation()

  return (
    <div className="w-64 border-r bg-card min-h-screen p-4">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-primary">Wishlist Chart</h1>
        <p className="text-sm text-muted-foreground">Price Tracker</p>
      </div>
      <nav className="space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.href
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-2 rounded-lg transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.name}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
