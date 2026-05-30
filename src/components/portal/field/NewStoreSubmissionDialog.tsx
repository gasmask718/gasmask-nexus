/**
 * NewStoreSubmissionDialog
 *
 * Field-portal entry point for proposing a brand-new store.
 * Routes through the governance pipeline:
 *   submitFieldChange → field_submissions (entity_type='new_store')
 *   → admin approves → apply_field_submission INSERTs into store_master.
 *
 * Mobile-friendly. Address-first duplicate warning reuses
 * normalizeAddress() from validationEngine.
 */
import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Loader2, Plus, Store } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { submitFieldChange } from '@/services/fieldGovernance/submitFieldChange';
import type { FieldRole } from '@/services/fieldGovernance/types';
import { normalizeAddress } from '@/utils/validation/validationEngine';

interface NewStoreSubmissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  role: FieldRole;
  onSubmitted?: (submissionId: string) => void;
}

interface PotentialDuplicate {
  id: string;
  store_name: string;
  address: string;
  city: string;
  state: string;
}

const initialForm = {
  store_name: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  phone: '',
  owner_name: '',
  neighborhood: '',
  brand_interest: '',
  notes: '',
};

export function NewStoreSubmissionDialog({
  open,
  onOpenChange,
  userId,
  role,
  onSubmitted,
}: NewStoreSubmissionDialogProps) {
  const { toast } = useToast();
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [duplicates, setDuplicates] = useState<PotentialDuplicate[]>([]);
  const [checkingDup, setCheckingDup] = useState(false);
  const [ackDup, setAckDup] = useState(false);

  // Reset when dialog reopens
  useEffect(() => {
    if (open) {
      setForm(initialForm);
      setDuplicates([]);
      setAckDup(false);
    }
  }, [open]);

  const normalized = useMemo(() => normalizeAddress(form.address), [form.address]);

  // Debounced address duplicate check
  useEffect(() => {
    if (!normalized || normalized.length < 5) {
      setDuplicates([]);
      return;
    }
    const handle = setTimeout(async () => {
      setCheckingDup(true);
      const { data } = await supabase.rpc('check_store_address_duplicates', {
        p_address: form.address.trim(),
      });
      setDuplicates((data as PotentialDuplicate[] | null) ?? []);
      setCheckingDup(false);
    }, 400);
    return () => clearTimeout(handle);
  }, [normalized]);

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const canSubmit =
    form.store_name.trim() &&
    form.address.trim() &&
    form.city.trim() &&
    form.state.trim() &&
    form.zip.trim() &&
    !submitting &&
    (duplicates.length === 0 || ackDup);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);

    const payload_after: Record<string, unknown> = {
      store_name: form.store_name.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      state: form.state.trim().toUpperCase(),
      zip: form.zip.trim(),
      phone: form.phone.trim(),
      owner_name: form.owner_name.trim(),
      neighborhood: form.neighborhood.trim(),
      brand_interest: form.brand_interest.trim(),
      notes: form.notes.trim(),
      _potential_duplicates: duplicates.map((d) => ({ id: d.id, name: d.store_name })),
    };

    const result = await submitFieldChange(
      {
        store_id: null,
        entity_type: 'new_store',
        action_type: 'create',
        payload_after,
      },
      userId,
      role,
    );

    setSubmitting(false);

    if (!result.success) {
      toast({
        title: 'Submission failed',
        description: result.error ?? 'Unknown error',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'New store submitted',
      description: 'Pending admin approval. You will see it in the directory once approved.',
    });
    onSubmitted?.(result.submissionId!);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" /> Propose New Store
          </DialogTitle>
          <DialogDescription>
            Submit a new store you discovered in the field. An admin will review and approve.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Address FIRST for duplicate detection */}
          <div className="space-y-1.5">
            <Label htmlFor="ns-address">Street address *</Label>
            <Input
              id="ns-address"
              autoComplete="street-address"
              placeholder="123 Main St"
              value={form.address}
              onChange={update('address')}
            />
            {checkingDup && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Checking for existing stores…
              </p>
            )}
          </div>

          {duplicates.length > 0 && (
            <Alert variant="destructive" className="border-amber-500/40 bg-amber-500/10 text-foreground">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <AlertDescription className="space-y-2">
                <p className="font-medium text-sm">
                  {duplicates.length} possible duplicate{duplicates.length > 1 ? 's' : ''} at this address:
                </p>
                <ul className="text-xs space-y-1">
                  {duplicates.map((d) => (
                    <li key={d.id} className="truncate">
                      • <span className="font-medium">{d.store_name}</span> — {d.address}, {d.city}, {d.state}
                    </li>
                  ))}
                </ul>
                <label className="flex items-center gap-2 text-xs cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={ackDup}
                    onChange={(e) => setAckDup(e.target.checked)}
                  />
                  This is a genuinely different store — submit anyway
                </label>
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="ns-name">Store name *</Label>
            <Input
              id="ns-name"
              placeholder="Joe's Smoke Shop"
              value={form.store_name}
              onChange={update('store_name')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label htmlFor="ns-city">City *</Label>
              <Input id="ns-city" value={form.city} onChange={update('city')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ns-state">State *</Label>
              <Input
                id="ns-state"
                maxLength={2}
                placeholder="NY"
                value={form.state}
                onChange={update('state')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ns-zip">ZIP *</Label>
              <Input
                id="ns-zip"
                inputMode="numeric"
                value={form.zip}
                onChange={update('zip')}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ns-phone">Phone</Label>
            <Input
              id="ns-phone"
              type="tel"
              inputMode="tel"
              placeholder="555-123-4567"
              value={form.phone}
              onChange={update('phone')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ns-owner">Owner name</Label>
            <Input id="ns-owner" value={form.owner_name} onChange={update('owner_name')} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ns-neighborhood">Neighborhood</Label>
            <Input
              id="ns-neighborhood"
              placeholder="e.g. Bay Ridge"
              value={form.neighborhood}
              onChange={update('neighborhood')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ns-brand">Initial brand interest</Label>
            <Input
              id="ns-brand"
              placeholder="e.g. King Palm, Backwoods"
              value={form.brand_interest}
              onChange={update('brand_interest')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ns-notes">Notes</Label>
            <Textarea
              id="ns-notes"
              rows={2}
              placeholder="Anything the admin should know"
              value={form.notes}
              onChange={update('notes')}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting…
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" /> Submit for approval
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
