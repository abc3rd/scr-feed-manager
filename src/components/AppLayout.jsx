import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { ShoppingBag, ShoppingCart, Package, ClipboardCheck, LogOut } from 'lucide-react';
import { useCart } from '@/lib/CartContext';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';

export default function AppLayout() {
  const { count } = useCart();
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const isStaff = user && (user.role === 'admin' || user.role === 'staff');

  const navItems = [
    { to: '/', label: 'Shop', icon: ShoppingBag, exact: true },
    { to: '/cart', label: 'Cart', icon: ShoppingCart, badge: count },
    { to: '/orders', label: 'Orders', icon: Package },
  ];
  if (isStaff) {
    navItems.push({ to: '/fulfillment', label: 'Fulfill', icon: ClipboardCheck });
  }

  const isActive = (item) =>
    item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-2xl flex items-center justify-between px-4 h-14">
          <Link to="/" className="flex items-center gap-2 font-heading font-bold text-lg">
            <span className="text-primary">SCR</span> Feed
          </Link>
          <div className="flex items-center gap-3">
            {isAuthenticated && user && (
              <span className="text-xs text-muted-foreground hidden sm:inline">{user.email}</span>
            )}
            {isAuthenticated ? (
              <button onClick={() => logout()} className="text-muted-foreground hover:text-foreground" aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </button>
            ) : (
              <Link to="/login" className="text-sm text-primary hover:underline">Sign in</Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-2xl px-4 py-4 pb-24">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-30 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-2xl flex items-stretch justify-around h-16 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-0.5 flex-1 text-xs',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
                {item.badge > 0 && (
                  <span className="absolute top-1 right-1/3 bg-primary text-primary-foreground text-[10px] rounded-full h-4 min-w-4 px-1 flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}