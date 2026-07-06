import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { useSettings } from '@/context/SettingsContext'
import AutomationHub from './AutomationHub'
import {
  ClipboardList,
  Map,
  LayoutGrid,
  Star,
  Rocket,
  Settings,
  ChevronUp,
  User2,
  CreditCard,
  LogOut,
  Download,
  Ban,
  FileText,
  Inbox
} from 'lucide-react'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// Base menu items visible to all users
const BASE_MENU_ITEMS = [
  { path: '/app', labelKey: 'sidebar.vacancies', icon: ClipboardList },
  { path: '/app/map', labelKey: 'sidebar.demandMap', icon: Map },
  { path: '/app/cards', labelKey: 'sidebar.cards', icon: LayoutGrid },
  { path: '/app/selected', labelKey: 'sidebar.selected', icon: Star },
  { path: '/app/cv-builder', labelKey: 'sidebar.cvBuilder', icon: FileText },
  { path: '/app/applications', labelKey: 'sidebar.applications', icon: Inbox },
]

// Auto Apply is only visible to admin/owner/whitelisted users
// Backend enforces this via autoApplyGate — this is a UI complement only
const AUTO_APPLY_ITEM = { path: '/app/auto-apply', labelKey: 'sidebar.autoApply', icon: Rocket }

function canSeeAutoApply(user) {
  return user?.role === 'admin' || user?.role === 'owner'
}

export function AppSidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const { openSettings } = useSettings()
  const { state } = useSidebar()
  const isCollapsed = state === 'collapsed'

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-3">
          <Rocket className="h-7 w-7 text-blue-500" />
          {!isCollapsed && (
            <span className="font-bold text-xl">JobFinder</span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {[...BASE_MENU_ITEMS, ...(canSeeAutoApply(user) ? [AUTO_APPLY_ITEM] : [])].map((item) => {
                const isActive = location.pathname === item.path
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={t(item.labelKey)}
                      className="text-base py-3"
                    >
                      <Link to={item.path}>
                        <item.icon className="!h-5 !w-5" />
                        <span className="text-[15px]">{t(item.labelKey)}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Spacer to push AutomationHub to bottom */}
        <div className="flex-1" />

        {/* AutomationHub Section - Only visible to admin/owner */}
        {canSeeAutoApply(user) && (
          <SidebarGroup className="border-t border-sidebar-border mt-auto">
            <AutomationHub isCollapsed={isCollapsed} userId={user?.id || 1} />
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {/* Extension Download Link - admin/owner only */}
        {canSeeAutoApply(user) && (
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={location.pathname === '/app/extension'}
              tooltip={t('sidebar.getExtension')}
              className="text-base py-3"
            >
              <Link to="/app/extension">
                <Download className="!h-5 !w-5" />
                <span className="text-[15px]">{t('sidebar.getExtension')}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        )}

        {/* Settings Button */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => openSettings('general')}
              tooltip={t('sidebar.settings')}
              className="text-base py-3"
            >
              <Settings className="!h-5 !w-5" />
              <span className="text-[15px]">{t('sidebar.settings')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* User Avatar Dropdown */}
        {user && (
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground py-3"
                  >
                    <Avatar className="h-9 w-9 rounded-lg">
                      <AvatarImage src={user.picture} alt={user.name} />
                      <AvatarFallback className="rounded-lg text-sm">
                        {user.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{user.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {user.email}
                      </span>
                    </div>
                    <ChevronUp className="ml-auto size-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                  side="top"
                  align="start"
                  sideOffset={4}
                >
                  <DropdownMenuItem onClick={() => navigate('/app/profile')}>
                    <User2 className="mr-2 h-4 w-4" />
                    {t('sidebar.account')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/app/blocked-organizations')}>
                    <Ban className="mr-2 h-4 w-4" />
                    {t('blockedOrgs.menuItem')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/app/billing')}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    {t('sidebar.billing')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    {t('sidebar.signOut')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}

export default AppSidebar
