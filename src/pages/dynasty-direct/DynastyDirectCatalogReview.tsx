import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, Loader2, ShieldAlert, Sparkles, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PriceResearch {
  amazon_price?: number;
  walmart_price?: number;
  competitor_avg?: number;
  suggested_store_price?: number;
  suggested_retail_price?: number;
  store_margin_pct?: number;
  retail_margin_pct?: number;
  pricing_notes?: string;
  cost_basis?: number;
}

interface PendingDraft {
  id: string;
  product_name: string;
  supplier_id: string | null;
  created_by: string | null;
  created_at: string;
  cost: number | null;
  selected: any;
  copy: any;
  pricing: any;
  price_research: PriceResearch | null;
  weight_oz: number | null;
  dimensions: any;
  measurements_verified_at: string | null;
  label_photo_url?: string | null;
  image_variants?: any;
  no_printed_label?: boolean | null;
  supplier_name?: string;
}

interface PriceOverrides {
  store?: string;
  retail?: string;
  cost?: string;
}

function pct(cost: number, price: number): number {
  if (!price || price <= 0) return 0;
  return Math.round(((price - cost) / price) * 1000) / 10;
}

export default function DynastyDirectCatalogReview() {
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<PendingDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [overrides, setOverrides] = useState<Record<string, PriceOverrides>>({});
  const [researchingId, setResearchingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    // ADMIN READ PATH: raw dd_catalog_drafts SELECT is revoked from authenticated.
    // Admin/owner reads go through the role-gated dd_admin_catalog_drafts view.
    const { data, error } = await (supabase as any)
      .from('dd_admin_catalog_drafts')
      .select('id, product_name, supplier_id, created_by, created_at, cost, selected, copy, pricing, price_research, weight_oz, dimensions, measurements_verified_at, label_photo_url, image_variants, no_printed_label')
      .eq('status', 'pending_admin_review')
      .order('created_at', { ascending: false });
    if (error) { toast.error(error.message); setLoading(false); return; }
    const rows = (data || []) as unknown as PendingDraft[];

    const ids = Array.from(new Set(rows.map((r) => r.supplier_id).filter(Boolean) as string[]));
    if (ids.length) {
      const { data: ws } = await supabase
        .from('wholesaler_profiles')
        .select('id, company_name')
        .in('id', ids);
      const map = new Map((ws || []).map((w: any) => [w.id, w.company_name]));
      rows.forEach((r) => { r.supplier_name = r.supplier_id ? map.get(r.supplier_id) || '(unknown)' : '(none)'; });
    }

    // Seed editable price overrides from price_research → pricing → cost
    const seed: Record<string, PriceOverrides> = {};
    rows.forEach((r) => {
      const pr = r.price_research || {};
      const px = r.pricing || {};
      seed[r.id] = {
        store: String(pr.suggested_store_price ?? px.suggested_store ?? ''),
        retail: String(pr.suggested_retail_price ?? px.suggested_retail ?? ''),
        cost: String(r.cost ?? pr.cost_basis ?? ''),
      };
    });
    setOverrides(seed);
    setDrafts(rows);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function runResearch(draft: PendingDraft) {
    setResearchingId(draft.id);
    try {
      const { data, error } = await supabase.functions.invoke('dd-catalog-pipeline', {
        body: {
          mode: 'price_research',
          draft_id: draft.id,
          product_name: draft.copy?.title || draft.product_name,
          category: draft.copy?.category_guess || null,
          supplier_cost: draft.cost ?? 0,
        },
      });
      if (error) throw error;
      if (!(data as any)?.ok) throw new Error((data as any)?.error || 'price research failed');
      toast.success('Pricing intelligence refreshed');
      await load();
    } catch (e: any) {
      toast.error(`Research failed: ${e.message}`);
    } finally {
      setResearchingId(null);
    }
  }

  async function approve(draft: PendingDraft) {
    if (!draft.supplier_id) { toast.error('Cannot approve: no wholesaler attached'); return; }
    const ov = overrides[draft.id] || {};
    const storeP = Number(ov.store) || Number(draft.pricing?.suggested_store) || 0;
    const retailP = Number(ov.retail) || Number(draft.pricing?.suggested_retail) || 0;
    const costP = Number(ov.cost) || Number(draft.cost) || 0;
    setBusyId(draft.id);
    try {
      // Persist edited prices back to the draft so publish picks them up.
      const newPricing = {
        ...(draft.pricing || {}),
        suggested_store: storeP,
        suggested_retail: retailP,
      };
      const upd: any = { pricing: newPricing };
      if (costP > 0) upd.cost = costP;
      const { error: uErr } = await supabase.from('dd_catalog_drafts').update(upd).eq('id', draft.id);
      if (uErr) throw uErr;

      const { data: userRes } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke('dd-catalog-pipeline', {
        body: { mode: 'publish', draft_id: draft.id, confirmed_by: userRes.user?.id ?? null },
      });
      if (error) throw error;
      if (!(data as any)?.ok) throw new Error((data as any)?.error || 'publish failed');
      toast.success(`Approved → live · product ${(data as any).product_id?.slice(0, 8)}`);
      await load();
    } catch (e: any) {
      toast.error(`Approve failed: ${e.message}`);
    } finally { setBusyId(null); }
  }

  async function reject(draft: PendingDraft) {
    const reason = (rejectNotes[draft.id] || '').trim();
    if (!reason) { toast.error('Add a reason before rejecting'); return; }
    setBusyId(draft.id);
    try {
      const { error } = await supabase
        .from('dd_catalog_drafts')
        .update({ status: 'rejected', notes: reason })
        .eq('id', draft.id);
      if (error) throw error;
      toast.success('Returned to wholesaler with reason');
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusyId(null); }
  }

  function updateOverride(id: string, patch: Partial<PriceOverrides>) {
    setOverrides((s) => ({ ...s, [id]: { ...s[id], ...patch } }));
  }

  return (
    <div className="min-h-screen bg-background p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dynasty-direct')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Dynasty Direct
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-primary" /> Catalog Review Queue
          </h1>
          <p className="text-sm text-muted-foreground">Wholesaler self-serve submissions waiting on David's exactness gate.</p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading queue…</div>
      )}

      {!loading && drafts.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Queue is empty.</CardContent></Card>
      )}

      <div className="space-y-4">
        {drafts.map((d) => {
          const hero = Array.isArray(d.selected) && d.selected[0]
            ? (typeof d.selected[0] === 'string' ? d.selected[0] : d.selected[0]?.url)
            : null;
          const ov = overrides[d.id] || {};
          const liveCost = Number(ov.cost) || 0;
          const liveStore = Number(ov.store) || 0;
          const liveRetail = Number(ov.retail) || 0;
          const liveStoreMargin = pct(liveCost, liveStore);
          const liveRetailMargin = pct(liveCost, liveRetail);
          const pr = d.price_research;
          return (
            <Card key={d.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="flex items-center gap-2">
                    {d.product_name}
                    <Badge variant={d.supplier_id ? 'default' : 'destructive'} className="text-xs">
                      {d.supplier_name || '(no wholesaler)'}
                    </Badge>
                  </span>
                  <span className="text-xs text-muted-foreground font-normal">
                    submitted {new Date(d.created_at).toLocaleString()}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-4">
                  {hero ? (
                    <img src={hero} alt="" className="w-40 h-40 object-contain bg-muted rounded border" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-40 h-40 bg-muted rounded border flex items-center justify-center text-xs text-muted-foreground">no hero</div>
                  )}
                  <div className="space-y-2 text-sm">
                    <div className="font-medium">{d.copy?.title || d.product_name}</div>
                    <div className="text-muted-foreground">{d.copy?.short_description}</div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant={d.measurements_verified_at ? 'default' : 'destructive'}>
                        {d.measurements_verified_at ? 'measurements ✓' : 'measurements unverified'}
                      </Badge>
                      {d.weight_oz != null && <Badge variant="outline">{d.weight_oz} oz</Badge>}
                    </div>
                    <code className="text-[10px] text-muted-foreground">draft {d.id.slice(0, 8)} · wholesaler {d.supplier_id?.slice(0, 8) || '—'}</code>
                  </div>
                </div>

                {/* ORGANISED PHOTOS — storefront gallery order, label kept separate */}
                {(() => {
                  const sel = Array.isArray(d.selected) ? d.selected : [];
                  const norm = sel.map((s: any) => (typeof s === 'string' ? { url: s } : s)).filter((s: any) => s?.url);
                  const gallery = norm.filter((s: any) => s.role !== 'label' && s.url !== d.label_photo_url);
                  const retry = Array.isArray(d.image_variants)
                    ? (d.image_variants as any[]).some((v: any) => v?.retry)
                    : false;
                  if (!gallery.length && !d.label_photo_url) return null;
                  return (
                    <div className="border rounded-lg p-3 space-y-2">
                      <div className="text-xs font-semibold flex items-center gap-2">
                        Storefront gallery ({gallery.length})
                        {retry && <Badge variant="destructive" className="text-[10px]">image cleanup needs retry</Badge>}
                        {d.no_printed_label && <Badge variant="outline" className="text-[10px]">no printed label</Badge>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {gallery.map((s: any, i: number) => (
                          <div key={s.url} className="relative">
                            <img src={s.url} alt="" className="h-20 w-20 object-contain bg-muted rounded border" referrerPolicy="no-referrer" />
                            <span className="absolute bottom-0 left-0 rounded-tr bg-background/90 px-1 text-[9px]">
                              {i === 0 ? 'primary' : (s.role || 'angle')}
                            </span>
                          </div>
                        ))}
                      </div>
                      {d.label_photo_url && (
                        <div className="pt-1">
                          <div className="text-[10px] text-muted-foreground mb-1">Label — reference only, never shown on the storefront</div>
                          <img src={d.label_photo_url} alt="" className="h-20 w-20 object-contain bg-muted rounded border opacity-80" referrerPolicy="no-referrer" />
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* PRICING INTELLIGENCE */}
                <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="font-semibold flex items-center gap-2">💰 Pricing Intelligence</div>
                    <Button size="sm" variant="outline" disabled={researchingId === d.id} onClick={() => runResearch(d)}>
                      {researchingId === d.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                      {pr ? 'Re-research' : 'Run AI research'}
                    </Button>
                  </div>

                  {pr ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div>
                        <div className="text-muted-foreground mb-1">Competitor Prices</div>
                        <div>Amazon avg: <span className="font-mono">${(pr.amazon_price ?? 0).toFixed(2)}</span></div>
                        <div>Walmart avg: <span className="font-mono">${(pr.walmart_price ?? 0).toFixed(2)}</span></div>
                        <div>Market avg: <span className="font-mono">${(pr.competitor_avg ?? 0).toFixed(2)}</span></div>
                      </div>
                      <div>
                        <div className="text-muted-foreground mb-1">AI Suggested Prices</div>
                        <div>Store: <span className="font-mono">${(pr.suggested_store_price ?? 0).toFixed(2)}</span> <span className="text-muted-foreground">({pr.store_margin_pct ?? 0}% margin)</span></div>
                        <div>Retail: <span className="font-mono">${(pr.suggested_retail_price ?? 0).toFixed(2)}</span> <span className="text-muted-foreground">({pr.retail_margin_pct ?? 0}% margin)</span></div>
                      </div>
                      {pr.pricing_notes && (
                        <div className="md:col-span-2 text-muted-foreground italic">"{pr.pricing_notes}"</div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No research yet — click <em>Run AI research</em> to fetch competitive pricing.</p>
                  )}

                  <Separator />

                  {/* Editable price overrides */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Supplier Cost ($)</Label>
                      <Input type="number" step="0.01" value={ov.cost ?? ''} onChange={(e) => updateOverride(d.id, { cost: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">Store Price ($)</Label>
                      <Input type="number" step="0.01" value={ov.store ?? ''} onChange={(e) => updateOverride(d.id, { store: e.target.value })} />
                      <div className="text-[11px] text-muted-foreground mt-1">Margin: <span className="font-mono">{liveStoreMargin}%</span></div>
                    </div>
                    <div>
                      <Label className="text-xs">Retail Price ($)</Label>
                      <Input type="number" step="0.01" value={ov.retail ?? ''} onChange={(e) => updateOverride(d.id, { retail: e.target.value })} />
                      <div className="text-[11px] text-muted-foreground mt-1">Margin: <span className="font-mono">{liveRetailMargin}%</span></div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 border-t pt-3">
                  <Textarea
                    placeholder="Rejection reason (sent back to wholesaler)…"
                    value={rejectNotes[d.id] || ''}
                    onChange={(e) => setRejectNotes((s) => ({ ...s, [d.id]: e.target.value }))}
                    rows={2}
                  />
                  <div className="flex gap-2 items-end">
                    <Button variant="destructive" onClick={() => reject(d)} disabled={busyId === d.id}>
                      <XCircle className="h-4 w-4 mr-1" /> Reject
                    </Button>
                    <Button onClick={() => approve(d)} disabled={busyId === d.id || !d.supplier_id || !d.measurements_verified_at}>
                      {busyId === d.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                      Approve → Live
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
