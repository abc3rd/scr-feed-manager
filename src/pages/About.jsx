import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ShoppingBag } from 'lucide-react';

export default function About() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur pt-safe">
        <div className="mx-auto max-w-3xl px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-heading font-bold text-lg">
            <span className="text-primary">SCR</span> Feed
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/shop"><ShoppingBag className="h-4 w-4 mr-1" /> Shop</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 pb-24 space-y-6">
        <Link to="/" className="inline-flex items-center gap-1 min-h-11 px-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>

        <h1 className="font-heading font-bold text-3xl sm:text-4xl tracking-tight">About SCR Feed Manager</h1>

        <div className="space-y-4 text-base text-muted-foreground leading-relaxed">
          <p>
            SCR Feed Manager is a mobile-first customer app and inventory management system built for an
            agricultural feed store. It lets barn managers, farmers, and livestock owners browse hay, feed,
            grain, supplements, bedding, and equipment from their phone, place orders in seconds, and pay
            securely with Stripe — all without leaving the yard.
          </p>
          <p>
            What sets SCR Feed Manager apart is its two-step, verified fulfillment process. Every order
            generates a pick ticket that yard workers physically count and confirm before any stock is
            deducted. That means inventory always reflects what is actually on the shelf, customers are
            never charged for product that is not there, and fulfillment progress is visible in real time.
            In-barn QR scanning lets staff jump straight to a product, and the SCR Stars Club rewards
            repeat buyers with tier-based discounts that grow with every dollar spent.
          </p>
          <p>
            The app is designed for the people who keep a barn running — the barn manager ordering a week of
            grain, the horse owner picking up a few bales, the yard team pulling and verifying each line
            item, and the store owner watching stock move. It is built to work the way a real feed store
            works: fast from a phone, accurate at the shelf, and trusted by the community it serves.
          </p>
          <p>
            SCR Feed Manager is built and operated by the SCR Feed store team, a local agricultural supply
            business focused on bringing modern, reliable ordering tools to the farms and barns in its
            area. We are continuously improving the platform based on feedback from the customers and yard
            staff who use it every day.
          </p>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row gap-3">
          <Button size="lg" asChild>
            <Link to="/shop">Browse Products <ShoppingBag className="h-4 w-4 ml-1" /></Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/contact">Contact Us</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}