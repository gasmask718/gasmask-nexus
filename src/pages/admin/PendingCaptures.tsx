import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Check, X, MapPin, Camera, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { dynastyRelative } from '@/lib/dates';

const STORE_TYPE_OPTIONS = [
  { value: 'bodega', label: 'Bodega / Deli' },
  { value: 'smoke_shop', label: 'Smoke Shop' },
  { value: 'gas_station', label: 'Gas Station' },
  { value: 'wholesaler', label: 'Wholesaler' },
  { value: 'other', label: 'Other' },
];

interface CaptureRow {
  id: string;
  name: string | null;
  address_street: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  type: string | null;
  notes: string | null;
  captured_role: string | null;
  captured_at: string | null;
  captured_by_user_id: string | null;
  storefront_photo_url: string | null;
}

export default function PendingCaptures() {
  const qc = useQueryClient();

  const { data: captures, isLoading } = useQuery({
    queryKey: ['pending-captures'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select(
          'id, name, address_street, phone, lat, lng, type, notes, captured_role, captured_at, captured_by_user_id, storefront_photo_url'
        )
        .eq('approval_status', 'pending')
        .is('deleted_at', null)
        .order('captured_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CaptureRow[];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ storeId, type }: { storeId: string; type: string }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('stores')
        .update({
          approval_status: 'approved',
          approved_by_user_id: u.user?.id,
          approved_at: new Date().toISOString(),
          status: 'prospect',
          type,
        } as any)
        .eq('id', storeId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Capture approved and added to system');
      qc.invalidateQueries({ queryKey: ['pending-captures'] });
      qc.invalidateQueries({ queryKey: ['pending-captures-count'] });
    },
    onError: (err: any) => {
      toast.error('Approval failed', { description: err.message });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ storeId, reason }: { storeId: string; reason: string }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('stores')
        .update({
          approval_status: 'rejected',
          approved_by_user_id: u.user?.id,
          approved_at: new Date().toISOString(),
          rejection_reason: reason,
        } as any)
        .eq('id', storeId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Capture rejected');
      qc.invalidateQueries({ queryKey: ['pending-captures'] });
      qc.invalidateQueries({ queryKey: ['pending-captures-count'] });
    },
    onError: (err: any) => {
      toast.error('Rejection failed', { description: err.message });
    },
  });

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Loading pending captures…</div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Camera className="h-6 w-6" />
          Pending Captures
          {captures && captures.length > 0 && (
            <span className="text-muted-foreground text-base font-normal">
              ({captures.length})
            </span>
          )}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Field captures awaiting review. Verify type and details before approving.
        </p>
      </div>

      {!captures || captures.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          No captures pending review. All caught up.
        </Card>
      ) : (
        <div className="space-y-4">
          {captures.map((capture) => (
            <CaptureReviewCard
              key={capture.id}
              capture={capture}
              onApprove={(type: string) =>
                approveMutation.mutate({ storeId: capture.id, type })
              }
              onReject={(reason: string) =>
                rejectMutation.mutate({ storeId: capture.id, reason })
              }
              isPending={approveMutation.isPending || rejectMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface CardProps {
  capture: CaptureRow;
  onApprove: (type: string) => void;
  onReject: (reason: string) => void;
  isPending: boolean;
}

function CaptureReviewCard({ capture, onApprove, onReject, isPending }: CardProps) {
  const [selectedType, setSelectedType] = useState<string>(capture.type || 'bodega');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  return (
    <Card className="p-4">
      <div className="grid md:grid-cols-[200px_1fr] gap-4">
        {capture.storefront_photo_url ? (
          <a
            href={capture.storefront_photo_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <img
              src={capture.storefront_photo_url}
              alt={capture.name || 'Storefront'}
              className="w-full h-40 object-cover rounded-md border"
            />
          </a>
        ) : (
          <div className="w-full h-40 bg-muted rounded-md flex items-center justify-center text-muted-foreground">
            <Camera className="h-8 w-8 opacity-40" />
          </div>
        )}

        <div className="space-y-3">
          <h3 className="text-lg font-semibold">{capture.name || 'Unnamed store'}</h3>

          <div className="text-sm text-muted-foreground space-y-1">
            <p>{capture.address_street || '—'}</p>
            {capture.phone && <p>{capture.phone}</p>}
          </div>

          {capture.lat && capture.lng && (
            <a
              href={`https://maps.google.com/?q=${capture.lat},${capture.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <MapPin className="h-3 w-3" />
              View on map
              <ExternalLink className="h-3 w-3" />
            </a>
          )}

          <p className="text-xs text-muted-foreground">
            Captured by <span className="font-medium">{capture.captured_role || 'unknown'}</span>{' '}
            {capture.captured_at && dynastyRelative(capture.captured_at)}
          </p>

          {capture.notes && (
            <div className="text-sm bg-muted/50 rounded-md p-2 border">
              {capture.notes}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor={`type-${capture.id}`}>Confirm store type</Label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger id={`type-${capture.id}`} className="w-full md:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STORE_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              size="sm"
              onClick={() => onApprove(selectedType)}
              disabled={isPending}
            >
              <Check className="h-4 w-4" />
              Approve as {STORE_TYPE_OPTIONS.find((o) => o.value === selectedType)?.label}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowRejectDialog(true)}
              disabled={isPending}
            >
              <X className="h-4 w-4" />
              Reject
            </Button>
          </div>

          {showRejectDialog && (
            <div className="space-y-2 pt-2 border-t">
              <Label htmlFor={`reason-${capture.id}`}>Reason for rejection</Label>
              <Textarea
                id={`reason-${capture.id}`}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g., duplicate of existing store, blurry photo, etc."
                rows={2}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    onReject(rejectReason);
                    setShowRejectDialog(false);
                    setRejectReason('');
                  }}
                  disabled={!rejectReason.trim() || isPending}
                >
                  Confirm reject
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowRejectDialog(false);
                    setRejectReason('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
