import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Camera, Loader2, Check, SkipForward, RotateCcw, AlertTriangle, CheckCircle2, DollarSign,
} from 'lucide-react';

/**
 * WHOLESALER QUICK ADD — camera first, automatic, one typed number.
 *
 * Point → point → (point) → type a price → done. Extraction runs by itself the
 * moment the shots are in. We only interrupt when something genuinely cannot
 * proceed (no label, unreadable weight/dims, low product confidence). Quality
 * control lives in the Dynasty admin review queue, NOT in the wholesaler's hands.
 *
 * Shots are uploaded immediately and remembered in localStorage, so a dropped
 * connection in a warehouse never loses work already taken.
 */

type Phase = 'capture' | 'processing' | 'gaps' | 'price' | 'submitting' | 'done';

const SHOTS = [
  { key: 'front', label: 'Front of the product', hint: 'Fill the frame. Straight on.', optional: false },
  { key: 'label', label: 'The label', hint: 'The panel with weight and dimensions.', optional: false },
  { key: 'angle', label: 'Another angle', hint: 'Optional — side, back, or the case.', optional: true },
] as const;

interface Props {
  supplierId: string;
  supplierName: string;
}

interface Measurements {
  weight_oz: number | null;
  length_in: number | null;
  width_in: number | null;
  height_in: number | null;
}

