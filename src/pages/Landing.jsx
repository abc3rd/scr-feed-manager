import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Image } from '@/components/ui/image';
import {
  ShoppingBag, ShoppingCart, Star, QrCode, ClipboardCheck, Package,
  Bell, ArrowRight, Check, Truck, ShieldCheck,
} from 'lucide-react';

const HERO_IMG = 'https://images.unsplash.com/photo-1691002188941-baef50d5f661?auto=format&fit=crop&w=1400&q=80';

const FEATURES = [
  {
    icon: ShoppingBag,
    title: 'Browse & Order',
    desc: 'Shop hay, feed, grain, supplements, bedding and equipment from your phone — anytime, with live stock levels.',
  },
  {
    icon: ShoppingCart,
    title: 'Secure Checkout',
    desc: 'Pay safely with Stripe. Tier-based loyalty discounts apply automatically at checkout.',
  },
  {
    icon: ClipboardCheck,
    title: 'Two-Step Fulfillment',
    desc: 'Every order generates a pick ticket. Yard workers verify physical counts before stock is ever deducted.',
  },
  {
    icon: Package,
    title: 'Live Order Tracking',
    desc: 'Watch fulfillment progress in real time — see exactly how many units are picked out of your order.',
  },
  {
    icon: Star,
    title: 'SCR Stars Club',
    desc: 'Earn a point per dollar spent. Climb Bronze → Silver → Gold → Platinum and unlock bigger discounts.',
  },
  {
    icon: QrCode,
    title: 'In-Barn QR Scanning',
    desc: 'Scan a QR sticker on any shelf to jump straight to that product and add it to your cart.',
  },
];

const STEPS = [
  { n: '01', title: 'Place Your Order', desc: 'Browse the catalog, add items to your cart, and check out in seconds.' },
  { n: '02', title: 'Yard Picks & Verifies', desc: 'A pick ticket is created. Our yard team physically counts and verifies each line item.' },
  { n: '03', title: 'Stock Deducted & Points Awarded', desc: 'Inventory is adjusted only after verification, and loyalty points credit when your order is fully fulfilled.' },
];

const TIERS = [
  { name: 'Bronze', points: '0+', perk: 'Entry tier', discount: '—' },
  { name: 'Silver', points: '500+', perk: '5% off every order', discount: '5%' },
  { name: 'Gold', points: '1,000+', perk: '10% off every order', discount: '10%' },
  { name: 'Platinum', points: '2,000+', perk: '15% off every order', discount: '15%' },
];

const TIER_STYLES = {
  Bronze: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  Silver: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-200',
  Gold: 'border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300',
  Platinum: 'border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300',
};

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-heading font-bold text-lg">
            <span className="text-primary">SCR</span> Feed
          </div>
          <nav className="hidden sm:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#how-it-works" className="hover:text-foreground">How It Works</a>
            <a href="#loyalty" className="hover:text-foreground">Loyalty</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">Sign In</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/shop">Shop Now</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <Image src={HERO_IMG} alt="Hay bales in a field" className="h-full w-full" fittingType="fill" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/60 to-background" />
        </div>
        <div className="relative mx-auto max-w-5xl px-4 py-20 sm:py-28 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/80 px-3 py-1 text-xs font-medium backdrop-blur">
            <Bell className="h-3 w-3" /> Fresh stock from the yard, daily
          </span>
          <h1 className="mt-6 font-heading font-bold text-4xl sm:text-6xl tracking-tight">
            Feed &amp; supplies,<br />picked and verified.
          </h1>
          <p className="mt-5 mx-auto max-w-xl text-lg text-muted-foreground">
            SCR Feed Manager is your mobile-first feed store — order hay, grain, and supplements,
            track fulfillment in real time, and earn rewards with every purchase.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link to="/shop">Browse Products <ArrowRight className="h-4 w-4 ml-1" /></Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/register">Create an account</Link>
            </Button>
          </div>
          <div className="mt-8 flex items-center justify-center gap-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" /> Secure payments</span>
            <span className="flex items-center gap-1.5"><Truck className="h-4 w-4" /> Verified pickup</span>
            <span className="flex items-center gap-1.5"><Star className="h-4 w-4" /> Loyalty rewards</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-5xl px-4 py-16">
        <div className="text-center mb-10">
          <h2 className="font-heading font-bold text-3xl">Everything the barn needs</h2>
          <p className="mt-2 text-muted-foreground">A complete ordering, fulfillment, and rewards system in your pocket.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(f => {
            const Icon = f.icon;
            return (
              <Card key={f.title} className="p-5">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-medium">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </Card>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-muted/40 border-y">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <div className="text-center mb-10">
            <h2 className="font-heading font-bold text-3xl">How fulfillment works</h2>
            <p className="mt-2 text-muted-foreground">Stock is only deducted once a yard worker verifies your order — never before.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {STEPS.map(s => (
              <div key={s.n} className="relative">
                <span className="font-heading font-bold text-5xl text-primary/15">{s.n}</span>
                <h3 className="mt-2 font-medium text-lg">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex items-start gap-2 rounded-lg border bg-background p-4 text-sm">
            <Check className="h-4 w-4 mt-0.5 text-green-600 shrink-0" />
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Why two steps?</span> Reserving stock at checkout
              can over-promise when barn counts differ from the system. By verifying physically first, your
              order reflects exactly what's on the shelf — and you're never charged for stock that isn't there.
            </p>
          </div>
        </div>
      </section>

      {/* Loyalty */}
      <section id="loyalty" className="mx-auto max-w-5xl px-4 py-16">
        <div className="text-center mb-10">
          <h2 className="font-heading font-bold text-3xl">SCR Stars Club</h2>
          <p className="mt-2 text-muted-foreground">Earn a point for every dollar. Climb tiers for bigger discounts.</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {TIERS.map(t => (
            <Card key={t.name} className="p-5 text-center">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium ${TIER_STYLES[t.name]}`}>
                <Star className="h-3 w-3 fill-current" /> {t.name}
              </span>
              <p className="mt-3 font-heading font-bold text-2xl">{t.discount}</p>
              <p className="mt-1 text-sm font-medium">{t.perk}</p>
              <p className="mt-2 text-xs text-muted-foreground">{t.points} lifetime points</p>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-4 pb-16">
        <div className="rounded-2xl bg-primary text-primary-foreground p-8 sm:p-12 text-center">
          <h2 className="font-heading font-bold text-3xl">Ready to stock up?</h2>
          <p className="mt-2 text-primary-foreground/80">Browse the catalog and place your first order in minutes.</p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" variant="secondary" asChild>
              <Link to="/shop">Start Shopping <ArrowRight className="h-4 w-4 ml-1" /></Link>
            </Button>
            <Button size="lg" variant="outline" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10" asChild>
              <Link to="/register">Join the Stars Club</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="mx-auto max-w-5xl px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 font-heading font-bold text-foreground">
            <span className="text-primary">SCR</span> Feed
          </div>
          <p>© {new Date().getFullYear()} SCR Feed Manager. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link to="/shop" className="hover:text-foreground">Shop</Link>
            <Link to="/login" className="hover:text-foreground">Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}