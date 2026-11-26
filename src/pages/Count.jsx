import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { ScanLine, Search, Trash2, Send, Camera, X, CheckCircle2, Loader2 } from 'lucide-react';

// Count screen: staff scan a Product QR (or search), type what is on the shelf,
// and send the session. The session goes to n8n through the submit-count
// function, which compares it with Shopify at Fort Myers. Nothing is saved in
// Base44; the unsent list is kept on this device only, so a dropped signal
// doesn't lose a count.

const DRAFT_KEY = 'scr-count-draft-v1';
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function readDraft() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '[]'); } catch { return []; }
}
function writeDraft(lines) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(lines)); } catch { /* storage off */ }
}

export function scanToQuery(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const m = s.match(/\/q\/([^/?#\s]+)/);
  if (m) return { id: decodeURIComponent(m[1]) };
  if (/^\d{6,}$/.test(s)) return { shopify_variant_id: s };
  return { id: s };
}

async function findProduct(raw) {
  const q = scanToQuery(raw);
  if (!q) return null;
  if (q.id) {
    try { return await base44.entities.Product.get(q.id); } catch { /* fall through */ }
    const byQr = await base44.entities.Product.filter({ qr_code_id: q.id }, 'name', 1);
    return byQr[0] || null;
  }
  const rows = await base44.entities.Product.filter(q, 'name', 1);
  return rows[0] || null;
}

function Scanner({ onCode, onClose }) {
  const videoRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let stream;
    let stopped = false;
    let timer;
    (async () => {
      if (!('BarcodeDetector' in window)) {
        setError('This phone\'s browser can\'t scan here. Use Chrome on Android, or search by name below.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (stopped) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const detector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13', 'upc_a'] });
        const tick = async () => {
          if (stopped) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length) { onCode(codes[0].rawValue); return; }
          } catch { /* frame not ready */ }
          timer = setTimeout(tick, 250);
        };
        tick();
      } catch {
        setError('Camera is blocked. Allow the camera for this site, or search by name below.');
      }
    })();
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onCode]);

  return (
    <Card className="p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Point at the item's QR code</p>
        <button onClick={onClose} aria-label="Close scanner" className="h-9 w-9 flex items-center justify-center"><X className="h-4 w-4" /></button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : (
        <video ref={videoRef} className="w-full rounded-md bg-black aspect-video object-cover" muted playsInline />
      )}
    </Card>
  );
}

