/**
 * ProspectPromoteDialog — the ONLY conversion path from the read-only prospect
 * layer into the CRM. Calls request_store_promotion, which files a PENDING
 * request for owner/admin approval. It never creates a store_master row.
 */
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import type { AmbassadorProspect } from '@/hooks/useAmbassadorProspects';

interface Props {
  prospect: AmbassadorProspect | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: {
    prospectId: string;
    candidateId?: string | null;
    storeName: string;
    contactName: string;
    phone?: string | null;
    sellsTobacco: boolean;
    sellsGrabba: boolean;
  }) => Promise<unknown>;
  isSubmitting: boolean;
}

export function ProspectPromoteDialog({ prospect, open, onOpenChange, onSubmit, isSubmitting }: Props) {
  const [storeName, setStoreName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [sellsTobacco, setSellsTobacco] = useState(false);
  const [sellsGrabba, setSellsGrabba] = useState(false);

  useEffect(() => {
    if (open && prospect) {
      setStoreName(prospect.store_name || '');
      setContactName('');
      setPhone(prospect.phone || '');
      setSellsTobacco(false);
      setSellsGrabba(false);
    }
  }, [open, prospect]);

  if (!prospect) return null;

  const canSubmit = storeName.trim().length > 0 && contactName.trim().length > 0 && !isSubmitting;

  const handleSubmit = async () => {
    await onSubmit({
      prospectId: prospect.prospect_id,
      candidateId: prospect.candidate_id,
      storeName: storeName.trim(),
      contactName: contactName.trim(),
      phone: phone.trim() || null,
      sellsTobacco,
      sellsGrabba,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm this location</DialogTitle>
          <DialogDescription>
            This sends the location for approval. It does not become a store, and it is not
            assigned to you, until an admin approves it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{prospect.full_address}</p>
          <div className="space-y-1">
            <Label htmlFor="p-name">Store name</Label>
            <Input id="p-name" value={storeName} onChange={(e) => setStoreName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="p-contact">Contact person</Label>
            <Input id="p-contact" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Who did you speak with?" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="p-phone">Phone (optional)</Label>
            <Input id="p-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={sellsTobacco} onCheckedChange={(v) => setSellsTobacco(v === true)} />
            Sells tobacco
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={sellsGrabba} onCheckedChange={(v) => setSellsGrabba(v === true)} />
            Sells Grabba
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Send for approval
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
