import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PhotoUploadMultiple } from '@/components/store/PhotoUploadMultiple';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Sparkles, ChevronRight, CheckCircle2, ImageOff, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Candidate {
  url: string;
  source: string;
  confidence: number;
  attribution?: string;
  thumb?: string;
}

interface Supplier { id: string; company_name: string }

export default function DynastyDirectCatalogOnboard() {
  const navigate = useNavigate();

  // Step A — input
  const [productName, setProductName] = useState('');
  const [brandHint, setBrandHint] = useState('');
  const [cost, setCost] = useState<string>('');
  const [supplierId, setSupplierId] = useState<string>('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Wizard state
  const [step, setStep] = useState<'A' | 'B'>('A');
  const [draftId, setDraftId] = useState<string | null>(null);

  // Step B — source chain stream
  const [streaming, setStreaming] = useState(false);
  const [progressLog, setProgressLog] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [chainMeta, setChainMeta] = useState<{ adapters: string[]; primary: string; serpapi_available: boolean } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    supabase
      .from('wholesaler_profiles')
      .select('id, company_name')
      .order('company_name')
      .then(({ data }) => setSuppliers((data || []) as Supplier[]));
  }, []);

  const canStartB = productName.trim().length > 1 && photos.length > 0;

  async function startStepB() {
    if (!canStartB) return;
    setStreaming(true);
    setCandidates([]);
    setProgressLog([]);
    setChainMeta(null);

    // Persist draft
    const { data: userRes } = await supabase.auth.getUser();
    const { data: draft, error: draftErr } = await supabase
      .from('dd_catalog_drafts')
      .insert({
        created_by: userRes.user?.id ?? null,
        product_name: productName.trim(),
        supplier_id: supplierId || null,
        cost: cost ? Number(cost) : null,
        input_photos: photos,
        status: 'candidates',
      })
      .select('id')
      .single();
    if (draftErr || !draft) {
      toast.error(`Draft save failed: ${draftErr?.message}`);
      setStreaming(false);
      return;
    }
    setDraftId(draft.id);
    setStep('B');

    // Stream source-chain
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dd-catalog-source-chain`;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          product_name: productName.trim(),
          brand_hint: brandHint.trim() || undefined,
          image_url: photos[0],
        }),
        signal: ctrl.signal,
      });
      if (!resp.ok || !resp.body) throw new Error(`source-chain ${resp.status}`);

      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      const acc: Candidate[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) !== -1) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          try {
            const ev = JSON.parse(line);
            if (ev.type === 'progress') {
              if (ev.stage === 'init') {
                setChainMeta({ adapters: ev.adapters, primary: ev.primary, serpapi_available: ev.serpapi_available });
              }
              setProgressLog((p) => [...p, ev.stage + (ev.count !== undefined ? ` (${ev.count})` : '')]);
            } else if (ev.type === 'candidate') {
              acc.push(ev.candidate);
              setCandidates((c) => [...c, ev.candidate]);
            } else if (ev.type === 'done') {
              setCandidates(ev.candidates);
              // Persist
              await supabase
                .from('dd_catalog_drafts')
                .update({ candidates: ev.candidates })
                .eq('id', draft.id);
            }
          } catch { /* incomplete json — wait for more */ }
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') toast.error(`Stream error: ${e.message}`);
    } finally {
      setStreaming(false);
    }
  }

  function cancelStream() {
    abortRef.current?.abort();
    setStreaming(false);
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
            <Sparkles className="h-6 w-6 text-primary" /> Catalog Onboarding
          </h1>
          <p className="text-sm text-muted-foreground">
            Photo + name in → world-class product page out. Sprint 3 (B1 candidates live).
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 text-sm">
        <Badge variant={step === 'A' ? 'default' : 'outline'}>A · Input</Badge>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <Badge variant={step === 'B' ? 'default' : 'outline'}>B · Photo Engine</Badge>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <Badge variant="outline" className="opacity-50">C · Copy/Pricing</Badge>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <Badge variant="outline" className="opacity-50">D · Confirm Gate</Badge>
      </div>

      {step === 'A' && (
        <Card>
          <CardHeader>
            <CardTitle>Step A — Drop photo + name the product</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Product name *</Label>
                <Input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="e.g., Backwoods Honey Berry 5pk" />
              </div>
              <div className="space-y-2">
                <Label>Brand hint (optional)</Label>
                <Input value={brandHint} onChange={(e) => setBrandHint(e.target.value)} placeholder="Backwoods" />
              </div>
              <div className="space-y-2">
                <Label>Cost (USD)</Label>
                <Input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>Supplier</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                >
                  <option value="">— select supplier —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.company_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <PhotoUploadMultiple
              photos={photos}
              onChange={setPhotos}
              folder="dd-catalog-onboard"
              maxPhotos={6}
            />

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
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Step B — Photo Engine · Candidate Gallery</span>
              {streaming ? (
                <Button variant="outline" size="sm" onClick={cancelStream}>Stop</Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setStep('A')}>← Back</Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {chainMeta && (
              <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                <span>Source chain:</span>
                {chainMeta.adapters.map((a) => (
                  <Badge key={a} variant={a === chainMeta.primary ? 'default' : 'secondary'} className="text-[10px]">
                    {a}{a === chainMeta.primary ? ' · primary' : ''}
                  </Badge>
                ))}
                {!chainMeta.serpapi_available && (
                  <span className="text-amber-600">· SerpAPI dormant (add SERPAPI_KEY to promote)</span>
                )}
              </div>
            )}

            {progressLog.length > 0 && (
              <div className="text-xs font-mono text-muted-foreground space-y-1 max-h-24 overflow-y-auto bg-muted/30 rounded p-2">
                {progressLog.map((l, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {streaming && i === progressLog.length - 1 ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    )}
                    {l}
                  </div>
                ))}
              </div>
            )}

            {candidates.length === 0 && !streaming && (
              <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
                <ImageOff className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm font-medium">No official photos found</p>
                <p className="text-xs">Step B2 (enhanced) + B3 (AI-staged) will carry the gallery — coming next.</p>
              </div>
            )}

            {candidates.length > 0 && (
              <>
                <div className="text-sm font-medium">
                  {candidates.length} candidate{candidates.length === 1 ? '' : 's'} found
                  {streaming && <span className="text-muted-foreground"> · still searching…</span>}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {candidates.map((c, i) => (
                    <div key={i} className="border rounded-lg overflow-hidden bg-card">
                      <div className="aspect-square bg-muted">
                        <img
                          src={c.thumb || c.url}
                          alt={`candidate ${i + 1}`}
                          className="w-full h-full object-contain"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0.2'; }}
                        />
                      </div>
                      <div className="p-2 text-[11px] space-y-1">
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary" className="text-[10px]">{c.source}</Badge>
                          <span className="text-muted-foreground">{Math.round(c.confidence * 100)}%</span>
                        </div>
                        {c.attribution && (
                          <div className="truncate text-muted-foreground" title={c.attribution}>{c.attribution}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="flex items-center justify-between border-t pt-4">
              <div className="text-xs text-muted-foreground">
                Draft: <code className="text-[10px]">{draftId?.slice(0, 8) ?? '—'}</code>
              </div>
              <Button disabled title="Step B2 (enhance) + B3 (staged) ship next">
                Next: Enhance & Stage →
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
