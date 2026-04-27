import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Layout, List, Settings, X } from 'lucide-react'

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: Layout },
  { name: 'Wishlist', href: '/wishlist', icon: List },
  { name: 'Settings', href: '/settings', icon: Settings },
]

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const location = useLocation()

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      <div className={cn(
        'fixed inset-y-0 left-0 z-50 w-64 border-r bg-card p-4 transition-transform duration-300 lg:translate-x-0 lg:static lg:inset-auto',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-primary">Wishlist Chart</h1>
            <p className="text-sm text-muted-foreground">Price Tracker</p>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-md hover:bg-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.href
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
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
    </>
  )
}
