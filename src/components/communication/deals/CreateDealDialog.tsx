import { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useBusiness } from '@/contexts/BusinessContext';

interface CreateDealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STAGES = [
  { value: 'contacted', label: 'Contacted' },
  { value: 'interested', label: 'Interested' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'confirming', label: 'Confirming' },
  { value: 'scheduled', label: 'Scheduled' },
];

const INTENT_TYPES = [
  { value: 'reorder', label: 'Reorder' },
  { value: 'new_product', label: 'New Product' },
  { value: 'upsell', label: 'Upsell' },
  { value: 'promotion', label: 'Promotion' },
];

export default function CreateDealDialog({ open, onOpenChange }: CreateDealDialogProps) {
  const { currentBusiness } = useBusiness();
  const queryClient = useQueryClient();
  
  const [storeId, setStoreId] = useState('');
  const [stage, setStage] = useState('contacted');
  const [intentType, setIntentType] = useState('reorder');
  const [expectedValue, setExpectedValue] = useState('');
  const [probability, setProbability] = useState('50');
  const [notes, setNotes] = useState('');

  const { data: stores } = useQuery({
    queryKey: ['stores-for-deals'],
    queryFn: async () => {
      const { data } = await supabase
        .from('store_master')
        .select('id, store_name')
        .order('store_name');
      return data || [];
    },
  });

  const createDealMutation = useMutation({
    mutationFn: async () => {
      if (!currentBusiness?.id) {
        throw new Error('No business selected');
      }
      
      if (!storeId) {
        throw new Error('Please select a store');
      }

      const { error } = await supabase.from('deals').insert({
        business_id: currentBusiness.id,
        store_id: storeId,
        stage,
        intent_type: intentType,
        expected_value: parseFloat(expectedValue) || 0,
        probability: parseInt(probability) || 50,
        notes: notes || null,
        status: 'open',
        risk_level: 'medium',
        channel: 'call',
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Deal created successfully');
      queryClient.invalidateQueries({ queryKey: ['deals-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['deal-stats'] });
      onOpenChange(false);
      // Reset form
      setStoreId('');
      setStage('contacted');
      setIntentType('reorder');
      setExpectedValue('');
      setProbability('50');
      setNotes('');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create deal: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createDealMutation.mutate();
  };

  const noBusiness = !currentBusiness?.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Deal</DialogTitle>
        </DialogHeader>
        
        {noBusiness ? (
          <div className="py-6 text-center space-y-2">
            <p className="text-muted-foreground">No business selected.</p>
            <p className="text-sm text-muted-foreground">Please select a business from the sidebar before creating a deal.</p>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="store">Store *</Label>
              <Select value={storeId} onValueChange={setStoreId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a store" />
                </SelectTrigger>
                <SelectContent>
                  {stores?.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.store_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stage">Stage</Label>
                <Select value={stage} onValueChange={setStage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="intentType">Intent Type</Label>
                <Select value={intentType} onValueChange={setIntentType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTENT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expectedValue">Expected Value ($)</Label>
                <Input
                  id="expectedValue"
                  type="number"
                  value={expectedValue}
                  onChange={(e) => setExpectedValue(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="probability">Probability (%)</Label>
                <Input
                  id="probability"
                  type="number"
                  min="0"
                  max="100"
                  value={probability}
                  onChange={(e) => setProbability(e.target.value)}
                  placeholder="50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes about this deal..."
                rows={3}
              />
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createDealMutation.isPending}>
                {createDealMutation.isPending ? "Creating..." : "Create Deal"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