export default function Count() {
  const { user, isAuthenticated } = useAuth();
  const isStaff = user && (user.role === 'admin' || user.role === 'staff');
  const [lines, setLines] = useState(readDraft);
  const [scanning, setScanning] = useState(false);
  const [current, setCurrent] = useState(null);
  const [qty, setQty] = useState('');
  const [term, setTerm] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [isTest, setIsTest] = useState(false);
  const [sent, setSent] = useState(null);
  const qtyRef = useRef(null);

  useEffect(() => { writeDraft(lines); }, [lines]);
  useEffect(() => { if (current) qtyRef.current?.focus(); }, [current]);

  const pick = (product) => {
    setResults([]); setTerm(''); setMessage(null); setSent(null);
    if (!product?.shopify_variant_id) { setMessage('That item isn\'t linked to Shopify, so it can\'t be counted yet.'); return; }
    setCurrent(product);
    const prev = lines.find((l) => l.product_id === product.id);
    setQty(prev ? String(prev.counted_qty) : '');
  };

  const onCode = async (raw) => {
    setScanning(false);
    setBusy(true);
    try {
      const product = await findProduct(raw);
      if (product) pick(product); else setMessage('That code isn\'t linked to a product.');
    } finally { setBusy(false); }
  };

  const search = async (e) => {
    e?.preventDefault();
    const t = term.trim();
    if (t.length < 2) return;
    setBusy(true);
    try {
      setResults(await base44.entities.Product.filter({ name: { $regex: escapeRegex(t), $options: 'i' } }, 'name', 15));
    } finally { setBusy(false); }
  };

  const addLine = (e) => {
    e?.preventDefault();
    const n = Number(qty);
    if (!current || qty === '' || !Number.isInteger(n) || n < 0) return;
    const line = { product_id: current.id, name: current.name, sku: current.sku || '', counted_qty: n };
    setLines((ls) => [line, ...ls.filter((l) => l.product_id !== current.id)]);
    setCurrent(null); setQty('');
  };

  const submit = async () => {
    if (!lines.length) return;
    setBusy(true); setMessage(null);
    try {
      const res = await base44.functions.invoke('submit-count', {
        is_test: isTest,
        lines: lines.map((l) => ({ product_id: l.product_id, counted_qty: l.counted_qty })),
      });
      setSent(res.data);
      setLines([]);
    } catch (err) {
      setMessage(err.response?.data?.error || 'The count did not go through. Your list is still here; try again.');
    } finally { setBusy(false); }
  };

  if (!isAuthenticated) return <div className="text-center py-20 text-muted-foreground">Sign in to count stock.</div>;
  if (!isStaff) return <div className="text-center py-20 text-muted-foreground">Staff access required.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScanLine className="h-5 w-5" />
          <h2 className="font-heading font-bold text-xl">Count stock</h2>
        </div>
        <span className="text-sm text-muted-foreground">Fort Myers</span>
      </div>

      {sent && (
        <Card className="p-4 border-green-600/40 bg-green-50 dark:bg-green-950/30">
          <div className="flex gap-2 items-start">
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Count {sent.session_code} sent{isTest ? ' (test)' : ''}.</p>
              <p>{sent.matched} matched Shopify. {sent.waiting > 0 ? `${sent.waiting} differ and are waiting for approval.` : 'Nothing needs approval.'}</p>
            </div>
          </div>
        </Card>
      )}

      {!current && (scanning ? (
        <Scanner onCode={onCode} onClose={() => setScanning(false)} />
      ) : (
        <Button className="w-full h-14 text-base" onClick={() => { setSent(null); setScanning(true); }} disabled={busy}>
          <Camera className="h-5 w-5 mr-2" /> Scan an item
        </Button>
      ))}

      {!current && (
        <form onSubmit={search} className="flex gap-2">
          <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Or search by name" className="h-11" />
          <Button type="submit" variant="outline" className="h-11" disabled={busy} aria-label="Search"><Search className="h-4 w-4" /></Button>
        </form>
      )}

      {results.length > 0 && !current && (
        <Card className="divide-y">
          {results.map((p) => (
            <button key={p.id} onClick={() => pick(p)} className="w-full text-left p-3 hover:bg-accent">
              <p className="text-sm font-medium">{p.name}</p>
              {p.sku && <p className="text-xs text-muted-foreground">{p.sku}</p>}
            </button>
          ))}
        </Card>
      )}

      {current && (
        <Card className="p-4 space-y-3">
          <div>
            <p className="font-medium">{current.name}</p>
            {current.sku && <p className="text-sm text-muted-foreground">{current.sku}</p>}
          </div>
          <form onSubmit={addLine} className="flex gap-2">
            <Input ref={qtyRef} type="number" inputMode="numeric" min="0" step="1" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="How many on the shelf?" className="h-12 text-lg" />
            <Button type="submit" className="h-12" disabled={qty === ''}>Add</Button>
          </form>
          <Button variant="ghost" className="w-full" onClick={() => { setCurrent(null); setQty(''); }}>Cancel</Button>
        </Card>
      )}

      {message && <p className="text-sm text-destructive">{message}</p>}
      {busy && <div className="flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}

      {lines.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{lines.length} item{lines.length === 1 ? '' : 's'} counted</p>
          <Card className="divide-y">
            {lines.map((l) => (
              <div key={l.product_id} className="flex items-center justify-between p-3 gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{l.name}</p>
                  {l.sku && <p className="text-xs text-muted-foreground">{l.sku}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold tabular-nums">{l.counted_qty}</span>
                  <button onClick={() => setLines((ls) => ls.filter((x) => x.product_id !== l.product_id))} aria-label={`Remove ${l.name}`} className="h-9 w-9 flex items-center justify-center text-muted-foreground">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </Card>
          <label className="flex items-center justify-between text-sm py-1">
            <span>Test count (nothing real)</span>
            <Switch checked={isTest} onCheckedChange={setIsTest} />
          </label>
          <Button className="w-full h-12" onClick={submit} disabled={busy}>
            <Send className="h-4 w-4 mr-2" /> Send count
          </Button>
        </div>
      )}
    </div>
  );
}
