import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MapPin, Camera, ExternalLink, Flag, Trash2 } from 'lucide-react';
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
  status: string | null;
}

export default function RecentlyAddedStores() {
  const qc = useQueryClient();

  const { data: recentCaptures, isLoading } = useQuery({
    queryKey: ['recently-added-captures'],
    queryFn: async () => {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const { data, error } = await supabase
        .from('stores')
        .select(
          'id, name, address_street, phone, lat, lng, type, notes, captured_role, captured_at, captured_by_user_id, storefront_photo_url, status'
        )
        .not('captured_at', 'is', null)
        .gte('captured_at', ninetyDaysAgo.toISOString())
        .is('deleted_at', null)
        .order('captured_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CaptureRow[];
    },
  });

  const updateTypeMutation = useMutation({
    mutationFn: async ({ storeId, type }: { storeId: string; type: string }) => {
      const { error } = await supabase
        .from('stores')
        .update({ type } as any)
        .eq('id', storeId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Store type updated');
      qc.invalidateQueries({ queryKey: ['recently-added-captures'] });
    },
    onError: (err: any) => toast.error('Update failed', { description: err.message }),
  });

  const flagMutation = useMutation({
    mutationFn: async ({ storeId, reason, currentNotes }: { storeId: string; reason: string; currentNotes: string | null }) => {
      const stamp = new Date().toISOString();
      const flagLine = `🚩 FLAGGED ${stamp}: ${reason}`;
      const newNotes = currentNotes ? `${flagLine}\n${currentNotes}` : flagLine;
      const { error } = await supabase
        .from('stores')
        .update({ notes: newNotes } as any)
        .eq('id', storeId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Store flagged for review');
      qc.invalidateQueries({ queryKey: ['recently-added-captures'] });
    },
    onError: (err: any) => toast.error('Flag failed', { description: err.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (storeId: string) => {
      const { error } = await supabase
        .from('stores')
        .update({ deleted_at: new Date().toISOString() } as any)
        .eq('id', storeId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Store removed');
      qc.invalidateQueries({ queryKey: ['recently-added-captures'] });
      qc.invalidateQueries({ queryKey: ['recently-added-count'] });
    },
    onError: (err: any) => toast.error('Delete failed', { description: err.message }),
  });

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Loading recent captures…</div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Camera className="h-6 w-6" />
          Recently Added Stores
          {recentCaptures && recentCaptures.length > 0 && (
            <span className="text-muted-foreground text-base font-normal ml-2">
              ({recentCaptures.length} in last 90 days)
            </span>
          )}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Stores added by field operators in the last 90 days. View Profile to edit, Flag for follow-up review, or Delete.
        </p>
      </div>

      {!recentCaptures || recentCaptures.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          No stores captured in the last 90 days.
        </Card>
      ) : (
        <div className="space-y-4">
          {recentCaptures.map((capture) => (
            <CaptureCard
              key={capture.id}
              capture={capture}
              onTypeChange={(type) => updateTypeMutation.mutate({ storeId: capture.id, type })}
              onFlag={(reason) => flagMutation.mutate({ storeId: capture.id, reason, currentNotes: capture.notes })}
              onDelete={() => deleteMutation.mutate(capture.id)}
              busy={updateTypeMutation.isPending || flagMutation.isPending || deleteMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface CardProps {
  capture: CaptureRow;
  onTypeChange: (type: string) => void;
  onFlag: (reason: string) => void;
  onDelete: () => void;
  busy: boolean;
}

function CaptureCard({ capture, onTypeChange, onFlag, onDelete, busy }: CardProps) {
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState<string>(capture.type || 'bodega');
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagReason, setFlagReason] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <Card className="p-4">
      <div className="grid md:grid-cols-[200px_1fr] gap-4">
        {capture.storefront_photo_url ? (
          <a href={capture.storefront_photo_url} target="_blank" rel="noopener noreferrer" className="block">
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
            <div className="text-sm bg-muted/50 rounded-md p-2 border">{capture.notes}</div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor={`type-${capture.id}`}>Store type</Label>
            <Select
              value={selectedType}
              onValueChange={(newType) => {
                setSelectedType(newType);
                onTypeChange(newType);
              }}
            >
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
            <Button size="sm" variant="outline" onClick={() => navigate(`/stores/${capture.id}`)}>
              <ExternalLink className="h-4 w-4 mr-1" />
              View Profile
            </Button>
            <Button size="sm" variant="outline" onClick={() => setFlagOpen(true)} disabled={busy}>
              <Flag className="h-4 w-4 mr-1" />
              Flag
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)} disabled={busy}>
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </div>

          {flagOpen && (
            <div className="space-y-2 pt-2 border-t">
              <Label htmlFor={`flag-${capture.id}`}>Reason for flag</Label>
              <Textarea
                id={`flag-${capture.id}`}
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                placeholder="e.g., possible duplicate, needs verification, blurry photo…"
                rows={2}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    onFlag(flagReason);
                    setFlagOpen(false);
                    setFlagReason('');
                  }}
                  disabled={!flagReason.trim() || busy}
                >
                  Confirm flag
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setFlagOpen(false); setFlagReason(''); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this store?</AlertDialogTitle>
                <AlertDialogDescription>
                  Soft-deletes <strong>{capture.name || 'this store'}</strong>. It will be hidden from operator surfaces.
                  You can restore it later from Deleted Records.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete store
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </Card>
  );
}
