import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import ProductCard from '@/components/ProductCard';
import TrendingNow from '@/components/TrendingNow';
import LoyaltyBadge from '@/components/LoyaltyBadge';
import LoyaltyProgress from '@/components/LoyaltyProgress';
import AnnouncementBanner from '@/components/AnnouncementBanner';
import PullToRefresh from '@/components/PullToRefresh';
import { RotateCw } from 'lucide-react';

const CATEGORIES = ['all', 'hay', 'feed', 'grain', 'supplements', 'bedding', 'equipment'];

export default function Shop() {
  const { user, isAuthenticated } = useAuth();
  const [category, setCategory] = useState('all');

  const productsQuery = useQuery({
    queryKey: ['products', 'active'],
    queryFn: () => base44.entities.Product.filter({ is_active: true }, '-created_date', 100),
  });
  const announcementsQuery = useQuery({
    queryKey: ['announcements', 'active'],
    queryFn: () => base44.entities.Announcement.filter({ is_active: true }, '-created_date', 5),
  });
  const trendingQuery = useQuery({
    queryKey: ['trending-products'],
    queryFn: async () => (await base44.functions.invoke('trending-products', {})).data,
    staleTime: 5 * 60 * 1000,
  });

  const products = productsQuery.data || [];
  const announcements = announcementsQuery.data || [];
  const loading = productsQuery.isLoading;
  const refreshing = productsQuery.isFetching || announcementsQuery.isFetching;

  const refresh = () => Promise.all([productsQuery.refetch(), announcementsQuery.refetch(), trendingQuery.refetch()]);

  const filtered = category === 'all' ? products : products.filter(p => p.category === category);

  return (
    <PullToRefresh onRefresh={refresh}>
    <div className="space-y-4">
      {isAuthenticated && user && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Welcome back</p>
              <p className="font-medium">{user.full_name || user.email}</p>
            </div>
            <LoyaltyBadge tier={user.loyalty_tier} points={user.loyalty_points} />
          </div>
          <LoyaltyProgress lifetimePoints={user.lifetime_points} tier={user.loyalty_tier} />
        </div>
      )}

      {announcements.length > 0 && (
        <div className="space-y-2">
          {announcements.map(a => <AnnouncementBanner key={a.id} announcement={a} />)}
        </div>
      )}

      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-heading font-bold text-xl mb-1">Feed &amp; Supplies</h2>
          <p className="text-sm text-muted-foreground">Fresh stock from the yard. Browse below or scan a QR code in the barn.</p>
        </div>
        <button onClick={refresh} className="h-11 w-11 flex items-center justify-center text-muted-foreground hover:text-foreground" aria-label="Refresh products">
          <RotateCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
        </button>
      </div>

      <TrendingNow products={products} trending={trendingQuery.data?.trending} />

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {CATEGORIES.map(c => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={cn(
              'px-3 py-2 min-h-11 rounded-full text-sm whitespace-nowrap capitalize border',
              category === c
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border text-muted-foreground'
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No products in this category.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map(p => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
    </PullToRefresh>
  );
}