import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Sticker, DoorOpen, Store, Phone, Clock, AlertTriangle, CheckCircle2, Flower2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface StoreOperationsCardProps {
  store: {
    id: string;
    sells_flowers: boolean;
    sticker_door: boolean;
    sticker_instore: boolean;
    sticker_phone: boolean;
    sticker_last_seen_at: string | null;
    sticker_taken_down: boolean;
    sticker_taken_down_at: string | null;
  };
  onUpdate: () => void;
}

type StickerToggleKey = 'sticker_door' | 'sticker_instore' | 'sticker_phone' | 'sticker_taken_down';

export function StoreOperationsCard({ store, onUpdate }: StoreOperationsCardProps) {
  const [saving, setSaving] = useState(false);
  const [localState, setLocalState] = useState({
    sells_flowers: store.sells_flowers || false,
    sticker_door: store.sticker_door || false,
    sticker_instore: store.sticker_instore || false,
    sticker_phone: store.sticker_phone || false,
    sticker_taken_down: store.sticker_taken_down || false,
  });
  const [toggleTimestamps, setToggleTimestamps] = useState<Record<StickerToggleKey, string | null>>({
    sticker_door: store.sticker_last_seen_at ?? null,
    sticker_instore: store.sticker_last_seen_at ?? null,
    sticker_phone: store.sticker_last_seen_at ?? null,
    sticker_taken_down: store.sticker_taken_down_at ?? store.sticker_last_seen_at ?? null,
  });

  const formatTimestamp = (iso: string | null) => {
    if (!iso) return 'No changes recorded';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return 'No changes recorded';
    return date.toLocaleString();
  };

  useEffect(() => {
    setToggleTimestamps({
      sticker_door: store.sticker_last_seen_at ?? null,
      sticker_instore: store.sticker_last_seen_at ?? null,
      sticker_phone: store.sticker_last_seen_at ?? null,
      sticker_taken_down: store.sticker_taken_down_at ?? store.sticker_last_seen_at ?? null,
    });
  }, [store.sticker_last_seen_at, store.sticker_taken_down_at]);

  const hasAnySticker = localState.sticker_door || localState.sticker_instore || localState.sticker_phone;

  const handleToggle = async (field: keyof typeof localState, value: boolean) => {
    setSaving(true);
    const updates: Record<string, any> = { [field]: value };
    const isStickerField =
      field === 'sticker_door' ||
      field === 'sticker_instore' ||
      field === 'sticker_phone' ||
      field === 'sticker_taken_down';
    let timestamp: string | null = null;

    if (isStickerField) {
      timestamp = new Date().toISOString();

      if (field === 'sticker_taken_down') {
        updates.sticker_taken_down_at = value ? timestamp : null;
        updates.sticker_last_seen_at = timestamp;
      } else {
        updates.sticker_last_seen_at = timestamp;
      }
    }

    try {
      const { error } = await supabase
        .from('stores')
        .update(updates)
        .eq('id', store.id);

      if (error) throw error;

      setLocalState(prev => ({ ...prev, [field]: value }));
      if (isStickerField && timestamp) {
        setToggleTimestamps(prev => ({
          ...prev,
          [field as StickerToggleKey]: timestamp,
        }));
      }
      toast.success('Updated successfully');
      onUpdate();
    } catch (error: any) {
      console.error('Error updating:', error);
      toast.error('Failed to update: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleMarkStickerSeen = async () => {
    setSaving(true);
    const timestamp = new Date().toISOString();
    try {
      const { error } = await supabase
        .from('stores')
        .update({ 
          sticker_last_seen_at: timestamp,
          sticker_taken_down: false,
          sticker_taken_down_at: null,
        })
        .eq('id', store.id);

      if (error) throw error;

      setLocalState(prev => ({ ...prev, sticker_taken_down: false }));
      setToggleTimestamps(prev => ({
        ...prev,
        sticker_door: timestamp,
        sticker_instore: timestamp,
        sticker_phone: timestamp,
        sticker_taken_down: timestamp,
      }));
      toast.success('Sticker marked as seen');
      onUpdate();
    } catch (error: any) {
      console.error('Error:', error);
      toast.error('Failed to update');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="glass-card border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sticker className="h-5 w-5 text-primary" />
          Operations & Stickers
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Flowers Tag */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-pink-500/10 flex items-center justify-center">
              <Flower2 className="h-5 w-5 text-pink-500" />
            </div>
            <div>
              <Label className="text-base font-medium">Sells Flowers</Label>
              <p className="text-sm text-muted-foreground">Store sells flower products</p>
            </div>
          </div>
          <Switch
            checked={localState.sells_flowers}
            onCheckedChange={(checked) => handleToggle('sells_flowers', checked)}
            disabled={saving}
          />
        </div>

        <Separator />

        {/* Sticker Types */}
        <div className="space-y-4">
          <p className="text-sm font-medium text-muted-foreground">Sticker Locations</p>
          
          <div className="grid gap-4">
            {/* Door Sticker */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                <DoorOpen className="h-5 w-5 text-blue-500" />
                <div>
                  <Label className="text-sm font-medium">Door Sticker</Label>
                  <p className="text-xs text-muted-foreground">Sticker on entrance door</p>
                  <p className="text-xs text-muted-foreground">
                    Status: {localState.sticker_door ? 'On' : 'Off'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Last updated: {formatTimestamp(toggleTimestamps.sticker_door)}
                  </p>
                </div>
              </div>
              <Switch
                checked={localState.sticker_door}
                onCheckedChange={(checked) => handleToggle('sticker_door', checked)}
                disabled={saving}
              />
            </div>

            {/* In-Store Sticker */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                <Store className="h-5 w-5 text-green-500" />
                <div>
                  <Label className="text-sm font-medium">In-Store Sticker</Label>
                  <p className="text-xs text-muted-foreground">Sticker inside the store</p>
                  <p className="text-xs text-muted-foreground">
                    Status: {localState.sticker_instore ? 'On' : 'Off'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Last updated: {formatTimestamp(toggleTimestamps.sticker_instore)}
                  </p>
                </div>
              </div>
              <Switch
                checked={localState.sticker_instore}
                onCheckedChange={(checked) => handleToggle('sticker_instore', checked)}
                disabled={saving}
              />
            </div>

            {/* Phone Sticker */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-purple-500" />
                <div>
                  <Label className="text-sm font-medium">Phone Sticker</Label>
                  <p className="text-xs text-muted-foreground">Sticker near phone/register</p>
                  <p className="text-xs text-muted-foreground">
                    Status: {localState.sticker_phone ? 'On' : 'Off'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Last updated: {formatTimestamp(toggleTimestamps.sticker_phone)}
                  </p>
                </div>
              </div>
              <Switch
                checked={localState.sticker_phone}
                onCheckedChange={(checked) => handleToggle('sticker_phone', checked)}
                disabled={saving}
              />
            </div>
          </div>
        </div>

        {/* Sticker Status */}
        {hasAnySticker && (
          <>
            <Separator />
            <div className="space-y-4">
              <p className="text-sm font-medium text-muted-foreground">Sticker Status</p>
              
              {/* Last Seen */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Last Seen:</span>
                  {store.sticker_last_seen_at ? (
                    <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                      {format(new Date(store.sticker_last_seen_at), 'MMM d, yyyy h:mm a')}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">Never recorded</Badge>
                  )}
                </div>
                <Button size="sm" variant="outline" onClick={handleMarkStickerSeen} disabled={saving}>
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Mark Seen
                </Button>
              </div>

              {/* Taken Down Toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <div>
                    <Label className="text-sm font-medium">Sticker Taken Down</Label>
                    {store.sticker_taken_down_at && localState.sticker_taken_down && (
                      <p className="text-xs text-muted-foreground">
                        Reported: {format(new Date(store.sticker_taken_down_at), 'MMM d, yyyy')}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Status: {localState.sticker_taken_down ? 'On' : 'Off'}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Last updated: {formatTimestamp(toggleTimestamps.sticker_taken_down)}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={localState.sticker_taken_down}
                  onCheckedChange={(checked) => handleToggle('sticker_taken_down', checked)}
                  disabled={saving}
                />
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}