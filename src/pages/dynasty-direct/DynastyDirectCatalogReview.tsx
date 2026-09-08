import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { verifiedUpdate, mutationErrorMessage } from '@/lib/verifiedMutation';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, CheckCircle2, ExternalLink, Loader2, Ruler, ShieldAlert, Sparkles, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ---------- types (mirror of jsonb written by dd-catalog-pipeline) ----------
interface PriceResearch {
  amazon_price?: number | null;
  walmart_price?: number | null;
  competitor_avg?: number | null;
  suggested_store_price?: number;
  suggested_retail_price?: number;
  store_margin_pct?: number;
  retail_margin_pct?: number;
  pricing_notes?: string;
  cost_basis?: number;
  basis?: string;
  effective_margin_pct?: number;
  retail_floor?: number;
  pack?: { pack_count: number | null; source: string | null; matched_text: string | null; reason: string };
  // case-basis outputs
  pricing_model?: 'case_basis' | string;
  store_price_a?: number;
  store_price_a_basis?: string;
  dtc_price_b?: number;
  dtc_price_b_basis?: string;
  margins?: { min_store_margin_pct: number; target_store_margin_pct: number; min_dtc_margin_pct: number; target_dtc_margin_pct: number; source: string };
  floors?: { platform_margin_pct: number; platform_floor: number; store_floor: number; dtc_floor: number; store_cost_plus_target: number; dtc_cost_plus_target: number };
  case_market?: {
    available: boolean; comparable: boolean; reason: string | null; target_units: number; count: number; samples_raw: number;
    excluded: { low_relevance: number; count_mismatch: number; no_count: number; outliers: number };
    low: number | null; median: number | null; high: number | null; queries: string[];
    listings: { title: string; price: number; source: string; link: string | null; units: number }[];
  } | null;
  unit_reference?: { note: string; per_unit_median: number | null; per_unit_low: number | null; per_unit_high: number | null; listing_pack_size: number; listing_count: number; cost_per_unit: number | null };
  // legacy (pre case-basis) — may still be present on old research rows
  raw?: any;
  normalized?: any;
  sources?: { market?: { count: number; pack_size: number; samples?: { title: string; price: number; source: string; link: string | null }[] } | null };
  researched_at?: string;
}

interface SourcedSpecs {
  status: 'sourced' | 'needs_measurement' | 'unavailable' | string;
  reason?: string;
  target_units?: number | null;
  weight_basis?: 'same_quantity_sourced' | 'estimated_from_single_unit_weight' | 'unverified_quantity' | null;
  dimension_basis?: 'same_quantity_sourced' | 'unverified_quantity' | null;
  dimensions_status?: 'sourced' | 'needs_measurement';
  weight: { weight_oz: number; verbatim: string; source_url: string | null; source_title?: string | null; source_units?: number | null } | null;
  dimensions: { length_in: number; width_in: number; height_in: number; verbatim: string; source_url: string | null; source_title?: string | null; source_units?: number | null } | null;
  weight_agreement?: number;
  dimension_agreement?: number;
  confidence?: string;
  suggested_box: { box_id: string; box_name: string; length_in: number; width_in: number; height_in: number; max_weight_oz: number | null; reason: string } | null;
  checked_at?: string;
}

function weightBasisLabel(b: SourcedSpecs['weight_basis'], units?: number | null): string {
  if (b === 'same_quantity_sourced') return `same-quantity sourced${units ? ` (${units} ct)` : ''}`;
  if (b === 'estimated_from_single_unit_weight') return `estimated from single-unit weight ×${units ?? '?'} — verify`;
  return 'quantity unverified — verify';
}


interface PendingDraft {
  id: string;
  product_name: string;
  supplier_id: string | null;
  created_by: string | null;
  created_at: string;
  cost: number | null;
  input_photos: any;
  selected: any;
  copy: any;
  pricing: any;
  recognition: any;
  label_extraction: any;
  price_research: PriceResearch | null;
  sourced_specs: SourcedSpecs | null;
  weight_oz: number | null;
  dimensions: any;
  measurements_verified_at: string | null;
  measurements_verified_by: string | null;
  pack_count: number | null;
  pack_count_source: string | null;
  rejection_reason: string | null;
  label_photo_url?: string | null;
  image_variants?: any;
  no_printed_label?: boolean | null;
  supplier_name?: string;
}

