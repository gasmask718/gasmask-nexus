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

interface Candidate { url: string; source: string; confidence: number; attribution?: string; thumb?: string }
interface Supplier { id: string; company_name: string }
interface Staged { title: string; url: string; prompt?: string }

type Step = 'A' | 'B' | 'B2' | 'B3' | 'C' | 'D';

export default function DynastyDirectCatalogOnboard() {
  const navigate = useNavigate();

  // Step A
  const [productName, setProductName] = useState('');
  const [brandHint, setBrandHint] = useState('');
  const [cost, setCost] = useState<string>('');
  const [supplierId, setSupplierId] = useState<string>('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Wizard
  const [step, setStep] = useState<Step>('A');
  const [draftId, setDraftId] = useState<string | null>(null);

  // B1 stream
  const [streaming, setStreaming] = useState(false);
  const [progressLog, setProgressLog] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
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

  useEffect(() => {
    supabase.from('wholesaler_profiles').select('id, company_name').order('company_name')
      .then(({ data }) => setSuppliers((data || []) as Supplier[]));
  }, []);

  const canStartB = productName.trim().length > 1 && photos.length > 0;
  const allGalleryImages: { url: string; label: string }[] = [
    ...photos.map((url) => ({ url, label: 'original' })),
    ...candidates.map((c) => ({ url: c.url, label: `found · ${c.source}` })),
    ...enhancedUrls.map((url) => ({ url, label: 'enhanced' })),
    ...staged.map((s) => ({ url: s.url, label: `staged · ${s.title}` })),
  ];

  function toggleSelect(url: string) {
    setSelectedImages((s) => s.includes(url) ? s.filter((u) => u !== url) : [...s, url]);
  }

  async function startStepB() {
    if (!canStartB) return;
    setStreaming(true);
    setCandidates([]); setProgressLog([]); setChainMeta(null);

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
    const hero = enhancedUrls[0] || candidates[0]?.url || photos[0];
    if (!draftId || !hero) return;
    setBusy('stage');
    try {
      const r = await callPipeline({ mode: 'stage', draft_id: draftId, hero_url: hero, product_name: productName, count: 3 });
      setStaged((s) => [...s, ...(r.staged || [])]);
      toast.success(`${r.staged?.length || 0} staged shots ready`);
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  }

  async function runCopyPricing() {
    if (!draftId) return;
    setBusy('copy');
    try {
      const hero = selectedImages[0] || enhancedUrls[0] || photos[0];
      const r = await callPipeline({ mode: 'copy_pricing', draft_id: draftId, product_name: productName, brand_hint: brandHint, cost: Number(cost) || 0, hero_url: hero });
      setCopy({
        title: r.title, short_description: r.short_description, long_description: r.long_description,
        bullets: r.bullets || [], seo: r.seo || {}, category_guess: r.category_guess, tags: r.tags || [],
      });
      setPricing(r.pricing || {});
      setStep('C');
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  }

  async function runPublish() {
    if (!draftId) return;
    if (selectedImages.length === 0) { toast.error('Select at least one image for the live product'); return; }
    setBusy('publish');
    try {
      await supabase.from('dd_catalog_drafts').update({
        selected: selectedImages.map((url) => ({ url })),
        copy, pricing,
      }).eq('id', draftId);
      const r = await callPipeline({ mode: 'publish', draft_id: draftId });
      setPublished({ product_id: r.product_id });
      toast.success('Product is LIVE on the catalog');
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
              <div className="space-y-2"><Label>Cost (USD)</Label><Input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} /></div>
              <div className="space-y-2"><Label>Supplier</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                  <option value="">— select supplier —</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.company_name}</option>)}
                </select>
              </div>
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {candidates.map((c, i) => (
                  <div key={i} className="border rounded-lg overflow-hidden bg-card">
                    <div className="aspect-square bg-muted">
                      <img src={c.thumb || c.url} alt="" className="w-full h-full object-contain" loading="lazy" referrerPolicy="no-referrer"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0.2'; }} />
                    </div>
                    <div className="p-2 text-[11px] flex items-center justify-between">
                      <Badge variant="secondary" className="text-[10px]">{c.source}</Badge>
                      <span className="text-muted-foreground">{Math.round(c.confidence * 100)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between border-t pt-4">
              <div className="text-xs text-muted-foreground">Draft <code>{draftId?.slice(0, 8)}</code></div>
              <Button onClick={() => setStep('B2')} disabled={streaming}><Wand2 className="h-4 w-4 mr-2" /> Next: Enhance</Button>
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
              <Button onClick={runCopyPricing} disabled={busy === 'copy'}>
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
              <div className="space-y-2"><Label>Category</Label><Input value={copy.category_guess || ''} onChange={(e) => setCopy({ ...copy, category_guess: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Short description</Label><Textarea rows={2} value={copy.short_description || ''} onChange={(e) => setCopy({ ...copy, short_description: e.target.value })} /></div>
            <div className="space-y-2"><Label>Long description</Label><Textarea rows={5} value={copy.long_description || ''} onChange={(e) => setCopy({ ...copy, long_description: e.target.value })} /></div>
            <div className="space-y-2"><Label>Bullets (one per line)</Label>
              <Textarea rows={4} value={(copy.bullets || []).join('\n')} onChange={(e) => setCopy({ ...copy, bullets: e.target.value.split('\n').filter(Boolean) })} />
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
            <div className="rounded-lg border p-4 bg-muted/30 space-y-2">
              <div className="font-semibold">{copy.title || productName}</div>
              <div className="text-sm text-muted-foreground">{copy.short_description}</div>
              <div className="flex gap-2 text-xs">
                <Badge variant="outline">retail ${pricing.suggested_retail}</Badge>
                <Badge variant="outline">store ${pricing.suggested_store}</Badge>
                <Badge variant="outline">wholesale ${pricing.suggested_wholesale}</Badge>
              </div>
            </div>
            {!published && (
              <div className="flex justify-end border-t pt-4">
                <Button size="lg" onClick={runPublish} disabled={busy === 'publish' || selectedImages.length === 0}>
                  {busy === 'publish' ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Publishing…</>
                    : <><Rocket className="h-4 w-4 mr-2" /> Confirm & publish live</>}
                </Button>
              </div>
            )}
            {published && (
              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center gap-2 text-emerald-600 font-medium">
                  <CheckCircle2 className="h-5 w-5" /> Live on the catalog · product <code>{published.product_id.slice(0, 8)}</code>
                </div>
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
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
