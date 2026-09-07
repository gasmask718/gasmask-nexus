import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, MapPin, Search } from 'lucide-react';
import { toast } from 'sonner';
import CrewCameraCapture from './CrewCameraCapture';

type DropType = 'sticker' | 'tube_drop' | 'store_visit';

interface StoreHit {
  id: string;
  store_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
}

async function readPosition(): Promise<GeolocationPosition> {
  if (!('geolocation' in navigator)) {
    throw new Error('This device cannot share its location, so the drop cannot be logged.');
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      resolve,
      err => reject(new Error(`Location is required to log a drop (${err.message}).`)),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

export function NewDropForm({ zoneId }: { zoneId: string | null }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dropType, setDropType] = useState<DropType>('sticker');
  const [notes, setNotes] = useState('');
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [storeQuery, setStoreQuery] = useState('');
  const [selectedStore, setSelectedStore] = useState<StoreHit | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: storeHits, isFetching } = useQuery({
    queryKey: ['crew-store-search', searchTerm],
    enabled: dropType === 'store_visit' && searchTerm.trim().length >= 2,
    queryFn: async () => {
      const term = searchTerm.trim();
      const { data, error } = await supabase
        .from('store_master')
        .select('id, store_name, address, city, state')
        .or(`store_name.ilike.%${term}%,address.ilike.%${term}%`)
        .limit(15);
      if (error) throw error;
      return (data ?? []) as StoreHit[];
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not signed in');
      if (!photoBlob) throw new Error('Take a photo of the drop first.');
      if (dropType === 'store_visit' && !selectedStore) throw new Error('Pick the store you visited.');

      // Live location read — no cached value, submit is blocked if denied.
      const pos = await readPosition();

      const path = `${user.id}/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from('crew-drop-photos')
        .upload(path, photoBlob, { contentType: 'image/jpeg', upsert: false });
      if (upErr) throw upErr;

      // server_timestamp is intentionally NOT sent — the database sets it.
      const { error } = await supabase.from('crew_drops').insert({
        crew_id: user.id,
        drop_type: dropType,
        store_id: dropType === 'store_visit' ? selectedStore!.id : null,
        store_name: dropType === 'store_visit' ? selectedStore!.store_name : null,
        photo_path: path,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy_m: pos.coords.accuracy ?? null,
        notes: notes.trim() || null,
        zone_id: zoneId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Drop logged');
      setPhotoBlob(null);
      setPreviewUrl(null);
      setNotes('');
      setSelectedStore(null);
      setStoreQuery('');
      setSearchTerm('');
      queryClient.invalidateQueries({ queryKey: ['crew-drops'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-lg">New drop</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={dropType} onValueChange={v => { setDropType(v as DropType); setSelectedStore(null); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sticker">Sticker</SelectItem>
              <SelectItem value="tube_drop">Tube drop</SelectItem>
              <SelectItem value="store_visit">Store visit</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {dropType === 'store_visit' && (
          <div className="space-y-2">
            <Label>Store</Label>
            {selectedStore ? (
              <div className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
                <span>
                  {selectedStore.store_name}
                  <span className="block text-muted-foreground text-xs">
                    {[selectedStore.address, selectedStore.city, selectedStore.state].filter(Boolean).join(', ')}
                  </span>
                </span>
                <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedStore(null)}>Change</Button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <Input
                    value={storeQuery}
                    placeholder="Search store name or address"
                    onChange={e => setStoreQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setSearchTerm(storeQuery); } }}
                  />
                  <Button type="button" variant="outline" onClick={() => setSearchTerm(storeQuery)}>
                    {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="max-h-52 overflow-auto rounded-md border border-border divide-y divide-border">
                  {(storeHits ?? []).map(s => (
                    <button
                      key={s.id}
                      type="button"
                      className="w-full text-left p-2 text-sm hover:bg-muted"
                      onClick={() => setSelectedStore(s)}
                    >
                      {s.store_name || 'Unnamed store'}
                      <span className="block text-xs text-muted-foreground">
                        {[s.address, s.city, s.state].filter(Boolean).join(', ')}
                      </span>
                    </button>
                  ))}
                  {searchTerm && !isFetching && (storeHits ?? []).length === 0 && (
                    <p className="p-2 text-sm text-muted-foreground">No matches.</p>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label>Photo (camera only)</Label>
          <CrewCameraCapture
            previewUrl={previewUrl}
            onCaptured={(blob, url) => { setPhotoBlob(blob); setPreviewUrl(url); }}
            onCleared={() => { setPhotoBlob(null); setPreviewUrl(null); }}
          />
        </div>

        <div className="space-y-2">
          <Label>Notes (optional)</Label>
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
        </div>

        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <MapPin className="h-3 w-3" /> Your location is read when you submit. Without it the drop can't be saved.
        </p>

        <Button className="w-full" disabled={submit.isPending} onClick={() => submit.mutate()}>
          {submit.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Submit drop
        </Button>
      </CardContent>
    </Card>
  );
}

export default NewDropForm;