interface Overrides { store?: string; retail?: string; cost?: string; pack?: string; mw?: string; ml?: string; mwd?: string; mh?: string }

function pct(cost: number, price: number): number {
  if (!price || price <= 0) return 0;
  return Math.round(((price - cost) / price) * 1000) / 10;
}
const money = (n: number | null | undefined) => (n == null ? '—' : `$${Number(n).toFixed(2)}`);

const BASIS_LABEL: Record<string, string> = {
  case_market_median: 'real case-level market median',
  case_market_below_floor: 'margin floor (case market below floor)',
  cost_plus_target_reseller: 'cost-plus target (reseller, below DTC market)',
  cost_plus_capped_below_dtc: 'cost-plus, capped under DTC',
  cost_plus_no_case_market_data: 'cost-plus (no case-level market data)',
  cost_plus_no_case_quantity: 'cost-plus (case quantity unknown)',
  no_cost: 'no cost — cannot price',
  admin_override: 'admin override',
  // legacy labels
  market_median: 'market median (legacy)',
  margin_floor_market_below: 'margin floor (legacy)',
  formula_only: 'formula only (legacy)',
  pack_normalized: 'pack-normalized (legacy — retired)',
};

const SELECT_COLS =
  'id, product_name, supplier_id, created_by, created_at, cost, input_photos, selected, copy, pricing, recognition, label_extraction, price_research, sourced_specs, weight_oz, dimensions, measurements_verified_at, measurements_verified_by, pack_count, pack_count_source, rejection_reason, label_photo_url, image_variants, no_printed_label';