export function QuickAddCamera({ supplierId, supplierName }: Props) {
  const storageKey = `dd_quickadd_shots_${supplierId}`;

  const [phase, setPhase] = useState<Phase>('capture');
  const [shots, setShots] = useState<(string | null)[]>([null, null, null]);
  const [uploading, setUploading] = useState(false);
  const [activeShot, setActiveShot] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const [progress, setProgress] = useState<string[]>([]);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [recognition, setRecognition] = useState<any>(null);
  const [copy, setCopy] = useState<any>({});
  const [measurements, setMeasurements] = useState<Measurements>({
    weight_oz: null, length_in: null, width_in: null, height_in: null,
  });
  const [gaps, setGaps] = useState<string[]>([]);
  const [productName, setProductName] = useState('');
  const [cost, setCost] = useState('');
  const [addedToday, setAddedToday] = useState(0);
  const [lastAdded, setLastAdded] = useState<string>('');

  // ---- running count -------------------------------------------------------
  const loadCount = useCallback(async () => {
    const since = new Date(); since.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from('dd_catalog_drafts')
      .select('id', { count: 'exact', head: true })
      .eq('supplier_id', supplierId)
      .gte('created_at', since.toISOString());
    setAddedToday(count ?? 0);
  }, [supplierId]);

  useEffect(() => { loadCount(); }, [loadCount]);

  // ---- resume unfinished shots after a dropped connection ------------------
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as (string | null)[];
      if (Array.isArray(saved) && saved.some(Boolean)) {
        setShots(saved);
        setActiveShot(saved.findIndex((s) => !s) === -1 ? 2 : saved.findIndex((s) => !s));
        toast.message('Picked up where you left off', { description: 'Your earlier shots are still here.' });
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  function persist(next: (string | null)[]) {
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* quota */ }
  }
  function clearPersisted() {
    try { localStorage.removeItem(storageKey); } catch { /* */ }
  }

  // ---- capture -------------------------------------------------------------
  async function uploadShot(file: File, index: number) {
    setUploading(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `dd-quickadd/${supplierId}/${Date.now()}-${index}.${ext}`;
      let lastErr: any = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const { error } = await supabase.storage.from('product-images').upload(path, file, {
          contentType: file.type || 'image/jpeg', upsert: true,
        });
        if (!error) { lastErr = null; break; }
        lastErr = error;
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
      if (lastErr) throw lastErr;
      const { data } = supabase.storage.from('product-images').getPublicUrl(path);
      const next = [...shots];
      next[index] = data.publicUrl;
      setShots(next);
      persist(next);

      // AUTO-ADVANCE. No Next button to hunt for.
      if (index < 2) setActiveShot(index + 1);
      if (index === 1 || index === 2) {
        // Both required shots are in — start processing by itself.
        if (next[0] && next[1]) setTimeout(() => runProcessing(next), 350);
      }
    } catch (e: any) {
      toast.error('That shot did not upload', { description: e.message ?? 'Tap the button and try again — nothing else was lost.' });
    } finally {
      setUploading(false);
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('That is not a photo'); return; }
    uploadShot(file, activeShot);
  }

  function skipThird() {
    if (shots[0] && shots[1]) runProcessing(shots);
  }

  // ---- automatic processing -----------------------------------------------
  async function pipeline(body: any) {
    const { data, error } = await supabase.functions.invoke('dd-catalog-pipeline', { body });
    if (error) throw error;
    if (data?.ok === false) throw new Error(data.error || 'pipeline failed');
    return data;
  }

  async function runProcessing(currentShots: (string | null)[]) {
    setPhase('processing');
    setProgress(['Saving your photos…']);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const inputPhotos = currentShots.filter(Boolean) as string[];
      const { data: draft, error: draftErr } = await supabase.from('dd_catalog_drafts').insert({
        created_by: userRes.user?.id ?? null,
        supplier_id: supplierId,
        product_name: 'Pending photo read',
        input_photos: inputPhotos,
        status: 'candidates',
      }).select('id').single();
      if (draftErr || !draft) throw new Error(draftErr?.message || 'could not start a draft');
      setDraftId(draft.id);

      setProgress((p) => [...p, 'Reading the product…']);
      const rec = await pipeline({ mode: 'recognize_product', draft_id: draft.id, photo_url: currentShots[0] });
      setRecognition(rec);
      setProductName(rec.product_name || '');

      setProgress((p) => [...p, 'Reading the label…']);
      let label: any = null;
      try {
        label = await pipeline({
          mode: 'read_package_label', draft_id: draft.id,
          product_name: rec.product_name, photo_url: currentShots[1],
        });
      } catch (e: any) {
        setProgress((p) => [...p, `Label read failed — ${e.message}`]);
      }
      const n = label?.normalized ?? {};
      const m: Measurements = {
        weight_oz: n.weight_oz ?? null,
        length_in: n.dimensions?.length_in ?? null,
        width_in: n.dimensions?.width_in ?? null,
        height_in: n.dimensions?.height_in ?? null,
      };
      setMeasurements(m);

      setProgress((p) => [...p, 'Cleaning up the image…']);
      try {
        await pipeline({ mode: 'standardize_image', draft_id: draft.id, photo_url: currentShots[0] });
      } catch { setProgress((p) => [...p, 'Image cleanup skipped']); }

      setProgress((p) => [...p, 'Writing the listing…']);
      try {
        const c = await pipeline({
          mode: 'copy_pricing', draft_id: draft.id,
          product_name: rec.product_name, brand_hint: rec.brand_visible || '',
          cost: 0, hero_url: currentShots[0], supplier_id: supplierId,
        });
        setCopy({
          title: c.title, short_description: c.short_description, long_description: c.long_description,
          bullets: c.bullets || [], seo: c.seo || {}, tags: c.tags || [],
          category_guess: c.category_guess || '', category_raw: c.category_raw, category_source: c.category_source,
        });
      } catch { setProgress((p) => [...p, 'Listing text will be written at review']); }

      // WHAT ACTUALLY BLOCKS US — nothing else gets asked.
      const missing: string[] = [];
      if (!rec.product_name || rec.confidence === 'low') missing.push('name');
      if (label && label.label_detected === false) missing.push('weight', 'dims');
      else {
        if (!(Number(m.weight_oz) > 0)) missing.push('weight');
        if (!(Number(m.length_in) > 0 && Number(m.width_in) > 0 && Number(m.height_in) > 0)) missing.push('dims');
      }
      setGaps(missing);
      setPhase(missing.length ? 'gaps' : 'price');
    } catch (e: any) {
      toast.error(e.message ?? 'Processing failed');
      setPhase('capture');
    }
  }

  // ---- submit --------------------------------------------------------------
  async function submit() {
    if (!draftId) return;
    setPhase('submitting');
    try {
      const dims = (measurements.length_in && measurements.width_in && measurements.height_in)
        ? { length_in: measurements.length_in, width_in: measurements.width_in, height_in: measurements.height_in }
        : null;
      const { error } = await supabase.from('dd_catalog_drafts').update({
        product_name: productName.trim() || recognition?.product_name || 'Untitled item',
        cost: Number(cost) || null,
        recognition: recognition ?? null,
        copy,
        category: copy?.category_guess || null,
        selected: (shots.filter(Boolean) as string[]).map((url) => ({ url })),
        weight_oz: measurements.weight_oz,
        dimensions: dims,
        status: 'pending_admin_review',
      }).eq('id', draftId);
      if (error) throw error;

      clearPersisted();
      setLastAdded(productName.trim() || recognition?.product_name || 'Item');
      setAddedToday((c) => c + 1);
      setPhase('done');
      // Straight back to the camera for the next one.
      setTimeout(reset, 1200);
    } catch (e: any) {
      toast.error(e.message ?? 'Submit failed');
      setPhase('price');
    }
  }

  function reset() {
    setShots([null, null, null]);
    setActiveShot(0);
    setDraftId(null);
    setRecognition(null);
    setCopy({});
    setMeasurements({ weight_oz: null, length_in: null, width_in: null, height_in: null });
    setGaps([]);
    setProductName('');
    setCost('');
    setProgress([]);
    clearPersisted();
    setPhase('capture');
  }

  const gapsSatisfied =
    (!gaps.includes('name') || productName.trim().length > 1) &&
    (!gaps.includes('weight') || Number(measurements.weight_oz) > 0) &&
    (!gaps.includes('dims') || (Number(measurements.length_in) > 0 && Number(measurements.width_in) > 0 && Number(measurements.height_in) > 0));

  // -------------------------------------------------------------------------
  return (
    <div className="mx-auto w-full max-w-md px-4 pb-28 pt-4 space-y-4">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFile}
      />

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground truncate">{supplierName}</span>
        <span className="font-semibold">{addedToday} items added today</span>
      </div>

      {/* ---------------- CAPTURE ---------------- */}
      {phase === 'capture' && (
        <div className="space-y-4">
          <div className="text-center space-y-1">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Step {activeShot + 1} of 3
            </div>
            <h1 className="text-2xl font-bold leading-tight">{SHOTS[activeShot].label}</h1>
            <p className="text-sm text-muted-foreground">{SHOTS[activeShot].hint}</p>
          </div>

          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="w-full aspect-[4/5] rounded-2xl border-2 border-dashed border-primary/40 bg-muted/40 flex flex-col items-center justify-center gap-3 active:scale-[0.99] transition"
          >
            {uploading ? (
              <>
                <Loader2 className="h-14 w-14 animate-spin text-primary" />
                <span className="text-base font-medium">Saving the shot…</span>
              </>
            ) : (
              <>
                <Camera className="h-16 w-16 text-primary" />
                <span className="text-lg font-semibold">Tap to shoot</span>
              </>
            )}
          </button>

          <div className="grid grid-cols-3 gap-2">
            {SHOTS.map((s, i) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setActiveShot(i)}
                className={`relative aspect-square rounded-xl overflow-hidden border-2 ${
                  i === activeShot ? 'border-primary' : 'border-border'
                }`}
              >
                {shots[i] ? (
                  <>
                    <img src={shots[i] as string} alt={s.label} className="h-full w-full object-cover" />
                    <span className="absolute bottom-1 right-1 rounded-full bg-primary p-1">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </span>
                  </>
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground px-1 text-center">
                    {s.label}
                  </span>
                )}
              </button>
            ))}
          </div>

          {activeShot === 2 && shots[0] && shots[1] && (
            <Button variant="secondary" size="lg" className="w-full h-14 text-base" onClick={skipThird}>
              <SkipForward className="h-5 w-5 mr-2" /> Skip — that is enough
            </Button>
          )}

          {shots.some(Boolean) && (
            <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={reset}>
              <RotateCcw className="h-4 w-4 mr-2" /> Start this item over
            </Button>
          )}
        </div>
      )}

      {/* ---------------- PROCESSING ---------------- */}
      {phase === 'processing' && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-lg font-semibold">Working on it…</span>
            </div>
            <ul className="space-y-2 text-sm">
              {progress.map((line, i) => (
                <li key={i} className="flex items-center gap-2">
                  {i === progress.length - 1
                    ? <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                    : <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
                  <span className={i === progress.length - 1 ? '' : 'text-muted-foreground'}>{line}</span>
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-3 gap-2 pt-2">
              {shots.filter(Boolean).map((url, i) => (
                <img key={i} src={url as string} alt="" className="aspect-square rounded-lg object-cover" />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---------------- GAPS — only what genuinely blocks ---------------- */}
      {phase === 'gaps' && (
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm">
              Almost there — {gaps.includes('name') ? 'we could not read the product clearly' : 'the label did not read cleanly'}.
              Just this and you are done.
            </p>
          </div>

          {gaps.includes('name') && (
            <div className="space-y-1">
              <label className="text-base font-semibold">What is this item?</label>
              <Input
                className="h-14 text-lg"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Product name"
              />
            </div>
          )}

          {gaps.includes('weight') && (
            <div className="space-y-1">
              <label className="text-base font-semibold">We could not read the weight — what is it?</label>
              <Input
                type="number" inputMode="decimal" className="h-14 text-lg"
                value={measurements.weight_oz ?? ''}
                onChange={(e) => setMeasurements((m) => ({ ...m, weight_oz: Number(e.target.value) || null }))}
                placeholder="Ounces"
              />
            </div>
          )}

          {gaps.includes('dims') && (
            <div className="space-y-1">
              <label className="text-base font-semibold">Box size in inches</label>
              <div className="grid grid-cols-3 gap-2">
                {(['length_in', 'width_in', 'height_in'] as const).map((k, i) => (
                  <Input
                    key={k} type="number" inputMode="decimal" className="h-14 text-lg text-center"
                    value={measurements[k] ?? ''}
                    onChange={(e) => setMeasurements((m) => ({ ...m, [k]: Number(e.target.value) || null }))}
                    placeholder={['L', 'W', 'H'][i]}
                  />
                ))}
              </div>
            </div>
          )}

          <Button
            size="lg" className="w-full h-14 text-base"
            disabled={!gapsSatisfied}
            onClick={() => setPhase('price')}
          >
            Continue
          </Button>
        </div>
      )}

      {/* ---------------- ONE FIELD ---------------- */}
      {(phase === 'price' || phase === 'submitting') && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            {shots[0] && <img src={shots[0] as string} alt="" className="h-16 w-16 rounded-lg object-cover" />}
            <div className="min-w-0">
              <div className="font-semibold truncate">{productName || recognition?.product_name || 'Your item'}</div>
              <div className="text-xs text-muted-foreground">
                {measurements.weight_oz ? `${measurements.weight_oz} oz` : 'weight pending'}
                {measurements.length_in ? ` · ${measurements.length_in}×${measurements.width_in}×${measurements.height_in} in` : ''}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xl font-bold block">What do you want for this item?</label>
            <div className="relative">
              <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground" />
              <Input
                autoFocus
                type="number"
                inputMode="decimal"
                className="h-20 pl-14 text-4xl font-bold"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <p className="text-xs text-muted-foreground">Your cost per unit. Everything else is already filled in.</p>
          </div>

          <Button
            size="lg" className="w-full h-16 text-lg"
            disabled={!(Number(cost) > 0) || phase === 'submitting'}
            onClick={submit}
          >
            {phase === 'submitting'
              ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Submitting…</>
              : <>Submit item</>}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Dynasty Direct reviews every item before it goes live. You can edit it later from your product list.
          </p>
        </div>
      )}

      {/* ---------------- DONE ---------------- */}
      {phase === 'done' && (
        <Card className="border-emerald-500/40 bg-emerald-500/10">
          <CardContent className="p-8 text-center space-y-2">
            <CheckCircle2 className="h-14 w-14 text-emerald-500 mx-auto" />
            <div className="text-lg font-semibold">{lastAdded} submitted</div>
            <p className="text-sm text-muted-foreground">Back to the camera for the next one…</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
