import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Search, ShieldCheck, AlertTriangle, CheckCircle2, Wrench } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RepairLineItem {
  line_item_id: string;
  product_id: string;
  product_name: string;
  track_by: string;
  computed_units: number;
  posted_units: number;
  delta_needed: number;
  needs_repair: boolean;
}

interface RepairPreview {
  success: boolean;
  error?: string;
  invoice_id: string;
  invoice_number: string;
  store_id: string;
  status: string;
  repair_status: string;
  line_items: RepairLineItem[];
  tubes_delta_needed: number;
  bags_delta_needed: number;
  needs_repair: boolean;
}

export function HistoricalRepairPanel() {
  const [searchValue, setSearchValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<RepairPreview | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [reason, setReason] = useState('');
  const [applying, setApplying] = useState(false);

  const handlePreview = async () => {
    if (!searchValue.trim()) return;
    setLoading(true);
    setPreview(null);

    try {
      // Try to find invoice by number or ID
      let invoiceId = searchValue.trim();

      // If it doesn't look like a UUID, search by invoice_number
      if (!invoiceId.match(/^[0-9a-f]{8}-/i)) {
        const { data } = await supabase
          .from('invoices')
          .select('id')
          .eq('invoice_number', invoiceId)
          .maybeSingle();
        if (!data) {
          toast.error('Invoice not found');
          setLoading(false);
          return;
        }
        invoiceId = data.id;
      }

      const { data, error } = await supabase.rpc('preview_invoice_repair', {
        p_invoice_id: invoiceId,
      });

      if (error) throw error;

      const result = data as unknown as RepairPreview;
      if (!result.success) {
        toast.error(result.error || 'Preview failed');
      } else {
        setPreview(result);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to preview repair');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyRepair = async () => {
    if (!preview || !reason.trim()) return;
    setApplying(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id || 'unknown';

      const { data, error } = await supabase.rpc('repair_invoice_units', {
        p_invoice_id: preview.invoice_id,
        p_reason: reason.trim(),
        p_user_id: userId,
      });

      if (error) throw error;

      const result = data as any;
      if (!result.success) {
        toast.error(result.error || 'Repair failed');
      } else {
        toast.success(
          `Repair complete: ${result.postings_made} posting(s) made. Status: ${result.status}`
        );
        setShowConfirm(false);
        setReason('');
        // Re-preview to show updated state
        handlePreview();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to apply repair');
    } finally {
      setApplying(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Wrench className="h-5 w-5 text-primary" />
          Historical Invoice Repair
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="flex gap-2">
          <Input
            placeholder="Invoice number or ID..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handlePreview()}
          />
          <Button onClick={handlePreview} disabled={loading || !searchValue.trim()}>
            <Search className="h-4 w-4 mr-1" />
            {loading ? 'Loading...' : 'Preview'}
          </Button>
        </div>

        {/* Preview Results */}
        {preview && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-sm">{preview.invoice_number}</span>
                <Badge variant="secondary" className="ml-2">{preview.status}</Badge>
                {preview.repair_status && preview.repair_status !== 'none' && (
                  <Badge variant="default" className="ml-1">{preview.repair_status}</Badge>
                )}
              </div>
              {preview.needs_repair ? (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Repair Needed
                </Badge>
              ) : (
                <Badge variant="default" className="flex items-center gap-1 bg-green-600">
                  <CheckCircle2 className="h-3 w-3" /> Verified
                </Badge>
              )}
            </div>

            {/* Line items table */}
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2 font-medium">Product</th>
                    <th className="text-center p-2 font-medium">Type</th>
                    <th className="text-right p-2 font-medium">Expected</th>
                    <th className="text-right p-2 font-medium">Posted</th>
                    <th className="text-right p-2 font-medium">Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.line_items.map((line) => (
                    <tr key={line.line_item_id} className={line.needs_repair ? 'bg-destructive/5' : ''}>
                      <td className="p-2">{line.product_name}</td>
                      <td className="text-center p-2">
                        <Badge variant="outline" className="text-xs">{line.track_by}</Badge>
                      </td>
                      <td className="text-right p-2 font-mono">{-line.computed_units}</td>
                      <td className="text-right p-2 font-mono">{line.posted_units}</td>
                      <td className="text-right p-2 font-mono font-semibold">
                        {line.delta_needed !== 0 ? (
                          <span className="text-destructive">{line.delta_needed}</span>
                        ) : (
                          <span className="text-green-600">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary */}
            <div className="flex gap-4 text-sm">
              {preview.tubes_delta_needed !== 0 && (
                <span>Tubes delta: <strong className="text-destructive">{preview.tubes_delta_needed}</strong></span>
              )}
              {preview.bags_delta_needed !== 0 && (
                <span>Bags delta: <strong className="text-destructive">{preview.bags_delta_needed}</strong></span>
              )}
            </div>

            {/* Apply button */}
            {preview.needs_repair && (
              <Button onClick={() => setShowConfirm(true)} variant="destructive" className="w-full">
                <ShieldCheck className="h-4 w-4 mr-2" />
                Apply Repair
              </Button>
            )}
          </div>
        )}

        {/* Confirmation Dialog */}
        <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Invoice Repair</DialogTitle>
              <DialogDescription>
                This will post corrective ledger entries for {preview?.invoice_number}. 
                This action is append-only and cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Label>Reason for repair (required)</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Legacy invoice missing bag ledger entries"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={handleApplyRepair}
                disabled={applying || !reason.trim()}
              >
                {applying ? 'Applying...' : 'Confirm Repair'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
