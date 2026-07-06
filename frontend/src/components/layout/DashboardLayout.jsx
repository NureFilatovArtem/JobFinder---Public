import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { User2, CreditCard, LogOut, Ban } from 'lucide-react'

import { useAuth } from '@/context/AuthContext'
import { AppSidebar } from '@/components/app-sidebar'
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'

export default function DashboardLayout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user, loading, logout } = useAuth()

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/app':
        return t('nav.dashboard') || 'Dashboard'
      case '/app/map':
        return t('nav.map') || 'Map'
      case '/app/cards':
        return t('nav.swipe') || 'Swipe Cards'
      case '/app/selected':
        return t('nav.selected') || 'Selected Jobs'
      case '/app/profile':
        return t('nav.profile') || 'Profile'
      case '/app/auto-apply':
        return 'Auto Apply'
      case '/app/cv-builder':
        return 'CV Builder'
      case '/app/applications':
        return t('applicationsHub.title') || 'Applications Hub'
      case '/app/blocked-organizations':
        return t('blockedOrgs.title') || 'Blocked Organizations'
      default:
        return t('nav.dashboard') || 'Dashboard'
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {/* Global Header */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4 bg-background/50 backdrop-blur-sm">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="font-medium text-sm text-muted-foreground">
            {getPageTitle()}
          </div>
          <div className="ml-auto flex items-center gap-3">
            {loading ? (
              <div className="w-8 h-8 bg-muted rounded-full animate-pulse" />
            ) : user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <span className="text-sm font-medium hidden md:block">
                      {user.name}
                    </span>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.picture} alt={user.name} />
                      <AvatarFallback>
                        {user.name?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => navigate('/app/profile')}>
                    <User2 className="mr-2 h-4 w-4" />
                    Account
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/app/blocked-organizations')}>
                    <Ban className="mr-2 h-4 w-4" />
                    {t('blockedOrgs.menuItem')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/app/billing')}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Billing
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-4 lg:p-8 bg-gradient-to-b from-background to-muted/20">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
