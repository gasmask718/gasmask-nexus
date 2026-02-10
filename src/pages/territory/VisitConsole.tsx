import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Navigation, Store, ArrowRight } from 'lucide-react';

export default function VisitConsole() {
  const queryClient = useQueryClient();
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [interestLevel, setInterestLevel] = useState('');
  const [notes, setNotes] = useState('');
  const [requestPromotion, setRequestPromotion] = useState(false);
  // Promotion fields
  const [storeName, setStoreName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [sellsTobacco, setSellsTobacco] = useState(false);
  const [sellsGrabba, setSellsGrabba] = useState(false);

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['visit-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('territory_tasks')
        .select('*, territory_addresses(id, full_address, city), territory_store_candidates:candidate_id(business_name, contact_phone, interest_level)')
        .eq('task_type', 'visit')
        .in('status', ['open', 'in_progress'])
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const completeMutation = useMutation({
    mutationFn: async ({ taskId }: { taskId: string }) => {
      const { data, error } = await supabase.rpc('complete_territory_task', {
        p_task_id: taskId,
        p_outcome: { interest_level: interestLevel, notes } as any,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Visit task completed');
      queryClient.invalidateQueries({ queryKey: ['visit-tasks'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const promotionMutation = useMutation({
    mutationFn: async ({ addressId, candidateId }: { addressId: string; candidateId?: string }) => {
      const { data, error } = await supabase.rpc('request_store_promotion', {
        p_territory_address_id: addressId,
        p_candidate_id: candidateId || null,
        p_proposed_store_name: storeName,
        p_proposed_contact_name: contactName,
        p_proposed_phone: contactPhone || null,
        p_verified_sells_tobacco: sellsTobacco,
        p_verified_sells_grabba: sellsGrabba,
        p_verification_method: 'visit',
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Promotion request submitted — pending approval');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleComplete = async (task: any) => {
    await completeMutation.mutateAsync({ taskId: task.id });
    if (requestPromotion && storeName && contactName) {
      await promotionMutation.mutateAsync({
        addressId: task.territory_addresses?.id,
        candidateId: task.candidate_id,
      });
    }
    resetForm();
  };

  const resetForm = () => {
    setActiveTaskId(null);
    setInterestLevel('');
    setNotes('');
    setRequestPromotion(false);
    setStoreName('');
    setContactName('');
    setContactPhone('');
    setSellsTobacco(false);
    setSellsGrabba(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Navigation className="h-6 w-6 text-cyan-400" /> Visit / Pitch Console</h1>
        <p className="text-muted-foreground text-sm">In-person visits, verify stores, request promotions to CRM</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
      ) : !tasks?.length ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No visit tasks available.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {tasks.map((task: any) => {
            const candidate = task.territory_store_candidates;
            return (
              <Card key={task.id}>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{candidate?.business_name || task.territory_addresses?.full_address}</p>
                      <p className="text-sm text-muted-foreground">{task.territory_addresses?.full_address}</p>
                      {candidate?.contact_phone && <p className="text-sm font-mono mt-1">📞 {candidate.contact_phone}</p>}
                    </div>
                    <Badge className={task.priority === 'high' ? 'bg-destructive text-destructive-foreground' : task.priority === 'medium' ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground'}>{task.priority}</Badge>
                  </div>

                  {activeTaskId === task.id ? (
                    <div className="space-y-4 pt-2 border-t border-border/50">
                      {/* Outcome */}
                      <Select value={interestLevel} onValueChange={setInterestLevel}>
                        <SelectTrigger><SelectValue placeholder="Visit outcome" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="interested">Interested — wants product</SelectItem>
                          <SelectItem value="very_interested">Very Interested — ready to order</SelectItem>
                          <SelectItem value="maybe">Maybe — needs follow-up</SelectItem>
                          <SelectItem value="not_interested">Not Interested</SelectItem>
                          <SelectItem value="closed">Store Closed / Gone</SelectItem>
                        </SelectContent>
                      </Select>
                      <Textarea placeholder="Visit notes…" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />

                      {/* Promotion request toggle */}
                      <div className="flex items-center gap-2 pt-2">
                        <Checkbox id="promote" checked={requestPromotion} onCheckedChange={(v) => setRequestPromotion(!!v)} />
                        <label htmlFor="promote" className="text-sm font-medium flex items-center gap-1">
                          <Store className="h-4 w-4" /> Request Store Promotion <ArrowRight className="h-3 w-3" /> CRM
                        </label>
                      </div>

                      {requestPromotion && (
                        <div className="space-y-2 p-3 border border-cyan-500/30 rounded-lg bg-cyan-500/5">
                          <p className="text-xs text-cyan-400 font-medium">⚠️ This creates a PENDING promotion request. Owner/Admin must approve.</p>
                          <Input placeholder="Store name" value={storeName} onChange={(e) => setStoreName(e.target.value)} />
                          <Input placeholder="Contact name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
                          <Input placeholder="Phone (optional)" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
                          <div className="flex gap-4">
                            <div className="flex items-center gap-2">
                              <Checkbox id="tobacco" checked={sellsTobacco} onCheckedChange={(v) => setSellsTobacco(!!v)} />
                              <label htmlFor="tobacco" className="text-sm">Sells Tobacco</label>
                            </div>
                            <div className="flex items-center gap-2">
                              <Checkbox id="grabba" checked={sellsGrabba} onCheckedChange={(v) => setSellsGrabba(!!v)} />
                              <label htmlFor="grabba" className="text-sm">Sells Grabba</label>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={!interestLevel || completeMutation.isPending || promotionMutation.isPending}
                          onClick={() => handleComplete(task)}
                        >
                          {completeMutation.isPending || promotionMutation.isPending ? 'Saving…' : requestPromotion ? 'Complete & Submit Promotion' : 'Complete Visit'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={resetForm}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setActiveTaskId(task.id)}>Start Visit</Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
