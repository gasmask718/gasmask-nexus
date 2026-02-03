import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Flower2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SellsFlowersToggleProps {
  storeId: string;
  initialValue: boolean;
  onUpdate?: () => void;
  readOnly?: boolean;
}

/**
 * Store-level "Sells Flowers" toggle
 * This is NOT per-brand - it's a store attribute
 * Visible & editable: Admin, VA, Ambassador, Biker
 * Read-only: Driver
 */
export function SellsFlowersToggle({ 
  storeId, 
  initialValue, 
  onUpdate,
  readOnly = false 
}: SellsFlowersToggleProps) {
  const [sellsFlowers, setSellsFlowers] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  const handleToggle = async (checked: boolean) => {
    if (readOnly) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('stores')
        .update({ sells_flowers: checked })
        .eq('id', storeId);

      if (error) throw error;

      setSellsFlowers(checked);
      toast.success(checked ? 'Marked as flower seller' : 'Removed flower seller tag');
      onUpdate?.();
    } catch (error: any) {
      console.error('Error updating sells_flowers:', error);
      toast.error('Failed to update: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Flower2 className="h-5 w-5 text-pink-500" />
          Store Attributes
        </CardTitle>
      </CardHeader>
      <CardContent>
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
            checked={sellsFlowers}
            onCheckedChange={handleToggle}
            disabled={saving || readOnly}
          />
        </div>
      </CardContent>
    </Card>
  );
}