export default function DynastyDirectCatalogReview() {
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<PendingDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, string | null>>({}); // draftId -> action
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [overrides, setOverrides] = useState<Record<string, Overrides>>({});

  const isBusy = (id: string) => !!busy[id];
  const setAction = (id: string, a: string | null) => setBusy((s) => ({ ...s, [id]: a }));

  async function load() {
    setLoading(true);
    setLoadError(null);
    // ADMIN READ PATH: raw dd_catalog_drafts SELECT is revoked from authenticated.
    // Admin/owner reads go through the role-gated dd_admin_catalog_drafts view.
    const { data, error } = await (supabase as any)
      .from('dd_admin_catalog_drafts')
      .select(SELECT_COLS)
      .eq('status', 'pending_admin_review')
      .order('created_at', { ascending: false });
    if (error) { setLoadError(error.message); toast.error(error.message); setLoading(false); return; }
    const rows = (data || []) as unknown as PendingDraft[];

    const ids = Array.from(new Set(rows.map((r) => r.supplier_id).filter(Boolean) as string[]));
    if (ids.length) {
      const { data: ws } = await supabase.from('wholesaler_profiles').select('id, company_name').in('id', ids);
      const map = new Map((ws || []).map((w: any) => [w.id, w.company_name]));
      rows.forEach((r) => { r.supplier_name = r.supplier_id ? map.get(r.supplier_id) || '(unknown)' : '(none)'; });
    }

    const seed: Record<string, Overrides> = {};
    rows.forEach((r) => {
      const pr = r.price_research || {};
      const px = r.pricing || {};
      // Only case-basis research seeds prices; legacy (unit × count) research is never reused.
      const caseBasis = pr.pricing_model === 'case_basis';
      seed[r.id] = {
        store: String(px.store_price_a ?? (caseBasis ? pr.store_price_a : undefined) ?? ''),
        retail: String(px.dtc_price_b ?? (caseBasis ? pr.dtc_price_b : undefined) ?? ''),
        cost: String(r.cost ?? pr.cost_basis ?? ''),
        pack: r.pack_count != null ? String(r.pack_count) : '',
        mw: '', ml: '', mwd: '', mh: '',
      };
    });
    setOverrides(seed);
    setDrafts(rows);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function updateOverride(id: string, patch: Partial<Overrides>) {
    setOverrides((s) => ({ ...s, [id]: { ...s[id], ...patch } }));
  }

  // All draft writes go through the admin-only RPC (role-checked server side) wrapped in
  // verifiedUpdate so a silent zero-row write can never report success.
  async function patchDraft(operation: string, draftId: string, patch: Record<string, unknown>) {
    await verifiedUpdate(operation, () => (supabase as any).rpc('dd_admin_update_draft', { p_draft_id: draftId, p_patch: patch }));
  }

  async function invokePipeline(body: Record<string, unknown>) {
    const { data, error } = await supabase.functions.invoke('dd-catalog-pipeline', { body });
    if (error) throw error;
    if (!(data as any)?.ok) throw new Error((data as any)?.error || 'pipeline call failed');
    return data as any;
  }

  async function runResearch(d: PendingDraft) {
    setAction(d.id, 'research');
    try {
      const cost = Number(overrides[d.id]?.cost) || Number(d.cost) || 0;
      await invokePipeline({
        mode: 'price_research', draft_id: d.id,
        product_name: d.recognition?.product_name || d.copy?.title || d.product_name,
        brand_hint: d.recognition?.brand_visible || null,
        category: d.copy?.category_guess || null,
        supplier_cost: cost,
      });
      toast.success('Pricing research refreshed');
      await load();
    } catch (e) { toast.error(`Research failed: ${mutationErrorMessage(e)}`); }
    finally { setAction(d.id, null); }
  }

  async function runSizing(d: PendingDraft) {
    setAction(d.id, 'sizing');
    try {
      await invokePipeline({
        mode: 'estimate_measurements', draft_id: d.id,
        product_name: d.recognition?.product_name || d.copy?.title || d.product_name,
        brand_hint: d.recognition?.brand_visible || null,
      });
      toast.success('Sourced sizing lookup complete');
      await load();
    } catch (e) { toast.error(`Sizing lookup failed: ${mutationErrorMessage(e)}`); }
    finally { setAction(d.id, null); }
  }

  async function savePackCount(d: PendingDraft) {
    const raw = (overrides[d.id]?.pack || '').trim();
    const n = raw === '' ? null : Number(raw);
    if (n != null && (!Number.isInteger(n) || n < 1)) { toast.error('Pack count must be a whole number ≥ 1 (or blank to clear)'); return; }
    setAction(d.id, 'pack');
    try {
      await patchDraft('save pack count', d.id, { pack_count: n });
      toast.success(n == null ? 'Pack count cleared' : `Pack count set to ${n} (human) — re-run research to normalize pricing`);
      await load();
    } catch (e) { toast.error(mutationErrorMessage(e)); }
    finally { setAction(d.id, null); }
  }

  async function confirmSourced(d: PendingDraft) {
    const s = d.sourced_specs;
    if (!s || s.status !== 'sourced' || !s.weight || !s.dimensions) return;
    setAction(d.id, 'confirm');
    try {
      await patchDraft('confirm sourced measurements', d.id, {
        weight_oz: s.weight.weight_oz,
        dimensions: { length_in: s.dimensions.length_in, width_in: s.dimensions.width_in, height_in: s.dimensions.height_in },
        confirm_measurements: true,
      });
      toast.success('Measurements confirmed by you');
      await load();
    } catch (e) { toast.error(mutationErrorMessage(e)); }
    finally { setAction(d.id, null); }
  }

  async function saveManualMeasurement(d: PendingDraft) {
    const o = overrides[d.id] || {};
    const w = Number(o.mw), l = Number(o.ml), wd = Number(o.mwd), h = Number(o.mh);
    if (!(w > 0 && l > 0 && wd > 0 && h > 0)) { toast.error('Enter weight (oz) and length, width, height (in) — all greater than 0'); return; }
    setAction(d.id, 'manual');
    try {
      await patchDraft('save manual measurement', d.id, {
        weight_oz: w, dimensions: { length_in: l, width_in: wd, height_in: h }, confirm_measurements: true,
      });
      toast.success('Manual measurement saved and marked verified');
      await load();
    } catch (e) { toast.error(mutationErrorMessage(e)); }
    finally { setAction(d.id, null); }
  }

  async function approve(d: PendingDraft) {
    if (!d.supplier_id) { toast.error('Cannot approve: no wholesaler attached'); return; }
    if (!d.measurements_verified_at) { toast.error('Confirm or enter measurements first'); return; }
    const ov = overrides[d.id] || {};
    const storeP = Number(ov.store) || 0;
    const dtcP = Number(ov.retail) || 0;
    const costP = Number(ov.cost) || Number(d.cost) || 0;
    if (!(dtcP > 0) || !(storeP > 0)) { toast.error('Store price and DTC price must both be greater than 0'); return; }
    if (storeP >= dtcP) { toast.error('Store (reseller) price must be below the DTC price'); return; }
    setAction(d.id, 'approve');
    try {
      const pr = d.price_research;
      const caseBasis = pr?.pricing_model === 'case_basis';
      const sameAs = (a: number | undefined, b: number) => a != null && Math.abs(a - b) <= 0.005;
      const newPricing = {
        ...(d.pricing || {}),
        // canonical case-basis outputs (carried to products_all.store_price_a / dtc_price_b)
        store_price_a: storeP,
        store_price_a_basis: caseBasis && sameAs(pr!.store_price_a, storeP) ? pr!.store_price_a_basis : 'admin_override',
        dtc_price_b: dtcP,
        dtc_price_b_basis: caseBasis && sameAs(pr!.dtc_price_b, dtcP) ? pr!.dtc_price_b_basis : 'admin_override',
        store_ai_suggested: caseBasis ? pr!.store_price_a ?? null : null,
        dtc_ai_suggested: caseBasis ? pr!.dtc_price_b ?? null : null,
        pricing_model: 'case_basis',
        // legacy mirrors read by older code paths
        suggested_store: storeP,
        suggested_retail: dtcP,
        retail_basis: caseBasis && sameAs(pr!.dtc_price_b, dtcP) ? pr!.dtc_price_b_basis : 'admin_override',
        retail_ai_suggested: caseBasis ? pr!.dtc_price_b ?? null : null,
      };
      const patch: Record<string, unknown> = { pricing: newPricing };
      if (costP > 0) patch.cost = costP;
      await patchDraft('save review prices', d.id, patch);

      const { data: userRes } = await supabase.auth.getUser();
      const data = await invokePipeline({ mode: 'publish', draft_id: d.id, confirmed_by: userRes.user?.id ?? null });
      toast.success(`Approved → live · product ${String(data.product_id || '').slice(0, 8)}`);
      await load();
    } catch (e) { toast.error(`Approve failed: ${mutationErrorMessage(e)}`); }
    finally { setAction(d.id, null); }
  }

  async function reject(d: PendingDraft) {
    const reason = (rejectNotes[d.id] || '').trim();
    if (!reason) { toast.error('Add a reason before rejecting'); return; }
    setAction(d.id, 'reject');
    try {
      await patchDraft('reject draft', d.id, { status: 'rejected', rejection_reason: reason, notes: reason });
      toast.success('Returned to wholesaler with reason');
      await load();
    } catch (e) { toast.error(mutationErrorMessage(e)); }
    finally { setAction(d.id, null); }
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
          <p className="text-sm text-muted-foreground">Sourced sizing + pack-normalized pricing. Nothing publishes without a human-confirmed measurement.</p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading queue…</div>
      )}
      {!loading && loadError && (
        <Card><CardContent className="p-6 text-sm text-destructive flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> {loadError} <Button size="sm" variant="outline" onClick={load}>Retry</Button></CardContent></Card>
      )}
      {!loading && !loadError && drafts.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Queue is empty.</CardContent></Card>
      )}

      <div className="space-y-4">
        {drafts.map((d) => {
          const sel = Array.isArray(d.selected) ? d.selected : [];
          const norm = sel.map((s: any) => (typeof s === 'string' ? { url: s } : s)).filter((s: any) => s?.url);
          const gallery = norm.filter((s: any) => s.role !== 'label' && s.url !== d.label_photo_url);
          const inputs: string[] = Array.isArray(d.input_photos)
            ? d.input_photos.map((p: any) => (typeof p === 'string' ? p : p?.url)).filter(Boolean)
            : [];
          const hero = gallery[0]?.url || inputs[0] || null;
          const ov = overrides[d.id] || {};
          const liveCost = Number(ov.cost) || 0;
          const liveStore = Number(ov.store) || 0;
          const liveRetail = Number(ov.retail) || 0;
          const pr = d.price_research;
          const rec = d.recognition || {};
          const sp = d.sourced_specs;
          const verified = !!d.measurements_verified_at;
          const action = busy[d.id];
          const canPublish = !!d.supplier_id && verified && !isBusy(d.id);
          const caseBasis = pr?.pricing_model === 'case_basis';
          const isStoreOverride = caseBasis && pr?.store_price_a != null && Math.abs(Number(ov.store) - pr.store_price_a) > 0.005;
          const isDtcOverride = caseBasis && pr?.dtc_price_b != null && Math.abs(Number(ov.retail) - pr.dtc_price_b) > 0.005;

          return (
            <Card key={d.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="flex items-center gap-2">
                    {rec.product_name || d.copy?.title || d.product_name}
                    <Badge variant={d.supplier_id ? 'default' : 'destructive'} className="text-xs">{d.supplier_name || '(no wholesaler)'}</Badge>
                  </span>
                  <span className="text-xs text-muted-foreground font-normal">submitted {new Date(d.created_at).toLocaleString()}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* IDENTITY */}
                <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-4">
                  {hero ? (
                    <img src={hero} alt="" className="w-40 h-40 object-contain bg-muted rounded border" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-40 h-40 bg-muted rounded border flex items-center justify-center text-xs text-muted-foreground">no photo</div>
                  )}
                  <div className="space-y-2 text-sm">
                    <div className="font-medium">{d.copy?.title || rec.product_name || d.product_name}</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <div><span className="text-muted-foreground">Brand (read): </span>{rec.brand_visible || '—'}</div>
                      <div><span className="text-muted-foreground">Size / count (read): </span>{rec.size_or_count || '—'}</div>
                      <div><span className="text-muted-foreground">Variant: </span>{rec.flavor_or_variant || '—'}</div>
                      <div><span className="text-muted-foreground">Recognition confidence: </span>{rec.confidence || '—'}</div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant={verified ? 'default' : 'destructive'}>{verified ? 'measurements confirmed by human' : 'measurements NOT verified'}</Badge>
                      {d.pack_count != null && <Badge variant="outline">pack of {d.pack_count} · {d.pack_count_source === 'human' ? 'human' : 'parsed'}</Badge>}
                    </div>
                    <code className="text-[10px] text-muted-foreground">draft {d.id.slice(0, 8)} · wholesaler {d.supplier_id?.slice(0, 8) || '—'}</code>
                  </div>
                </div>

                {/* PHOTOS */}
                {(gallery.length > 0 || inputs.length > 0 || d.label_photo_url) && (
                  <div className="border rounded-lg p-3 space-y-2">
                    <div className="text-xs font-semibold flex items-center gap-2">
                      Photos — storefront gallery ({gallery.length}) · raw uploads ({inputs.length})
                      {d.no_printed_label && <Badge variant="outline" className="text-[10px]">no printed label</Badge>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {gallery.map((s: any, i: number) => (
                        <div key={`g-${s.url}`} className="relative">
                          <img src={s.url} alt="" className="h-20 w-20 object-contain bg-muted rounded border" referrerPolicy="no-referrer" />
                          <span className="absolute bottom-0 left-0 rounded-tr bg-background/90 px-1 text-[9px]">{i === 0 ? 'primary' : (s.role || 'angle')}</span>
                        </div>
                      ))}
                      {inputs.map((u) => (
                        <div key={`i-${u}`} className="relative">
                          <img src={u} alt="" className="h-20 w-20 object-contain bg-muted rounded border opacity-80" referrerPolicy="no-referrer" />
                          <span className="absolute bottom-0 left-0 rounded-tr bg-background/90 px-1 text-[9px]">raw</span>
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
                )}

                {/* SIZING */}
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="font-semibold flex items-center gap-2"><Ruler className="h-4 w-4" /> Shipping size &amp; weight</div>
                    <Button size="sm" variant="outline" disabled={isBusy(d.id)} onClick={() => runSizing(d)}>
                      {action === 'sizing' ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                      {sp ? 'Re-run sourced lookup' : 'Run sourced lookup'}
                    </Button>
                  </div>

                  {verified && (
                    <div className="rounded border border-primary/40 bg-primary/10 p-3 text-xs">
                      <div className="font-semibold text-primary flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Confirmed by human · {new Date(d.measurements_verified_at!).toLocaleString()}</div>
                      <div className="font-mono mt-1">{d.weight_oz ?? '—'} oz · {d.dimensions?.length_in ?? '—'} × {d.dimensions?.width_in ?? '—'} × {d.dimensions?.height_in ?? '—'} in</div>
                    </div>
                  )}

                  {!sp && <p className="text-xs text-muted-foreground">No sourced lookup yet.</p>}

                  {sp?.status === 'sourced' && sp.weight && sp.dimensions && (
                    <div className={`rounded border p-3 text-xs space-y-2 ${verified ? 'opacity-70' : 'border-dashed border-amber-500/60 bg-amber-500/10'}`}>
                      <div className="flex items-center gap-2 font-semibold">
                        SOURCED (web) — {verified ? 'confirmed' : 'not yet human-verified'}
                        <Badge variant="outline" className="text-[10px]">confidence {sp.confidence}</Badge>
                        <Badge variant="outline" className="text-[10px]">{sp.weight_agreement ?? 0} weight src · {sp.dimension_agreement ?? 0} dims src</Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                          <div className="font-mono">{sp.weight.weight_oz} oz</div>
                          <div className="text-muted-foreground">“{sp.weight.verbatim}”</div>
                          {sp.weight.source_url && <a href={sp.weight.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline"><ExternalLink className="h-3 w-3" />{sp.weight.source_title || 'source'}</a>}
                        </div>
                        <div>
                          <div className="font-mono">{sp.dimensions.length_in} × {sp.dimensions.width_in} × {sp.dimensions.height_in} in</div>
                          <div className="text-muted-foreground">“{sp.dimensions.verbatim}”</div>
                          {sp.dimensions.source_url && <a href={sp.dimensions.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline"><ExternalLink className="h-3 w-3" />{sp.dimensions.source_title || 'source'}</a>}
                        </div>
                      </div>
                      {!verified && (
                        <Button size="sm" disabled={isBusy(d.id)} onClick={() => confirmSourced(d)}>
                          {action === 'confirm' ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                          Confirm measurements (as me)
                        </Button>
                      )}
                    </div>
                  )}

                  {sp && sp.status !== 'sourced' && (
                    <div className="rounded border border-dashed border-destructive/50 bg-destructive/10 p-3 text-xs space-y-1">
                      <div className="font-semibold flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {sp.status === 'needs_measurement' ? 'NEEDS MEASUREMENT' : sp.status.toUpperCase()} — no sourced match</div>
                      {sp.reason && <div className="text-muted-foreground">{sp.reason}</div>}
                      {sp.suggested_box ? (
                        <div>
                          <span className="font-semibold">Suggested box (suggestion only, not a measurement): </span>
                          {sp.suggested_box.box_name} · {sp.suggested_box.length_in} × {sp.suggested_box.width_in} × {sp.suggested_box.height_in} in
                          {sp.suggested_box.max_weight_oz != null && ` · up to ${sp.suggested_box.max_weight_oz} oz`}
                          <div className="text-muted-foreground">{sp.suggested_box.reason}</div>
                        </div>
                      ) : <div className="text-muted-foreground">No box suggestion logged.</div>}
                    </div>
                  )}

                  {!verified && (
                    <div className="space-y-1">
                      <div className="text-xs font-semibold">Manual measurement (counts as verified once you save it)</div>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
                        <div><Label className="text-[11px]">Weight (oz)</Label><Input type="number" step="0.01" value={ov.mw ?? ''} onChange={(e) => updateOverride(d.id, { mw: e.target.value })} /></div>
                        <div><Label className="text-[11px]">Length (in)</Label><Input type="number" step="0.01" value={ov.ml ?? ''} onChange={(e) => updateOverride(d.id, { ml: e.target.value })} /></div>
                        <div><Label className="text-[11px]">Width (in)</Label><Input type="number" step="0.01" value={ov.mwd ?? ''} onChange={(e) => updateOverride(d.id, { mwd: e.target.value })} /></div>
                        <div><Label className="text-[11px]">Height (in)</Label><Input type="number" step="0.01" value={ov.mh ?? ''} onChange={(e) => updateOverride(d.id, { mh: e.target.value })} /></div>
                        <Button size="sm" variant="secondary" disabled={isBusy(d.id)} onClick={() => saveManualMeasurement(d)}>
                          {action === 'manual' ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null} Save measured
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* PRICING */}
                <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="font-semibold flex items-center gap-2">💰 Pricing</div>
                    <Button size="sm" variant="outline" disabled={isBusy(d.id)} onClick={() => runResearch(d)}>
                      {action === 'research' ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                      {pr ? 'Re-run research' : 'Run sourced research'}
                    </Button>
                  </div>

                  {/* cost + pack count */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <div>
                      <Label className="text-xs">Cost basis ($ per unit as sold)</Label>
                      <Input type="number" step="0.01" value={ov.cost ?? ''} onChange={(e) => updateOverride(d.id, { cost: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">Pack count (units per sold pack)</Label>
                      <Input type="number" step="1" min="1" placeholder="unknown" value={ov.pack ?? ''} onChange={(e) => updateOverride(d.id, { pack: e.target.value })} />
                      <div className="text-[11px] text-muted-foreground mt-1">
                        {pr?.pack?.pack_count != null
                          ? <>read: “{pr.pack.matched_text}” from {pr.pack.source}</>
                          : pr?.pack ? <span className="text-destructive">{pr.pack.reason}</span> : 'not researched yet'}
                      </div>
                    </div>
                    <Button size="sm" variant="secondary" disabled={isBusy(d.id) || (ov.pack ?? '') === String(d.pack_count ?? '')} onClick={() => savePackCount(d)}>
                      {action === 'pack' ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null} Save pack count
                    </Button>
                  </div>

                  {pr && !caseBasis && (
                    <div className="rounded border border-dashed border-destructive/50 bg-destructive/10 p-3 text-xs">
                      <div className="font-semibold flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Legacy research (unit × count) — retired</div>
                      <div className="text-muted-foreground">This research predates case-basis pricing and its numbers are not used. Re-run sourced research to get store / DTC case prices.</div>
                    </div>
                  )}

                  {pr && caseBasis ? (
                    <div className="space-y-3 text-xs">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* CASE-LEVEL MARKET */}
                        <div className={`rounded border p-3 space-y-1 ${pr.case_market?.comparable ? 'border-primary/50 bg-primary/5' : 'border-dashed'}`}>
                          <div className="font-semibold">Case-level comparables ({pr.pack?.pack_count ?? '?'} per case)</div>
                          {pr.case_market ? (
                            pr.case_market.comparable ? (
                              <>
                                <div>{pr.case_market.count} real listings selling ~{pr.case_market.target_units} units</div>
                                <div>Low / median / high: <span className="font-mono">{money(pr.case_market.low)} / {money(pr.case_market.median)} / {money(pr.case_market.high)}</span></div>
                                <ul className="space-y-0.5 mt-1">
                                  {pr.case_market.listings.slice(0, 4).map((l, i) => (
                                    <li key={i} className="truncate">
                                      <span className="font-mono">{money(l.price)}</span> · {l.units} ct · {l.source}
                                      {l.link && <a href={l.link} target="_blank" rel="noreferrer" className="ml-1 inline-flex align-middle"><ExternalLink className="h-3 w-3" /></a>}
                                    </li>
                                  ))}
                                </ul>
                              </>
                            ) : (
                              <div className="text-muted-foreground">
                                <span className="text-destructive">None found.</span> {pr.case_market.reason} ({pr.case_market.samples_raw} raw listings: {pr.case_market.excluded.no_count} no stated count, {pr.case_market.excluded.count_mismatch} different quantity, {pr.case_market.excluded.low_relevance} off-product). Prices below are cost-plus.
                              </div>
                            )
                          ) : (
                            <div className="text-muted-foreground">Not searched — case quantity unknown. Enter the pack count above and re-run.</div>
                          )}
                        </div>
                        {/* COST-PLUS */}
                        <div className="rounded border p-3 space-y-1">
                          <div className="font-semibold">Cost-plus (products_all margin columns)</div>
                          <div>Cost basis (case): <span className="font-mono">{money(pr.cost_basis)}</span></div>
                          <div>Store: min {pr.margins?.min_store_margin_pct}% → <span className="font-mono">{money(pr.floors?.store_floor)}</span>, target {pr.margins?.target_store_margin_pct}% → <span className="font-mono">{money(pr.floors?.store_cost_plus_target)}</span></div>
                          <div>DTC: min {pr.margins?.min_dtc_margin_pct}% → <span className="font-mono">{money(pr.floors?.dtc_floor)}</span>, target {pr.margins?.target_dtc_margin_pct}% → <span className="font-mono">{money(pr.floors?.dtc_cost_plus_target)}</span></div>
                          <div className="text-muted-foreground">Platform floor {pr.floors?.platform_margin_pct}%: <span className="font-mono">{money(pr.floors?.platform_floor)}</span></div>
                        </div>
                        {/* UNIT REFERENCE */}
                        <div className="rounded border p-3 space-y-1 opacity-80">
                          <div className="font-semibold">Single-unit retail — reference only</div>
                          {pr.unit_reference?.per_unit_median != null ? (
                            <>
                              <div>A customer could buy ONE elsewhere for ~<span className="font-mono">{money(pr.unit_reference.per_unit_median)}</span> ({pr.unit_reference.listing_count} listings)</div>
                              <div>Range: <span className="font-mono">{money(pr.unit_reference.per_unit_low)} – {money(pr.unit_reference.per_unit_high)}</span></div>
                              {pr.unit_reference.cost_per_unit != null && <div>Your cost / unit: <span className="font-mono">{money(pr.unit_reference.cost_per_unit)}</span></div>}
                              <div className="text-muted-foreground">Never multiplied into the case price.</div>
                            </>
                          ) : (
                            <div className="text-muted-foreground">{pr.unit_reference?.note || 'No unit market data.'}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        <span>Suggested store (case): <span className="font-mono">{money(pr.store_price_a)}</span> <Badge className="text-[10px]">{BASIS_LABEL[pr.store_price_a_basis ?? ''] || pr.store_price_a_basis}</Badge></span>
                        <span>Suggested DTC (case): <span className="font-mono">{money(pr.dtc_price_b)}</span> <Badge className="text-[10px]">{BASIS_LABEL[pr.dtc_price_b_basis ?? ''] || pr.dtc_price_b_basis}</Badge></span>
                      </div>
                      {pr.pricing_notes && <div className="text-muted-foreground italic">“{pr.pricing_notes}”</div>}
                    </div>
                  ) : !pr ? (
                    <p className="text-xs text-muted-foreground">No research yet — run sourced research to fetch case-level comparables.</p>
                  ) : null}

                  <Separator />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Store price — per case, to stores/resellers ($) {isStoreOverride && <Badge variant="outline" className="ml-1 text-[10px]">admin override</Badge>}</Label>
                      <Input type="number" step="0.01" value={ov.store ?? ''} onChange={(e) => updateOverride(d.id, { store: e.target.value })} />
                      <div className="text-[11px] text-muted-foreground mt-1">
                        Margin: <span className="font-mono">{pct(liveCost, liveStore)}%</span>
                        {pr?.margins && pct(liveCost, liveStore) < pr.margins.min_store_margin_pct && liveStore > 0 && <span className="text-destructive ml-2">below min {pr.margins.min_store_margin_pct}% — publish will be blocked</span>}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">DTC price — per case, direct to consumer ($) {isDtcOverride && <Badge variant="outline" className="ml-1 text-[10px]">admin override</Badge>}</Label>
                      <Input type="number" step="0.01" value={ov.retail ?? ''} onChange={(e) => updateOverride(d.id, { retail: e.target.value })} />
                      <div className="text-[11px] text-muted-foreground mt-1">
                        Margin: <span className="font-mono">{pct(liveCost, liveRetail)}%</span>
                        {pr?.margins && pct(liveCost, liveRetail) < pr.margins.min_dtc_margin_pct && liveRetail > 0 && <span className="text-destructive ml-2">below min {pr.margins.min_dtc_margin_pct}% — publish will be blocked</span>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ACTIONS */}
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 border-t pt-3">
                  <Textarea
                    placeholder="Rejection reason (sent back to wholesaler)…"
                    value={rejectNotes[d.id] || ''}
                    onChange={(e) => setRejectNotes((s) => ({ ...s, [d.id]: e.target.value }))}
                    rows={2}
                  />
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex gap-2">
                      <Button variant="destructive" onClick={() => reject(d)} disabled={isBusy(d.id)}>
                        {action === 'reject' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <XCircle className="h-4 w-4 mr-1" />} Reject
                      </Button>
                      <Button onClick={() => approve(d)} disabled={!canPublish}>
                        {action === 'approve' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />} Publish → Live
                      </Button>
                    </div>
                    {!canPublish && !isBusy(d.id) && (
                      <div className="text-[11px] text-muted-foreground">{!d.supplier_id ? 'No wholesaler attached.' : 'Confirm or enter measurements to enable publish.'}</div>
                    )}
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
