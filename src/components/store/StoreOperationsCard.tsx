import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Sticker, DoorOpen, Store, Phone, Clock, AlertTriangle, CheckCircle2, Flower2, Eye, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

type StickerType = 'door' | 'instore' | 'phone';

interface StickerData {
  put_on_at: string | null;
  last_seen_at: string | null;
  taken_down_at: string | null;
  note: string | null;
}

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
    // New per-sticker fields (optional until migration is run)
    sticker_door_put_on_at?: string | null;
    sticker_door_last_seen_at?: string | null;
    sticker_door_taken_down_at?: string | null;
    sticker_door_note?: string | null;
    sticker_instore_put_on_at?: string | null;
    sticker_instore_last_seen_at?: string | null;
    sticker_instore_taken_down_at?: string | null;
    sticker_instore_note?: string | null;
    sticker_phone_put_on_at?: string | null;
    sticker_phone_last_seen_at?: string | null;
    sticker_phone_taken_down_at?: string | null;
    sticker_phone_note?: string | null;
  };
  onUpdate: () => void;
}

export function StoreOperationsCard({ store, onUpdate }: StoreOperationsCardProps) {
  const [saving, setSaving] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteDialogSticker, setNoteDialogSticker] = useState<StickerType | null>(null);
  const [noteText, setNoteText] = useState('');
  const [isViewingNote, setIsViewingNote] = useState(false);
  const [localState, setLocalState] = useState({
    sells_flowers: store.sells_flowers || false,
    sticker_door: store.sticker_door || false,
    sticker_instore: store.sticker_instore || false,
    sticker_phone: store.sticker_phone || false,
    sticker_taken_down: store.sticker_taken_down || false,
  });

  const hasAnySticker = localState.sticker_door || localState.sticker_instore || localState.sticker_phone;

  // Helper to get sticker data
  const getStickerData = (type: StickerType): StickerData => {
    const prefix = `sticker_${type}`;
    return {
      put_on_at: store[`${prefix}_put_on_at` as keyof typeof store] as string | null || null,
      last_seen_at: store[`${prefix}_last_seen_at` as keyof typeof store] as string | null || null,
      taken_down_at: store[`${prefix}_taken_down_at` as keyof typeof store] as string | null || null,
      note: store[`${prefix}_note` as keyof typeof store] as string | null || null,
    };
  };

  const handleToggle = async (field: keyof typeof localState, value: boolean) => {
    // Handle sticker toggles with date tracking
    if (field.startsWith('sticker_') && field !== 'sticker_taken_down') {
      const stickerType = field.replace('sticker_', '') as StickerType;
      const updates: Record<string, any> = { [field]: value };
      
      if (value) {
        // Sticker is being put on - record put_on_at date
        updates[`sticker_${stickerType}_put_on_at`] = new Date().toISOString();
        // Clear taken down date and note if putting sticker back up
        updates[`sticker_${stickerType}_taken_down_at`] = null;
        updates[`sticker_${stickerType}_note`] = null;
      } else {
        // Sticker is being taken down - open note dialog
        setNoteDialogSticker(stickerType);
        setNoteText(getStickerData(stickerType).note || '');
        setIsViewingNote(false);
        setNoteDialogOpen(true);
        return; // Don't save yet, wait for note
      }

      setSaving(true);
      try {
        const { error } = await supabase
          .from('stores')
          .update(updates)
          .eq('id', store.id);

        if (error) throw error;

        setLocalState(prev => ({ ...prev, [field]: value }));
        toast.success('Updated successfully');
        onUpdate();
      } catch (error: any) {
        console.error('Error updating:', error);
        toast.error('Failed to update: ' + error.message);
      } finally {
        setSaving(false);
      }
      return;
    }

    // Handle other toggles (sells_flowers, sticker_taken_down)
    setSaving(true);
    const updates: Record<string, any> = { [field]: value };
    
    if (field === 'sticker_taken_down' && value) {
      updates.sticker_taken_down_at = new Date().toISOString();
    } else if (field === 'sticker_taken_down' && !value) {
      updates.sticker_taken_down_at = null;
    }

    try {
      const { error } = await supabase
        .from('stores')
        .update(updates)
        .eq('id', store.id);

      if (error) throw error;

      setLocalState(prev => ({ ...prev, [field]: value }));
      toast.success('Updated successfully');
      onUpdate();
    } catch (error: any) {
      console.error('Error updating:', error);
      toast.error('Failed to update: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenNoteDialog = (type: StickerType) => {
    setNoteDialogSticker(type);
    setNoteText(getStickerData(type).note || '');
    setIsViewingNote(true);
    setNoteDialogOpen(true);
  };

  const handleSaveNote = async () => {
    if (!noteDialogSticker) return;

    setSaving(true);
    const updates: Record<string, any> = {};

    if (isViewingNote) {
      // Just updating the note, not changing sticker status
      updates[`sticker_${noteDialogSticker}_note`] = noteText.trim() || null;
    } else {
      // Taking down sticker and adding note
      updates[`sticker_${noteDialogSticker}`] = false;
      updates[`sticker_${noteDialogSticker}_taken_down_at`] = new Date().toISOString();
      updates[`sticker_${noteDialogSticker}_note`] = noteText.trim() || null;
      setLocalState(prev => ({ ...prev, [`sticker_${noteDialogSticker}`]: false }));
    }

    try {
      const { error } = await supabase
        .from('stores')
        .update(updates)
        .eq('id', store.id);

      if (error) throw error;

      setNoteDialogOpen(false);
      setNoteText('');
      setNoteDialogSticker(null);
      setIsViewingNote(false);
      toast.success(isViewingNote ? 'Note saved' : 'Sticker marked as taken down');
      onUpdate();
    } catch (error: any) {
      console.error('Error updating:', error);
      toast.error('Failed to update: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleMarkStickerSeen = async (type: StickerType) => {
    setSaving(true);
    try {
      const updates: Record<string, any> = {
        [`sticker_${type}_last_seen_at`]: new Date().toISOString(),
      };
      
      // If sticker was taken down, clear it since we're seeing it again
      const stickerData = getStickerData(type);
      if (stickerData.taken_down_at) {
        updates[`sticker_${type}_taken_down_at`] = null;
        updates[`sticker_${type}_note`] = null;
        updates[`sticker_${type}`] = true;
        setLocalState(prev => ({ ...prev, [`sticker_${type}`]: true }));
      }

      const { error } = await supabase
        .from('stores')
        .update(updates)
        .eq('id', store.id);

      if (error) throw error;

      toast.success('Sticker marked as seen');
      onUpdate();
    } catch (error: any) {
      console.error('Error:', error);
      toast.error('Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const getStickerLabel = (type: StickerType): string => {
    switch (type) {
      case 'door': return 'Door Sticker';
      case 'instore': return 'In-Store Sticker';
      case 'phone': return 'Phone Sticker';
    }
  };

  const getStickerIcon = (type: StickerType) => {
    switch (type) {
      case 'door': return DoorOpen;
      case 'instore': return Store;
      case 'phone': return Phone;
    }
  };

  const getStickerColor = (type: StickerType): string => {
    switch (type) {
      case 'door': return 'text-blue-500';
      case 'instore': return 'text-green-500';
      case 'phone': return 'text-purple-500';
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
            {(['door', 'instore', 'phone'] as StickerType[]).map((type) => {
              const Icon = getStickerIcon(type);
              const color = getStickerColor(type);
              const isActive = localState[`sticker_${type}` as keyof typeof localState] as boolean;
              const stickerData = getStickerData(type);
              const hasNote = !!stickerData.note;

              return (
                <div key={type} className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-3 flex-1">
                      <Icon className={`h-5 w-5 ${color}`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Label className="text-sm font-medium">{getStickerLabel(type)}</Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`h-8 w-8 p-0 transition-all ${
                              hasNote 
                                ? 'hover:bg-red-500/20' 
                                : 'hover:bg-muted'
                            }`}
                            onClick={() => handleOpenNoteDialog(type)}
                            title={hasNote ? 'View/Edit Note' : 'Add Note'}
                          >
                            <FileText 
                              className={`h-5 w-5 transition-all ${
                                hasNote 
                                  ? 'text-red-500 drop-shadow-[0_0_6px_rgba(239,68,68,0.8)] filter brightness-110' 
                                  : 'text-black dark:text-gray-400'
                              }`} 
                            />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {type === 'door' && 'Sticker on entrance door'}
                          {type === 'instore' && 'Sticker inside the store'}
                          {type === 'phone' && 'Sticker near phone/register'}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={isActive}
                      onCheckedChange={(checked) => handleToggle(`sticker_${type}` as keyof typeof localState, checked)}
                      disabled={saving}
                    />
                  </div>

                  {/* Sticker Dates and Actions */}
                  {(isActive || stickerData.put_on_at || stickerData.taken_down_at) && (
                    <div className="pl-8 space-y-2">
                      <div className="flex items-center gap-2 text-xs flex-wrap">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">Last Put On:</span>
                        {stickerData.put_on_at ? (
                          <Badge variant="outline" className="text-xs">
                            {format(new Date(stickerData.put_on_at), 'MMM d, yyyy')}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                        <span className="text-muted-foreground mx-1">/</span>
                        <span className="text-muted-foreground">Last Seen:</span>
                        {stickerData.last_seen_at ? (
                          <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/30">
                            {format(new Date(stickerData.last_seen_at), 'MMM d, yyyy')}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">Never</Badge>
                        )}
                      </div>
                      {stickerData.taken_down_at && (
                        <div className="flex items-center gap-2 text-xs">
                          <AlertTriangle className="h-3 w-3 text-destructive" />
                          <span className="text-destructive">Taken Down:</span>
                          <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/30">
                            {format(new Date(stickerData.taken_down_at), 'MMM d, yyyy')}
                          </Badge>
                        </div>
                      )}
                      {isActive && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleMarkStickerSeen(type)}
                          disabled={saving}
                          className="h-7 text-xs"
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Mark Seen
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </CardContent>

      {/* Note Dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {noteDialogSticker && `Note for ${getStickerLabel(noteDialogSticker)}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Note</Label>
              <Textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a note about this sticker..."
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Add notes to track store behavior and preferences.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setNoteDialogOpen(false);
              setNoteText('');
              setNoteDialogSticker(null);
              setIsViewingNote(false);
            }}>
              Cancel
            </Button>
            <Button onClick={handleSaveNote} disabled={saving}>
              {saving ? 'Saving...' : 'Save Note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}