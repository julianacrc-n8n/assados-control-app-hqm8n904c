import { useState, useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import {
  Croissant,
  Menu,
  Sun,
  Moon,
  LayoutDashboard,
  Package,
  ShoppingCart,
  ScanLine,
  BarChart3,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

const navItems = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Produtos', path: '/products', icon: Package },
  { label: 'Compras', path: '/purchases', icon: ShoppingCart },
  { label: 'PDV', path: '/pos', icon: ScanLine },
  { label: 'Relatórios', path: '/reports', icon: BarChart3 },
]

export default function Layout() {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark')
    }
    return false
  })

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [isDark])

  const toggleTheme = () => {
    setIsDark((prev) => !prev)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-16 border-b bg-background/95 backdrop-blur z-40 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          {/* Mobile Sheet Trigger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-11 w-11"
                aria-label="Abrir menu de navegação"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 pt-4">
              <SheetHeader className="px-4 pb-2 border-b">
                <SheetTitle className="flex items-center gap-2 font-bold text-lg">
                  <Croissant className="h-6 w-6 text-primary" />
                  <span>Assados Control</span>
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 p-3">
                {navItems.map((item) => {
                  const Icon = item.icon
                  const isActive = location.pathname === item.path
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'flex items-center gap-3 h-11 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted text-foreground',
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  )
                })}
              </nav>
            </SheetContent>
          </Sheet>

          {/* Logo & Name */}
          <Link
            to="/"
            className="flex items-center gap-2 font-bold text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md p-1"
          >
            <Croissant className="h-6 w-6 text-primary" />
            <span className="font-bold tracking-tight">Assados Control</span>
          </Link>
        </div>

        {/* Theme Toggle Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label="Alternar tema"
          className="h-11 w-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed top-16 left-0 bottom-0 w-64 border-r bg-background flex-col z-30">
        <nav className="flex flex-col gap-1 p-3">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 h-11 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted text-foreground',
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="pt-16 ml-0 md:ml-64 p-6 min-h-screen bg-background">
        <Outlet />
      </main>
    </div>
  )
}
