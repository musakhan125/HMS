import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, Users, DoorOpen, CreditCard, CalendarCheck,
  Receipt, BarChart3, Settings, LogOut, Menu, X, Building2, ChevronLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/tenants', icon: Users, label: 'Hostelites' },
  { to: '/rooms', icon: DoorOpen, label: 'Rooms' },
  { to: '/payments', icon: CreditCard, label: 'Payments' },
  { to: '/rent-tracker', icon: CalendarCheck, label: 'Rent Tracker' },
  { to: '/expenses', icon: Receipt, label: 'Expenses' },
  { to: '/reports', icon: BarChart3, label: 'Reports', ownerOnly: true },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

interface SidebarProps {
  collapsed?: boolean;
  setCollapsed?: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
}

export default function Sidebar({ collapsed: controlledCollapsed, setCollapsed: controlledSetCollapsed }: SidebarProps = {}) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;
  const setCollapsed = controlledSetCollapsed || setInternalCollapsed;

  const [mobileOpen, setMobileOpen] = useState(false);
  const { profile, hostel, signOut, isOwner } = useAuth();
  const location = useLocation();

  const filteredNav = navItems.filter(item => !item.ownerOnly || isOwner);

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : profile?.email?.slice(0, 2).toUpperCase() || '??';

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={cn(
        "flex items-center py-5 transition-all relative",
        collapsed ? "justify-center px-0" : "justify-between px-4 gap-3"
      )}>
        <div className={cn("flex items-center min-w-0", collapsed ? "justify-center w-full" : "gap-3 flex-1")}>
          <div
            className={cn(
              "flex items-center justify-center w-9 h-9 rounded-lg gradient-primary text-white font-bold text-sm shrink-0 shadow-sm",
              collapsed && "cursor-pointer hover:opacity-90 transition-transform hover:scale-105"
            )}
            onClick={() => collapsed && setCollapsed(false)}
            title={collapsed ? "Click to expand sidebar" : hostel?.name || 'Hostel Manager'}
          >
            <Building2 className="w-5 h-5" />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-sm truncate">{hostel?.name || 'Hostel Manager'}</h1>
              <p className="text-xs text-muted-foreground truncate">Management System</p>
            </div>
          )}
        </div>

        {!collapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:flex shrink-0 h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => setCollapsed(true)}
            title="Collapse sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Separator />

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-3">
        <nav className="flex flex-col gap-1">
          {filteredNav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                  "hover:bg-accent hover:text-accent-foreground",
                  isActive
                    ? "bg-primary/10 text-primary dark:bg-primary/20"
                    : "text-muted-foreground",
                  collapsed && "justify-center px-2"
                )
              }
            >
              <Icon className="h-4.5 w-4.5 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>
      </ScrollArea>

      <Separator />

      {/* User info & sign out */}
      <div className={cn("p-3", collapsed && "px-2")}>
        <div className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2",
          collapsed && "justify-center px-2"
        )}>
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{profile?.full_name || profile?.email}</p>
              <p className="text-xs text-muted-foreground capitalize">{profile?.role}</p>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          className={cn("w-full mt-1 text-muted-foreground hover:text-destructive", collapsed && "w-9")}
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Sign Out</span>}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-3 left-3 z-50 lg:hidden"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-background border-r transform transition-transform duration-300 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-3 right-3"
          onClick={() => setMobileOpen(false)}
        >
          <X className="h-4 w-4" />
        </Button>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 bg-background border-r transition-all duration-300 z-30",
          collapsed ? "lg:w-16" : "lg:w-64"
        )}
      >
        {collapsed && (
          <Button
            variant="outline"
            size="icon"
            className="hidden lg:flex absolute -right-3 top-6 z-50 h-6 w-6 rounded-full bg-background border shadow-md text-muted-foreground hover:text-foreground hover:bg-accent p-0 items-center justify-center cursor-pointer"
            onClick={() => setCollapsed(false)}
            title="Expand sidebar"
          >
            <ChevronLeft className="h-3.5 w-3.5 rotate-180" />
          </Button>
        )}
        {sidebarContent}
      </aside>
    </>
  );
}
