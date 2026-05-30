import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Store, ArrowRight, Loader2 } from 'lucide-react';

const interestColor: Record<string, string> = {
  interested: 'bg-green-500 text-white',
  warm: 'bg-amber-500 text-white',
  cold: 'bg-muted text-muted-foreground',
};

export default function TerritoryCandidates() {
  const queryClient = useQueryClient();
  const [promoteCandidate, setPromoteCandidate] = useState<any | null>(null);
  const [storeName, setStoreName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [sellsTobacco, setSellsTobacco] = useState(false);
  const [sellsGrabba, setSellsGrabba] = useState(false);

  const { data: candidates, isLoading } = useQuery({
    queryKey: ['territory-store-candidates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('territory_store_candidates')
        .select('*, territory_addresses(id, full_address, city, state)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const promoteMutation = useMutation({
    mutationFn: async () => {
      if (!promoteCandidate) throw new Error('No candidate selected');
      const { data, error } = await supabase.rpc('request_store_promotion', {
        p_territory_address_id: promoteCandidate.territory_addresses?.id,
        p_candidate_id: promoteCandidate.id,
        p_proposed_store_name: storeName,
        p_proposed_contact_name: contactName,
        p_proposed_phone: contactPhone || null,
        p_verified_sells_tobacco: sellsTobacco,
        p_verified_sells_grabba: sellsGrabba,
        p_verification_method: 'candidate_review',
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Promotion request submitted — pending owner/admin approval');
      queryClient.invalidateQueries({ queryKey: ['territory-store-candidates'] });
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openPromote = (c: any) => {
    setPromoteCandidate(c);
    setStoreName(c.store_name_guess || '');
    setContactName('');
    setContactPhone('');
    setSellsTobacco(c.sells_tobacco === 'yes');
    setSellsGrabba(false);
  };

  const closeDialog = () => {
    setPromoteCandidate(null);
    setStoreName('');
    setContactName('');
    setContactPhone('');
    setSellsTobacco(false);
    setSellsGrabba(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Store Candidates</h1>
        <p className="text-muted-foreground text-sm">
          Addresses believed to be stores — not yet CRM-approved.{' '}
          <span className="italic">Promote a candidate to a real store before it can be dispatched on a route.</span>
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : candidates && candidates.length > 0 ? (
        <Card>
          <CardContent className="pt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 px-3">Store Name (Guess)</th>
                    <th className="text-left py-2 px-3">Address</th>
                    <th className="text-center py-2 px-3">Tobacco</th>
                    <th className="text-center py-2 px-3">Interest</th>
                    <th className="text-center py-2 px-3">Source</th>
                    <th className="text-left py-2 px-3">Next Action</th>
                    <th className="text-left py-2 px-3">Last Contact</th>
                    <th className="text-right py-2 px-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((c: any) => (
                    <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 px-3 font-medium">{c.store_name_guess || '—'}</td>
                      <td className="py-2 px-3 max-w-[200px] truncate text-muted-foreground">
                        {c.territory_addresses?.full_address || '—'}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <Badge variant="outline" className="text-xs capitalize">{c.sells_tobacco || 'unknown'}</Badge>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <Badge className={`${interestColor[c.interest_level] || 'bg-muted'} text-xs`}>
                          {c.interest_level || 'unknown'}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <Badge variant="secondary" className="text-xs">{c.source?.replace('_', ' ') || '—'}</Badge>
                      </td>
                      <td className="py-2 px-3 text-xs capitalize">{c.next_action?.replace('_', ' ') || '—'}</td>
                      <td className="py-2 px-3 text-xs text-muted-foreground">
                        {c.last_contacted_at ? new Date(c.last_contacted_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-xs"
                          disabled={!c.territory_addresses?.id}
                          onClick={() => openPromote(c)}
                        >
                          <Store className="h-3 w-3" />
                          Promote
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No store candidates yet. Scout addresses to discover potential stores.
          </CardContent>
        </Card>
      )}

      <Dialog open={!!promoteCandidate} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="h-5 w-5 text-cyan-400" />
              Promote Candidate to CRM Store
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-cyan-400 font-medium">
            ⚠️ This creates a PENDING promotion request. Owner/Admin must approve before this becomes a routable store.
          </p>
          {promoteCandidate?.territory_addresses?.full_address && (
            <p className="text-xs text-muted-foreground">
              Address: <span className="font-medium text-foreground">{promoteCandidate.territory_addresses.full_address}</span>
            </p>
          )}
          <div className="space-y-2">
            <Input placeholder="Store name" value={storeName} onChange={(e) => setStoreName(e.target.value)} />
            <Input placeholder="Contact name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
            <Input placeholder="Phone (optional)" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            <div className="flex gap-4 pt-2">
              <div className="flex items-center gap-2">
                <Checkbox id="cand-tobacco" checked={sellsTobacco} onCheckedChange={(v) => setSellsTobacco(!!v)} />
                <label htmlFor="cand-tobacco" className="text-sm">Sells Tobacco</label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="cand-grabba" checked={sellsGrabba} onCheckedChange={(v) => setSellsGrabba(!!v)} />
                <label htmlFor="cand-grabba" className="text-sm">Sells Grabba</label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog}>Cancel</Button>
            <Button
              onClick={() => promoteMutation.mutate()}
              disabled={!storeName || !contactName || promoteMutation.isPending}
            >
              {promoteMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
              Submit Promotion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
