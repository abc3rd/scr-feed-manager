import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Mail, MapPin, Phone } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function Contact() {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await base44.integrations.Core.SendEmail({
        to: 'hello@scrfeed.com',
        subject: `Contact form message from ${name || 'a visitor'}`,
        body: `Name: ${name}\nEmail: ${email}\n\n${message}`,
      });
      toast({ title: 'Message sent', description: 'Thanks for reaching out — we will get back to you shortly.' });
      setName(''); setEmail(''); setMessage('');
    } catch (err) {
      toast({ title: 'Could not send', description: err.message || 'Please try again later.', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur pt-safe">
        <div className="mx-auto max-w-3xl px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-heading font-bold text-lg">
            <span className="text-primary">SCR</span> Feed
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/shop">Shop</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 pb-24 space-y-8">
        <Link to="/" className="inline-flex items-center gap-1 min-h-11 px-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>

        <div className="space-y-2">
          <h1 className="font-heading font-bold text-3xl sm:text-4xl tracking-tight">Contact Us</h1>
          <p className="text-muted-foreground">
            Questions about an order, a product, or the Stars Club? Reach the SCR Feed team directly.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <Mail className="h-5 w-5 text-primary" />
            <p className="text-sm font-medium">Email</p>
            <a href="mailto:hello@scrfeed.com" className="text-sm text-muted-foreground hover:text-foreground">hello@scrfeed.com</a>
          </div>
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <Phone className="h-5 w-5 text-primary" />
            <p className="text-sm font-medium">Phone</p>
            <a href="tel:+15551234567" className="text-sm text-muted-foreground hover:text-foreground">(555) 123-4567</a>
          </div>
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <MapPin className="h-5 w-5 text-primary" />
            <p className="text-sm font-medium">Visit the yard</p>
            <p className="text-sm text-muted-foreground">123 Feed Mill Rd, Farm Town</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="rounded-lg border bg-card p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="How can we help?" rows={5} required />
          </div>
          <Button type="submit" className="w-full" disabled={sending}>
            {sending ? 'Sending…' : 'Send Message'}
          </Button>
        </form>
      </main>
    </div>
  );
}