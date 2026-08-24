import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PhotoUploadMultiple } from '@/components/store/PhotoUploadMultiple';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Sparkles, ChevronRight, CheckCircle2, ImageOff, ArrowLeft, Wand2, Camera, Rocket } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DDAlertBar } from '@/components/dynasty-direct/DDAlertBar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DD_CATEGORY_OPTIONS } from '@/lib/dynastyDirect/categories';

interface Candidate { url: string; source: string; confidence: number; attribution?: string; thumb?: string }
interface Supplier { id: string; company_name: string }
interface Staged { title: string; url: string; prompt?: string }

type Step = 'A' | 'B' | 'B2' | 'B3' | 'C' | 'D';

interface OnboardProps {
  lockedSupplierId?: string;
  lockedSupplierName?: string;
  submitForReviewMode?: boolean;
}

export default function DynastyDirectCatalogOnboard({ lockedSupplierId, lockedSupplierName, submitForReviewMode = false }: OnboardProps = {}) {
  const navigate = useNavigate();

  // Step A
  const [productName, setProductName] = useState('');
  const [brandHint, setBrandHint] = useState('');
  const [cost, setCost] = useState<string>('');
  const [supplierId, setSupplierId] = useState<string>(lockedSupplierId || '');
  const [photos, setPhotos] = useState<string[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Step A — photo-to-listing (vision extraction + uniform backdrop)
  const [recognition, setRecognition] = useState<any>(null);
  const [category, setCategory] = useState<string>('');
  const [reading, setReading] = useState(false);
  const [standardizing, setStandardizing] = useState(false);
  const [standardizedUrl, setStandardizedUrl] = useState<string | null>(null);

  // Wizard
  const [step, setStep] = useState<Step>('A');
  const [draftId, setDraftId] = useState<string | null>(null);

  // B1 stream
  const [streaming, setStreaming] = useState(false);
  const [progressLog, setProgressLog] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidateUrls, setSelectedCandidateUrls] = useState<string[]>([]);
  const [chainMeta, setChainMeta] = useState<{ adapters: string[]; primary: string; serpapi_available: boolean } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // B2/B3/C state
  const [enhancedUrls, setEnhancedUrls] = useState<string[]>([]);
  const [staged, setStaged] = useState<Staged[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [copy, setCopy] = useState<any>({});
  const [pricing, setPricing] = useState<any>({});
  const [selectedImages, setSelectedImages] = useState<string[]>([]);

  // D state
  const [published, setPublished] = useState<{ product_id: string } | null>(null);
  const [contentBriefId, setContentBriefId] = useState<string | null>(null);

  // Market check (Step C)
  const [marketCheck, setMarketCheck] = useState<any>(null);

  // Measurements (Step D)
  const [measurements, setMeasurements] = useState<{ weight_oz: number | null; length_in: number | null; width_in: number | null; height_in: number | null }>({ weight_oz: null, length_in: null, width_in: null, height_in: null });
  const [measurementsEstimate, setMeasurementsEstimate] = useState<any>(null);
  const [measurementsVerified, setMeasurementsVerified] = useState(false);

  useEffect(() => {
    if (lockedSupplierId) {
      setSupplierId(lockedSupplierId);
      if (lockedSupplierName) setSuppliers([{ id: lockedSupplierId, company_name: lockedSupplierName }]);
      return;
    }
    supabase.from('wholesaler_profiles').select('id, company_name').order('company_name')
      .then(({ data }) => setSuppliers((data || []) as Supplier[]));
  }, [lockedSupplierId, lockedSupplierName]);

  const selectedSupplierName = suppliers.find((s) => s.id === supplierId)?.company_name || lockedSupplierName || '';
  // Supplier is REQUIRED — attribution drives routing, splits, and the review queue.
  // Cost is REQUIRED — dd-auto-price needs a real supplier cost to compute store/retail margins.
  // Falling back to 0 would silently produce nonsense pricing.
  const costNum = Number(cost);
  const costValid = cost.trim().length > 0 && Number.isFinite(costNum) && costNum > 0;
  const canStartB = productName.trim().length > 1 && photos.length > 0 && !!supplierId && costValid;
  // Only the wholesaler-curated candidate photos flow downstream (never the raw candidate firehose).
  const curatedCandidates: Candidate[] = candidates.filter((c) => selectedCandidateUrls.includes(c.url));
  const allGalleryImages: { url: string; label: string }[] = [
    ...photos.map((url) => ({ url, label: 'original' })),
    ...curatedCandidates.map((c) => ({ url: c.url, label: `found · ${c.source}` })),
    ...enhancedUrls.map((url) => ({ url, label: 'enhanced' })),
    ...staged.map((s) => ({ url: s.url, label: `staged · ${s.title}` })),
  ];

  function toggleSelect(url: string) {
    setSelectedImages((s) => s.includes(url) ? s.filter((u) => u !== url) : [...s, url]);
  }

  async function toggleCandidate(url: string) {
    const next = selectedCandidateUrls.includes(url)
      ? selectedCandidateUrls.filter((u) => u !== url)
      : [...selectedCandidateUrls, url];
    setSelectedCandidateUrls(next);
    if (draftId) {
      await supabase.from('dd_catalog_drafts')
        .update({ selected_candidate_urls: next })
        .eq('id', draftId);
    }
  }

  async function startStepB() {
    if (!canStartB) return;
    setStreaming(true);
    setCandidates([]); setSelectedCandidateUrls([]); setProgressLog([]); setChainMeta(null);

    const { data: userRes } = await supabase.auth.getUser();
    const { data: draft, error: draftErr } = await supabase.from('dd_catalog_drafts').insert({
      created_by: userRes.user?.id ?? null,
      product_name: productName.trim(),
      supplier_id: supplierId || null,
      cost: cost ? Number(cost) : null,
      input_photos: photos,
      status: 'candidates',
    }).select('id').single();
    if (draftErr || !draft) { toast.error(`Draft save failed: ${draftErr?.message}`); setStreaming(false); return; }
    setDraftId(draft.id); setStep('B');

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dd-catalog-source-chain`;
    const ctrl = new AbortController(); abortRef.current = ctrl;
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ product_name: productName.trim(), brand_hint: brandHint.trim() || undefined, image_url: photos[0] }),
        signal: ctrl.signal,
      });
      if (!resp.ok || !resp.body) throw new Error(`source-chain ${resp.status}`);
      const reader = resp.body.getReader(); const dec = new TextDecoder(); let buf = '';
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) !== -1) {
          const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
          if (!line) continue;
          try {
            const ev = JSON.parse(line);
            if (ev.type === 'progress') {
              if (ev.stage === 'init') setChainMeta({ adapters: ev.adapters, primary: ev.primary, serpapi_available: ev.serpapi_available });
              setProgressLog((p) => [...p, ev.stage + (ev.count !== undefined ? ` (${ev.count})` : '')]);
            } else if (ev.type === 'candidate') {
              setCandidates((c) => [...c, ev.candidate]);
            } else if (ev.type === 'done') {
              setCandidates(ev.candidates);
              await supabase.from('dd_catalog_drafts').update({ candidates: ev.candidates }).eq('id', draft.id);
            }
          } catch { /* */ }
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') toast.error(`Stream error: ${e.message}`);
    } finally { setStreaming(false); }
  }

  async function callPipeline(body: any) {
    const { data, error } = await supabase.functions.invoke('dd-catalog-pipeline', { body });
    if (error) throw error;
    if (!data?.ok) throw new Error(data?.error || 'pipeline failed');
    return data;
  }

  async function runEnhance() {
    if (!draftId || photos.length === 0) return;
    setBusy('enhance');
    try {
      const r = await callPipeline({ mode: 'enhance', draft_id: draftId, photo_url: photos[0], product_name: productName });
      setEnhancedUrls((u) => [...u, r.enhanced_url]);
      toast.success('Enhanced shot ready');
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  }

  async function runStage() {
    const hero = selectedCandidateUrls[0] || enhancedUrls[0] || candidates[0]?.url || photos[0];
    if (!draftId || !hero) return;
    setBusy('stage');
    try {
      const r = await callPipeline({ mode: 'stage', draft_id: draftId, hero_url: hero, product_name: productName, count: 3 });
      setStaged((s) => [...s, ...(r.staged || [])]);
      toast.success(`${r.staged?.length || 0} staged shots ready`);
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  }

  async function runCopyPricing(opts?: { keepStep?: boolean }) {
    if (!draftId) return;
    setBusy('copy');
    try {
      const hero = selectedImages[0] || enhancedUrls[0] || photos[0];
      const r = await callPipeline({ mode: 'copy_pricing', draft_id: draftId, product_name: productName, brand_hint: brandHint, cost: Number(cost) || 0, hero_url: hero, supplier_id: supplierId || null });
      setCopy({
        title: r.title, short_description: r.short_description, long_description: r.long_description,
        bullets: r.bullets || [], seo: r.seo || {},
        category_guess: r.category_guess || '', category_raw: r.category_raw, category_source: r.category_source,
        tags: r.tags || [],
      });
      // Review mode = wholesaler self-serve: the pipeline withholds pricing entirely,
      // so there is nothing pricing-related to set or toast here.
      if (!submitForReviewMode) {
        setPricing(r.pricing || {});
        if (r.market) setMarketCheck(r.market);
        if (r.pricing_basis === 'formula_only') {
          toast.message('Priced from formula only', { description: r.market?.reason || 'No live market data available.' });
        } else if (r.pricing_basis === 'floor_over_market') {
          toast.warning('Market is below your margin floor — floor price kept.');
        } else if (r.market?.range) {
          toast.success(`Market-informed: median $${r.market.range.median} from ${r.market.range.count} listings`);
        }
      }
      if (!opts?.keepStep) setStep('C');
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  }


  async function runPublish() {
    if (!draftId) return;
    if (!supplierId) { toast.error('Pick a wholesaler before publishing'); return; }
    if (selectedImages.length === 0) { toast.error('Select at least one image for the live product'); return; }
    if (!measurementsVerified) { toast.error('Tap "measurements verified" before publishing'); return; }
    // Weight AND all three dimensions are mandatory — EasyPost cannot rate a
    // parcel without them and the DB rejects an active product that lacks them.
    const missingDims = [
      !(Number(measurements.weight_oz) > 0) && 'weight (oz)',
      !(Number(measurements.length_in) > 0) && 'length',
      !(Number(measurements.width_in) > 0) && 'width',
      !(Number(measurements.height_in) > 0) && 'height',
    ].filter(Boolean) as string[];
    if (missingDims.length > 0) {
      toast.error(`Missing ${missingDims.join(', ')} — shipping can't be priced without them.`);
      return;
    }
    if (!copy.category_guess) { toast.error('Pick a category before publishing'); return; }
    setBusy('publish');
    try {
      const dims = (measurements.length_in && measurements.width_in && measurements.height_in)
        ? { length_in: measurements.length_in, width_in: measurements.width_in, height_in: measurements.height_in }
        : null;
      const { data: userRes } = await supabase.auth.getUser();
      await supabase.from('dd_catalog_drafts').update({
        selected: selectedImages.map((url) => ({ url })),
        copy,
        // Wholesalers never write pricing into their draft — admin sets retail at review.
        ...(submitForReviewMode ? {} : { pricing }),
        supplier_id: supplierId,
        weight_oz: measurements.weight_oz,
        dimensions: dims,
        measurements_verified_at: new Date().toISOString(),
        measurements_verified_by: userRes.user?.id ?? null,
      }).eq('id', draftId);

      if (submitForReviewMode) {
        // Wholesaler self-serve path: never call pipeline publish — submit to admin review queue.
        const { error: subErr } = await supabase.from('dd_catalog_drafts')
          .update({ status: 'pending_admin_review' })
          .eq('id', draftId);
        if (subErr) throw subErr;
        setPublished({ product_id: draftId });
        toast.success('Submitted to Dynasty Direct review queue');
      } else {
        const r = await callPipeline({ mode: 'publish', draft_id: draftId, confirmed_by: userRes.user?.id ?? null });
        setPublished({ product_id: r.product_id });
        toast.success('Product is LIVE on the catalog');
      }
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  }

  async function runMarketCheckAction() {
    if (!productName) return;
    setBusy('market');
    try {
      const r = await callPipeline({ mode: 'market_check', draft_id: draftId, product_name: productName, brand_hint: brandHint });
      setMarketCheck(r);
      if (r.available === false) toast.message('SerpAPI dormant', { description: 'Available when SerpAPI activates.' });
      else if (!r.range) toast.message('No market prices found for this query');
      else toast.success(`Market: $${r.range.low}–$${r.range.high} (median $${r.range.median})`);
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  }

  async function runEstimateMeasurements() {
    if (!draftId || photos.length === 0) return;
    setBusy('estimate');
    try {
      const r = await callPipeline({ mode: 'estimate_measurements', draft_id: draftId, product_name: productName, photo_url: photos[0] });
      setMeasurementsEstimate(r);
      setMeasurements({
        weight_oz: r.weight_oz ?? null,
        length_in: r.dimensions?.length_in ?? null,
        width_in: r.dimensions?.width_in ?? null,
        height_in: r.dimensions?.height_in ?? null,
      });
      setMeasurementsVerified(false);
      toast.success(`AI estimate ready (confidence: ${r.confidence})`);
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  }

  async function sendToContentFactory() {
    if (!draftId) return;
    setBusy('content');
    try {
      const r = await callPipeline({ mode: 'content_factory', draft_id: draftId });
      setContentBriefId(r.brief_id);
      toast.success('Content brief generated');
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  }

  function cancelStream() { abortRef.current?.abort(); setStreaming(false); }

  return (
    <div className="min-h-screen bg-background p-6 max-w-6xl mx-auto space-y-6">
      <DDAlertBar />
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dynasty-direct')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Dynasty Direct
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" /> Catalog Onboarding
          </h1>
          <p className="text-sm text-muted-foreground">Photo + name in → world-class product page out.</p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm flex-wrap">
        {(['A', 'B', 'B2', 'B3', 'C', 'D'] as Step[]).map((s, i) => (
          <span key={s} className="flex items-center gap-2">
            <Badge variant={step === s ? 'default' : 'outline'}>{s} · {s === 'A' ? 'Input' : s === 'B' ? 'Find' : s === 'B2' ? 'Enhance' : s === 'B3' ? 'Stage' : s === 'C' ? 'Copy/Pricing' : 'Confirm & Publish'}</Badge>
            {i < 5 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </span>
        ))}
      </div>

      {step === 'A' && (
        <Card>
          <CardHeader><CardTitle>Step A — Drop photo + name the product</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Product name *</Label><Input value={productName} onChange={(e) => setProductName(e.target.value)} /></div>
              <div className="space-y-2"><Label>Brand hint</Label><Input value={brandHint} onChange={(e) => setBrandHint(e.target.value)} /></div>
              <div className="space-y-2">
                <Label>Cost (USD) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  className={!costValid && cost.length > 0 ? 'border-destructive' : ''}
                  placeholder="What you paid per unit"
                />
                {!costValid && (
                  <p className="text-xs text-destructive">
                    Required — dd-auto-price needs your real cost to calculate store &amp; retail pricing.
                  </p>
                )}
              </div>
              {lockedSupplierId ? (
                <div className="space-y-2"><Label>Wholesaler (auto-bound to you)</Label>
                  <div className="flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm">
                    <Badge variant="secondary" className="mr-2">locked</Badge>
                    {selectedSupplierName || lockedSupplierId.slice(0, 8)}
                  </div>
                </div>
              ) : (
                <div className="space-y-2"><Label>Wholesaler *</Label>
                  <select className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ${!supplierId ? 'border-destructive/60' : 'border-input'}`}
                    value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                    <option value="">— select wholesaler (required) —</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.company_name}</option>)}
                  </select>
                  {!supplierId && <p className="text-xs text-destructive">Required — every product attaches to a wholesaler for routing &amp; splits.</p>}
                </div>
              )}
            </div>
            <PhotoUploadMultiple photos={photos} onChange={setPhotos} folder="dd-catalog-onboard" maxPhotos={6} />
            <div className="flex justify-end">
              <Button size="lg" disabled={!canStartB} onClick={startStepB}>
                <Sparkles className="h-4 w-4 mr-2" /> Find official photos
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'B' && (
        <Card>
          <CardHeader><CardTitle className="flex items-center justify-between">
            <span>Step B — Photo Engine · Candidate Gallery</span>
            {streaming ? <Button variant="outline" size="sm" onClick={cancelStream}>Stop</Button>
              : <Button variant="outline" size="sm" onClick={() => setStep('A')}>← Back</Button>}
          </CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {chainMeta && (
              <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                <span>Source chain:</span>
                {chainMeta.adapters.map((a) => (
                  <Badge key={a} variant={a === chainMeta.primary ? 'default' : 'secondary'} className="text-[10px]">
                    {a}{a === chainMeta.primary ? ' · primary' : ''}
                  </Badge>
                ))}
                {!chainMeta.serpapi_available && <span className="text-amber-600">· SerpAPI dormant</span>}
              </div>
            )}
            {progressLog.length > 0 && (
              <div className="text-xs font-mono text-muted-foreground space-y-1 max-h-24 overflow-y-auto bg-muted/30 rounded p-2">
                {progressLog.map((l, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {streaming && i === progressLog.length - 1 ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                    {l}
                  </div>
                ))}
              </div>
            )}
            {candidates.length === 0 && !streaming && (
              <div className="border-2 border-dashed rounded-lg p-6 text-center text-muted-foreground">
                <ImageOff className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">No official photos found — enhance + stage will carry the gallery.</p>
              </div>
            )}
            {candidates.length > 0 && (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Tap to select the real photos you want to keep (front, back, side, etc.). Only selected shots flow to the live product.
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={async () => {
                      const all = candidates.map((c) => c.url);
                      setSelectedCandidateUrls(all);
                      if (draftId) await supabase.from('dd_catalog_drafts').update({ selected_candidate_urls: all }).eq('id', draftId);
                    }}>Select all</Button>
                    <Button size="sm" variant="ghost" onClick={async () => {
                      setSelectedCandidateUrls([]);
                      if (draftId) await supabase.from('dd_catalog_drafts').update({ selected_candidate_urls: [] }).eq('id', draftId);
                    }}>Clear</Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {candidates.map((c, i) => {
                    const picked = selectedCandidateUrls.includes(c.url);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleCandidate(c.url)}
                        className={`text-left border-2 rounded-lg overflow-hidden bg-card transition ${picked ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-muted-foreground/50'}`}
                      >
                        <div className="aspect-square bg-muted relative">
                          <img src={c.thumb || c.url} alt="" className="w-full h-full object-contain" loading="lazy" referrerPolicy="no-referrer"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0.2'; }} />
                          {picked && (
                            <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-1">
                              <CheckCircle2 className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                        <div className="p-2 text-[11px] flex items-center justify-between">
                          <Badge variant="secondary" className="text-[10px]">{c.source}</Badge>
                          <span className="text-muted-foreground">{Math.round(c.confidence * 100)}%</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            <div className="flex items-center justify-between border-t pt-4">
              <div className="text-xs text-muted-foreground">
                Draft <code>{draftId?.slice(0, 8)}</code>
                {candidates.length > 0 && (
                  <span className="ml-3">
                    {selectedCandidateUrls.length === 0
                      ? <span className="text-destructive">Pick at least 1 photo to continue</span>
                      : <span>{selectedCandidateUrls.length} of {candidates.length} selected</span>}
                  </span>
                )}
              </div>
              <Button
                onClick={() => setStep('B2')}
                disabled={streaming || (candidates.length > 0 && selectedCandidateUrls.length === 0)}
              >
                <Wand2 className="h-4 w-4 mr-2" /> Next: Enhance
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'B2' && (
        <Card>
          <CardHeader><CardTitle className="flex items-center justify-between">
            <span>Step B2 — Enhance original photo</span>
            <Button variant="outline" size="sm" onClick={() => setStep('B')}>← Back</Button>
          </CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Studio-grade retouch of your original upload — neutral background, soft lighting, square framing.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {photos.map((u, i) => (
                <div key={`o${i}`} className="border rounded-lg overflow-hidden">
                  <div className="aspect-square bg-muted"><img src={u} className="w-full h-full object-contain" alt="" /></div>
                  <div className="p-1 text-[10px] text-center text-muted-foreground">original</div>
                </div>
              ))}
              {enhancedUrls.map((u, i) => (
                <div key={`e${i}`} className="border-2 border-primary rounded-lg overflow-hidden">
                  <div className="aspect-square bg-muted"><img src={u} className="w-full h-full object-contain" alt="" /></div>
                  <div className="p-1 text-[10px] text-center text-primary font-medium">enhanced ✨</div>
                </div>
              ))}
            </div>
            <div className="flex justify-between border-t pt-4">
              <Button onClick={runEnhance} disabled={busy === 'enhance'}>
                {busy === 'enhance' ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enhancing…</> : <><Wand2 className="h-4 w-4 mr-2" /> Generate enhanced shot</>}
              </Button>
              <Button onClick={() => setStep('B3')} variant="default" disabled={enhancedUrls.length === 0}>
                <Camera className="h-4 w-4 mr-2" /> Next: Stage scenes
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'B3' && (
        <Card>
          <CardHeader><CardTitle className="flex items-center justify-between">
            <span>Step B3 — AI-staged composite shots</span>
            <Button variant="outline" size="sm" onClick={() => setStep('B2')}>← Back</Button>
          </CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Lifestyle, flat-lay, and bold studio variants — generated from the enhanced hero.</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {staged.map((s, i) => (
                <div key={i} className="border rounded-lg overflow-hidden">
                  <div className="aspect-square bg-muted"><img src={s.url} className="w-full h-full object-cover" alt={s.title} /></div>
                  <div className="p-2 text-xs text-center">{s.title}</div>
                </div>
              ))}
            </div>
            <div className="flex justify-between border-t pt-4">
              <Button onClick={runStage} disabled={busy === 'stage'} variant="outline">
                {busy === 'stage' ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Staging…</> : <><Camera className="h-4 w-4 mr-2" /> Generate 3 staged shots</>}
              </Button>
              <Button onClick={() => runCopyPricing()} disabled={busy === 'copy'}>
                {busy === 'copy' ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Writing copy…</> : <>Next: Copy & Pricing →</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'C' && (
        <Card>
          <CardHeader><CardTitle className="flex items-center justify-between">
            <span>Step C — Copy & Pricing (edit before publish)</span>
            <Button variant="outline" size="sm" onClick={() => setStep('B3')}>← Back</Button>
          </CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Title</Label><Input value={copy.title || ''} onChange={(e) => setCopy({ ...copy, title: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={copy.category_guess || ''} onValueChange={(v) => setCopy({ ...copy, category_guess: v })}>
                  <SelectTrigger><SelectValue placeholder="Pick a category" /></SelectTrigger>
                  <SelectContent>
                    {DD_CATEGORY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!copy.category_guess && (
                  <p className="text-xs text-destructive">
                    AI couldn't match {copy.category_raw ? `"${copy.category_raw}"` : 'a category'} — pick one before publishing.
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-2"><Label>Short description</Label><Textarea rows={2} value={copy.short_description || ''} onChange={(e) => setCopy({ ...copy, short_description: e.target.value })} /></div>
            <div className="space-y-2"><Label>Long description</Label><Textarea rows={5} value={copy.long_description || ''} onChange={(e) => setCopy({ ...copy, long_description: e.target.value })} /></div>
            <div className="space-y-2"><Label>Bullets (one per line)</Label>
              <Textarea rows={4} value={(copy.bullets || []).join('\n')} onChange={(e) => setCopy({ ...copy, bullets: e.target.value.split('\n').filter(Boolean) })} />
            </div>
            {/* Market context + pricing — ADMIN ONLY. Wholesalers (submitForReviewMode)
                enter cost in Step A and never see retail or margin; Dynasty prices at review. */}
            {!submitForReviewMode && (
              <>
                <div className="rounded-lg border p-3 space-y-2 bg-muted/20">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium flex items-center gap-2">
                        Market price check
                        {pricing.basis === 'market_informed' && <Badge>market-informed</Badge>}
                        {pricing.basis === 'floor_over_market' && <Badge variant="destructive">floor over market</Badge>}
                        {pricing.basis === 'formula_only' && <Badge variant="secondary">formula only</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">Live retail listings drive the suggestion. Margin floor stays the hard minimum.</div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => runMarketCheckAction()} disabled={busy === 'market'}>
                        {busy === 'market' ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Checking…</> : 'Check market'}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => runCopyPricing({ keepStep: true })} disabled={busy === 'copy'}>
                        {busy === 'copy' ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Re-pricing…</> : 'Re-price with market'}
                      </Button>
                    </div>
                  </div>
                  {marketCheck?.range && (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="secondary">low ${marketCheck.range.low}</Badge>
                      <Badge>median ${marketCheck.range.median}</Badge>
                      <Badge variant="secondary">high ${marketCheck.range.high}</Badge>
                      <span className="text-muted-foreground">from {marketCheck.range.count} listings</span>
                      {marketCheck.excluded && (
                        <span className="text-muted-foreground">
                          · filtered {marketCheck.excluded.bundles} bundles, {marketCheck.excluded.low_relevance} off-target, {marketCheck.excluded.outliers} outliers
                        </span>
                      )}
                    </div>
                  )}
                  {marketCheck && !marketCheck.range && (
                    <div className="text-xs text-amber-600">
                      {marketCheck.reason || 'No listings matched'} — priced from cost and margin only.
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {(['suggested_wholesale', 'suggested_store', 'suggested_retail', 'suggested_street'] as const).map((k) => (
                    <div key={k} className="space-y-1">
                      <Label className="text-xs">{k.replace('suggested_', '').toUpperCase()}</Label>
                      <Input type="number" step="0.01" value={pricing[k] ?? ''} onChange={(e) => setPricing({ ...pricing, [k]: Number(e.target.value) })} />
                    </div>
                  ))}
                </div>
                {pricing.rationale && <div className="text-xs text-muted-foreground italic">💡 {pricing.rationale}</div>}
              </>
            )}
            {submitForReviewMode && (
              <div className="rounded-lg border p-3 text-xs text-muted-foreground bg-muted/20">
                Retail pricing is set by Dynasty Direct during admin review. Your submission
                carries only your supplier cost — you never see or set the sale price.
              </div>
            )}


            <div className="flex justify-end border-t pt-4">
              <Button onClick={() => setStep('D')}>Next: Confirm Gate →</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'D' && (
        <Card>
          <CardHeader><CardTitle className="flex items-center justify-between">
            <span>Step D — Confirm Gate</span>
            <Button variant="outline" size="sm" onClick={() => setStep('C')}>← Back</Button>
          </CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Select the images that go live (first selected = hero). Nothing publishes without your tap.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {allGalleryImages.map((g, i) => {
                const checked = selectedImages.includes(g.url);
                return (
                  <button key={i} type="button" onClick={() => toggleSelect(g.url)}
                    className={`text-left border-2 rounded-lg overflow-hidden transition ${checked ? 'border-primary ring-2 ring-primary/30' : 'border-border'}`}>
                    <div className="aspect-square bg-muted relative">
                      <img src={g.url} className="w-full h-full object-contain" alt="" referrerPolicy="no-referrer" />
                      {checked && <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-1"><CheckCircle2 className="h-4 w-4" /></div>}
                      {checked && selectedImages[0] === g.url && <Badge className="absolute top-1 left-1 text-[10px]">HERO</Badge>}
                    </div>
                    <div className="p-1 text-[10px] text-center text-muted-foreground">{g.label}</div>
                  </button>
                );
              })}
            </div>
            {/* WHOLESALER ATTRIBUTION — David sees who this product attaches to before approving */}
            <div className="rounded-lg border-2 border-primary/40 p-3 bg-primary/5 flex items-center justify-between gap-3">
              <div className="text-sm">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Attaches to wholesaler</div>
                <div className="font-semibold">{selectedSupplierName || <span className="text-destructive">— missing —</span>}</div>
                {supplierId && <code className="text-[10px] text-muted-foreground">{supplierId}</code>}
              </div>
              <Badge variant={supplierId ? 'default' : 'destructive'}>{supplierId ? 'wholesaler_id ✓' : 'no wholesaler'}</Badge>
            </div>
            <div className="rounded-lg border p-4 bg-muted/30 space-y-2">
              <div className="font-semibold">{copy.title || productName}</div>
              <div className="text-sm text-muted-foreground">{copy.short_description}</div>
              {!submitForReviewMode && (
                <div className="flex gap-2 text-xs">
                  <Badge variant="outline">retail ${pricing.suggested_retail}</Badge>
                  <Badge variant="outline">store ${pricing.suggested_store}</Badge>
                  <Badge variant="outline">wholesale ${pricing.suggested_wholesale}</Badge>
                </div>
              )}
            </div>
            {/* Measurements block — AI estimate + verified gate (shipping bills on actuals) */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium">Shipping measurements</div>
                  <div className="text-xs text-muted-foreground">Publish requires verified weight + dimensions.</div>
                </div>
                <Button size="sm" variant="outline" onClick={runEstimateMeasurements} disabled={busy === 'estimate' || photos.length === 0}>
                  {busy === 'estimate' ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Estimating…</> : <><Sparkles className="h-3 w-3 mr-1" /> AI estimate from photo</>}
                </Button>
              </div>
              {measurementsEstimate && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="secondary" className="bg-amber-100 text-amber-900 border-amber-300">AI estimate — verify before publish</Badge>
                  <span className="text-muted-foreground">confidence: {measurementsEstimate.confidence}</span>
                  {measurementsEstimate.reasoning && <span className="text-muted-foreground italic">· {measurementsEstimate.reasoning}</span>}
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Weight (oz)</Label>
                  <Input type="number" step="0.1" value={measurements.weight_oz ?? ''} onChange={(e) => { setMeasurements({ ...measurements, weight_oz: e.target.value === '' ? null : Number(e.target.value) }); setMeasurementsVerified(false); }} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Length (in)</Label>
                  <Input type="number" step="0.1" value={measurements.length_in ?? ''} onChange={(e) => { setMeasurements({ ...measurements, length_in: e.target.value === '' ? null : Number(e.target.value) }); setMeasurementsVerified(false); }} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Width (in)</Label>
                  <Input type="number" step="0.1" value={measurements.width_in ?? ''} onChange={(e) => { setMeasurements({ ...measurements, width_in: e.target.value === '' ? null : Number(e.target.value) }); setMeasurementsVerified(false); }} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Height (in)</Label>
                  <Input type="number" step="0.1" value={measurements.height_in ?? ''} onChange={(e) => { setMeasurements({ ...measurements, height_in: e.target.value === '' ? null : Number(e.target.value) }); setMeasurementsVerified(false); }} />
                </div>
              </div>
              <label className="flex items-start gap-2 cursor-pointer pt-1 select-none">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={measurementsVerified}
                  onChange={(e) => setMeasurementsVerified(e.target.checked)}
                  disabled={!measurements.weight_oz || !measurements.length_in || !measurements.width_in || !measurements.height_in}
                />
                <span className="text-sm">
                  <span className="font-medium">Measurements verified</span>
                  <span className="text-muted-foreground"> — I physically confirmed weight and all three dimensions (shipping bills on actuals).</span>
                </span>
              </label>
            </div>

            {!published && (
              <div className="flex justify-end border-t pt-4">
                <Button size="lg" onClick={runPublish} disabled={busy === 'publish' || selectedImages.length === 0 || !measurementsVerified || !supplierId}>
                  {busy === 'publish' ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {submitForReviewMode ? 'Submitting…' : 'Publishing…'}</>
                    : <><Rocket className="h-4 w-4 mr-2" /> {submitForReviewMode ? 'Submit for admin review' : 'Confirm & publish live'}</>}
                </Button>
              </div>
            )}
            {published && (
              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center gap-2 text-emerald-600 font-medium">
                  <CheckCircle2 className="h-5 w-5" />
                  {submitForReviewMode
                    ? <span>Submitted to Dynasty Direct review queue · draft <code>{published.product_id.slice(0, 8)}</code></span>
                    : <span>Live on the catalog · product <code>{published.product_id.slice(0, 8)}</code></span>}
                </div>
                {!submitForReviewMode && (
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => navigate('/dynasty-direct/catalog')}>View Catalog</Button>
                    <Button onClick={sendToContentFactory} disabled={busy === 'content' || !!contentBriefId}>
                      {busy === 'content' ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating brief…</>
                        : contentBriefId ? <>✓ Brief sent</>
                        : <><Sparkles className="h-4 w-4 mr-2" /> Send to Content Factory</>}
                    </Button>
                    {contentBriefId && (
                      <Button variant="outline" onClick={() => navigate('/dynasty-direct/content-library')}>Open Content Library</Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
