import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Sticker, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface StickerStatusCardProps {
  storeId: string;
  stickerOnDoor?: boolean;
  stickerInStore?: boolean;
  stickerWithPhone?: boolean;
  stickerNotes?: string;
}

export function StickerStatusCard({
  storeId,
  stickerOnDoor = false,
  stickerInStore = false,
  stickerWithPhone = false,
  stickerNotes = "",
}: StickerStatusCardProps) {
  const queryClient = useQueryClient();
  
  const [onDoor, setOnDoor] = useState(stickerOnDoor);
  const [inStore, setInStore] = useState(stickerInStore);
  const [withPhone, setWithPhone] = useState(stickerWithPhone);
  const [notes, setNotes] = useState(stickerNotes);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setOnDoor(stickerOnDoor);
    setInStore(stickerInStore);
    setWithPhone(stickerWithPhone);
    setNotes(stickerNotes || "");
  }, [stickerOnDoor, stickerInStore, stickerWithPhone, stickerNotes]);

  useEffect(() => {
    const changed = 
      onDoor !== stickerOnDoor ||
      inStore !== stickerInStore ||
      withPhone !== stickerWithPhone ||
      notes !== (stickerNotes || "");
    setHasChanges(changed);
  }, [onDoor, inStore, withPhone, notes, stickerOnDoor, stickerInStore, stickerWithPhone, stickerNotes]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Use raw update to bypass type checking for new columns
      const { error } = await supabase
        .from("store_master")
        .update({
          sticker_on_door: onDoor,
          sticker_in_store: inStore,
          sticker_with_phone: withPhone,
          sticker_notes: notes,
        } as any)
        .eq("id", storeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-master", storeId] });
      toast.success("Sticker status saved");
      setHasChanges(false);
    },
    onError: () => {
      toast.error("Failed to save sticker status");
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sticker className="h-4 w-4 text-primary" />
          Sticker Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="sticker-door" className="text-sm">Sticker on Door</Label>
            <Switch
              id="sticker-door"
              checked={onDoor}
              onCheckedChange={setOnDoor}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="sticker-store" className="text-sm">Sticker in Store</Label>
            <Switch
              id="sticker-store"
              checked={inStore}
              onCheckedChange={setInStore}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="sticker-phone" className="text-sm">Sticker with Phone #</Label>
            <Switch
              id="sticker-phone"
              checked={withPhone}
              onCheckedChange={setWithPhone}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sticker-notes" className="text-sm">Notes</Label>
          <Textarea
            id="sticker-notes"
            placeholder="Any notes about sticker placement..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-[60px] text-sm"
          />
        </div>

        {hasChanges && (
          <Button 
            size="sm" 
            className="w-full"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
