import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import ProductCard from '@/components/ProductCard';
import LoyaltyBadge from '@/components/LoyaltyBadge';
import AnnouncementBanner from '@/components/AnnouncementBanner';

const CATEGORIES = ['all', 'hay', 'feed', 'grain', 'supplements', 'bedding', 'equipment'];

export default function Shop() {
  const { user, isAuthenticated } = useAuth();
  const [products, setProducts] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [prods, anns] = await Promise.all([
        base44.entities.Product.filter({ is_active: true }, '-created_date', 100),
        base44.entities.Announcement.filter({ is_active: true }, '-created_date', 5),
      ]);
      setProducts(prods);
      setAnnouncements(anns);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = category === 'all' ? products : products.filter(p => p.category === category);

  return (
    <div className="space-y-4">
      {isAuthenticated && user && (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Welcome back</p>
            <p className="font-medium">{user.full_name || user.email}</p>
          </div>
          <LoyaltyBadge tier={user.loyalty_tier} points={user.loyalty_points} />
        </div>
      )}

      {announcements.length > 0 && (
        <div className="space-y-2">
          {announcements.map(a => <AnnouncementBanner key={a.id} announcement={a} />)}
        </div>
      )}

      <div>
        <h2 className="font-heading font-bold text-xl mb-1">Feed &amp; Supplies</h2>
        <p className="text-sm text-muted-foreground">Fresh stock from the yard. Browse below or scan a QR code in the barn.</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {CATEGORIES.map(c => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm whitespace-nowrap capitalize border',
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
  );
}