import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PhotoUploadMultiple } from '@/components/store/PhotoUploadMultiple';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, ScanLine, AlertTriangle, CheckCircle2 } from 'lucide-react';

export interface LabelMeasurements {
  weight_oz: number | null;
  length_in: number | null;
  width_in: number | null;
  height_in: number | null;
}

interface Props {
  draftId: string | null;
  productName?: string;
  measurements: LabelMeasurements;
  onMeasurements: (m: LabelMeasurements, opts: { fromLabel: boolean; complete: boolean }) => void;
}

/**
 * PACKAGING LABEL CAPTURE.
 *
 * Retail and case packaging almost always PRINTS net/gross weight, case
 * dimensions, units per case and a UPC. Reading that panel is faster and far
 * more accurate than a wholesaler estimating with a tape measure — and these
 * numbers set the shipping cost on every future order of the product, so a
 * guess becomes a carrier re-weigh adjustment weeks later, billed invisibly
 * against Dynasty's account.
 */
export function PackageLabelCapture({ draftId, productName, measurements, onMeasurements }: Props) {
  const [labelPhotos, setLabelPhotos] = useState<string[]>([]);
  const [reading, setReading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [noLabel, setNoLabel] = useState(false);

  const printed = result?.printed ?? {};

  async function readLabel() {
    if (labelPhotos.length === 0) return;
    setReading(true);
    try {
      const { data, error } = await supabase.functions.invoke('dd-catalog-pipeline', {
        body: {
          mode: 'read_package_label',
          draft_id: draftId,
          product_name: productName,
          photo_url: labelPhotos[0],
        },
      });
      if (error) throw error;
      if (data?.ok === false) throw new Error(data.error || 'label read failed');
      setResult(data);

      const n = data?.normalized ?? {};
      onMeasurements(
        {
          weight_oz: n.weight_oz ?? measurements.weight_oz,
          length_in: n.dimensions?.length_in ?? measurements.length_in,
          width_in: n.dimensions?.width_in ?? measurements.width_in,
          height_in: n.dimensions?.height_in ?? measurements.height_in,
        },
        { fromLabel: true, complete: !!data?.complete },
      );

      if (data?.label_detected === false) {
        toast.message('No printed spec panel found in that photo', {
          description: 'Retake the label photo, or enter weight and dimensions by hand below.',
        });
      } else if (data?.complete) {
        toast.success('Label read — weight and all three dimensions captured');
      } else {
        toast.message('Partial read', { description: 'Fill the missing fields by hand — publish still needs all four.' });
      }
    } catch (e: any) {
      toast.error(e.message ?? 'Could not read the label');
    } finally {
      setReading(false);
    }
  }

  function set(field: keyof LabelMeasurements, raw: string) {
    onMeasurements(
      { ...measurements, [field]: raw === '' ? null : Number(raw) },
      { fromLabel: false, complete: false },
    );
  }

  const billableNote = (() => {
    const { weight_oz, length_in, width_in, height_in } = measurements;
    if (!weight_oz || !length_in || !width_in || !height_in) return null;
    const dimOz = ((length_in * width_in * height_in) / 139) * 16;
    const billable = Math.max(weight_oz, dimOz);
    return {
      dim: Math.round(dimOz * 10) / 10,
      billable: Math.round(billable * 10) / 10,
      driver: dimOz > weight_oz ? 'dimensional' : 'actual',
    };
  })();

  return (
    <div className="rounded-lg border border-border/60 p-4 space-y-4">
      <div>
        <div className="text-sm font-medium flex items-center gap-2">
          <ScanLine className="h-4 w-4" /> Step 2 — photograph the packaging label
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Photograph the label showing weight and dimensions — usually on the side or bottom of the box.
          Include the whole printed panel (NET WT, GROSS WT, DIMS/SIZE, units per case, UPC).
        </p>
      </div>

      <PhotoUploadMultiple photos={labelPhotos} onChange={setLabelPhotos} folder="dd-catalog-labels" maxPhotos={1} />

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" disabled={labelPhotos.length === 0 || reading} onClick={readLabel}>
          {reading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ScanLine className="h-4 w-4 mr-2" />}
          Read the label
        </Button>
        <Button
          size="sm"
          variant={noLabel ? 'default' : 'outline'}
          onClick={() => setNoLabel((v) => !v)}
        >
          This product has no printed label
        </Button>
        {result?.complete && (
          <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/40">
            <CheckCircle2 className="h-3 w-3 mr-1" /> shipping fields read from label
          </Badge>
        )}
        {result && !result.complete && (
          <Badge variant="secondary" className="bg-amber-500/15 text-amber-500 border-amber-500/40">
            <AlertTriangle className="h-3 w-3 mr-1" /> partial read — finish by hand
          </Badge>
        )}
      </div>

      {noLabel && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
          Loose, unpackaged or produce items have nothing printed to read. Weigh and measure the shipping
          parcel and enter all four values by hand — publish still requires them.
        </div>
      )}

      {result && (
        <div className="space-y-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">confidence: {result.confidence}</Badge>
            {result.normalized?.weight_source && (
              <Badge variant="outline">weight from {result.normalized.weight_source} weight</Badge>
            )}
            {result.units_per_case && <Badge variant="outline">{result.units_per_case} per case</Badge>}
            {result.upc && <Badge variant="outline">UPC {result.upc}</Badge>}
            {result.shipping_class && <Badge variant="outline">{result.shipping_class}</Badge>}
          </div>
          {result.notes && <p className="text-muted-foreground italic">{result.notes}</p>}
          <div className="grid gap-1 text-muted-foreground">
            {printed.net_weight?.printed_as && <div>Label reads (net): “{printed.net_weight.printed_as}”</div>}
            {printed.gross_weight?.printed_as && <div>Label reads (gross): “{printed.gross_weight.printed_as}”</div>}
            {printed.dimensions?.printed_as && <div>Label reads (dims): “{printed.dimensions.printed_as}”</div>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Weight (oz)</Label>
          <Input type="number" step="0.1" value={measurements.weight_oz ?? ''} onChange={(e) => set('weight_oz', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Length (in)</Label>
          <Input type="number" step="0.1" value={measurements.length_in ?? ''} onChange={(e) => set('length_in', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Width (in)</Label>
          <Input type="number" step="0.1" value={measurements.width_in ?? ''} onChange={(e) => set('width_in', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Height (in)</Label>
          <Input type="number" step="0.1" value={measurements.height_in ?? ''} onChange={(e) => set('height_in', e.target.value)} />
        </div>
      </div>

      {billableNote && (
        <p className="text-xs text-muted-foreground">
          Carriers bill the greater of actual and dimensional weight (L×W×H ÷ 139):
          actual {measurements.weight_oz} oz · dimensional {billableNote.dim} oz →{' '}
          <span className="text-foreground font-medium">billable {billableNote.billable} oz ({billableNote.driver})</span>.
        </p>
      )}
    </div>
  );
}
