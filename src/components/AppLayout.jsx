import React, { useState, Suspense } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingBag, ShoppingCart, Package, ClipboardCheck, LogOut, Settings, ArrowLeft } from 'lucide-react';
import { useCart } from '@/lib/CartContext';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export default function AppLayout() {
  const { count } = useCart();
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isStaff = user && (user.role === 'admin' || user.role === 'staff');

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await base44.functions.invoke('delete-account', {});
      setConfirmOpen(false);
      setSettingsOpen(false);
      toast({ title: 'Account deleted', description: 'Your account and data have been removed. Signing you out…' });
      setTimeout(() => logout(true), 600);
    } catch (err) {
      toast({ title: 'Deletion failed', description: err.response?.data?.error || err.message, variant: 'destructive' });
      setDeleting(false);
    }
  };

  const navItems = [
    { to: '/shop', label: 'Shop', icon: ShoppingBag, exact: true },
    { to: '/cart', label: 'Cart', icon: ShoppingCart, badge: count },
    { to: '/orders', label: 'Orders', icon: Package },
  ];
  if (isStaff) {
    navItems.push({ to: '/fulfillment', label: 'Fulfill', icon: ClipboardCheck });
  }

  const isActive = (item) =>
    item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);

  const showBack = location.pathname !== '/' && !navItems.some((item) => item.to === location.pathname);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur pt-safe">
        <div className="mx-auto max-w-2xl flex items-center justify-between px-4 h-14">
          {showBack ? (
            <button onClick={() => navigate(-1)} className="flex items-center text-muted-foreground hover:text-foreground" aria-label="Go back">
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <Link to="/" className="flex items-center gap-2 font-heading font-bold text-lg">
              <span className="text-primary">SCR</span> Feed
            </Link>
          )}
          <div className="flex items-center gap-3">
            {isAuthenticated && user && (
              <span className="text-xs text-muted-foreground hidden sm:inline">{user.email}</span>
            )}
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <button onClick={() => setSettingsOpen(true)} className="h-11 w-11 flex items-center justify-center text-muted-foreground hover:text-foreground" aria-label="Settings">
                  <Settings className="h-4 w-4" />
                </button>
                <button onClick={() => logout()} className="h-11 w-11 flex items-center justify-center text-muted-foreground hover:text-foreground" aria-label="Sign out">
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <Link to="/login" className="text-sm text-primary hover:underline">Sign in</Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-2xl px-4 py-4 pb-24">
        <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="w-7 h-7 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>}>
          <Outlet />
        </Suspense>
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-30 border-t bg-background/95 backdrop-blur pb-safe">
        <div className="mx-auto max-w-2xl flex items-stretch justify-around h-16 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-0.5 flex-1 text-sm',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
                {item.badge > 0 && (
                  <span className="absolute top-1 right-1/3 bg-primary text-primary-foreground text-sm rounded-full h-5 min-w-5 px-1.5 flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Account</DialogTitle>
            <DialogDescription>Manage your account settings.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1 py-2">
            <p className="text-sm text-muted-foreground">Signed in as</p>
            <p className="font-medium">{user?.full_name || 'Member'}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="destructive" onClick={() => setConfirmOpen(true)}>Delete Account</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete account?</DialogTitle>
            <DialogDescription>Are you absolutely sure you want to permanently delete your account? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2 gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteAccount} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Yes, delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}