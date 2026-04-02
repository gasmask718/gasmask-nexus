import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Star, Plus, Building2, Lightbulb } from 'lucide-react';

const INSTITUTIONS_LIST = ['Chase', 'Bank of America', 'Wells Fargo', 'Citibank', 'US Bank', 'Capital One', 'Navy Federal', 'DCU', 'Alliant', 'PenFed', 'Mercury', 'Relay', 'Bluevine', 'Amex', 'Discover'];
const RELATIONSHIP_TYPES = ['Checking Account', 'Savings Account', 'Credit Card', 'Personal Loan', 'Business Loan', 'Line of Credit', 'Auto Loan'];
const BALANCE_RANGES = ['Under 1K', '1K to 5K', '5K to 25K', '25K to 100K', 'Over 100K'];

const RECOMMENDATIONS: Record<string, { why: string; firstStep: string; timeline: string }> = {
  'Chase': { why: 'Chase Business Complete Checking unlocks preferred rates on Ink Business cards and lines of credit.', firstStep: 'Open a Chase Business Complete Checking account and maintain active transactions for 90 days.', timeline: '90–120 days to unlock Chase Ink Business Cash' },
  'Bank of America': { why: 'Business Advantage Checking establishes preferred relationship pricing for all BofA business products.', firstStep: 'Open a Business Advantage Checking account and enroll in the Business Advantage Relationship program.', timeline: '90 days to preferred rates' },
  'Navy Federal': { why: 'Direct deposit membership unlocks the full suite of Navy Federal business products at member rates.', firstStep: 'Establish direct deposit into Navy Federal and maintain for 60 days.', timeline: '60–90 days to business product access' },
  'Bluevine': { why: 'Bluevine Business Checking with 90 days of deposits directly feeds their LOC underwriting algorithm.', firstStep: 'Open Bluevine Business Checking and run monthly deposits through it for 90 days.', timeline: '90 days to LOC qualification' },
  'Mercury': { why: 'Mercury checking as primary business account directly feeds Fundbox and Bluevine underwriting.', firstStep: 'Open Mercury checking as primary business account and maintain 90 days of clean history.', timeline: '90 days to unlock partner products' },
  'Amex': { why: 'Existing Amex cardholder history significantly increases approval odds for business products.', firstStep: 'Become an Amex cardholder first on any personal card and build 6 months of spend history.', timeline: '6 months to business product applications' },
};

interface Props {
  clientId: string;
}

export default function LenderRelationships({ clientId }: Props) {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ institution_name: '', relationship_types: [] as string[], opened_date: '', balance_range: '', relationship_strength: 3, notes: '' });

  const { data: relationships = [] } = useQuery({
    queryKey: ['funding-relationships', clientId],
    queryFn: async () => {
      const { data } = await supabase.from('funding_lender_relationships').select('*').eq('client_id', clientId).order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: client } = useQuery({
    queryKey: ['funding-client-rel', clientId],
    queryFn: async () => {
      const { data } = await supabase.from('funding_clients').select('target_funding_amount, funding_goal').eq('id', clientId).single();
      return data;
    },
  });

  const addRelationship = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('funding_lender_relationships').insert({
        client_id: clientId,
        institution_name: form.institution_name,
        relationship_types: form.relationship_types,
        opened_date: form.opened_date || null,
        balance_range: form.balance_range || null,
        relationship_strength: form.relationship_strength,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funding-relationships', clientId] });
      setShowAdd(false);
      setForm({ institution_name: '', relationship_types: [], opened_date: '', balance_range: '', relationship_strength: 3, notes: '' });
      toast.success('Relationship added');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const existingInstitutions = relationships.map((r: any) => r.institution_name);
  const recommendedInstitutions = Object.keys(RECOMMENDATIONS).filter(i => !existingInstitutions.includes(i));

  const getAccountAge = (openedDate: string | null) => {
    if (!openedDate) return null;
    const months = Math.round((Date.now() - new Date(openedDate).getTime()) / (30.44 * 86400000));
    const y = Math.floor(months / 12);
    const m = months % 12;
    return y > 0 ? `${y}y ${m}m` : `${m}m`;
  };

  return (
    <div className="space-y-6">
      {/* Current Relationships */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold flex items-center gap-2"><Building2 className="h-5 w-5 text-amber-500" /> Current Relationships</h3>
        <Button size="sm" variant="outline" className="border-amber-500/30 text-amber-400" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="h-3 w-3 mr-1" /> Add Relationship
        </Button>
      </div>

      {showAdd && (
        <Card className="border-amber-500/30">
          <CardContent className="p-4 space-y-3">
            <Input list="institutions" placeholder="Institution Name" value={form.institution_name} onChange={e => setForm(f => ({ ...f, institution_name: e.target.value }))} />
            <datalist id="institutions">{INSTITUTIONS_LIST.map(i => <option key={i} value={i} />)}</datalist>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Relationship Types</label>
              <div className="flex flex-wrap gap-2">
                {RELATIONSHIP_TYPES.map(rt => (
                  <label key={rt} className="flex items-center gap-1 text-xs">
                    <Checkbox checked={form.relationship_types.includes(rt)} onCheckedChange={v => setForm(f => ({
                      ...f, relationship_types: v ? [...f.relationship_types, rt] : f.relationship_types.filter(t => t !== rt)
                    }))} />
                    {rt}
                  </label>
                ))}
              </div>
            </div>
            <Input type="date" placeholder="Date Opened" value={form.opened_date} onChange={e => setForm(f => ({ ...f, opened_date: e.target.value }))} />
            <Select value={form.balance_range} onValueChange={v => setForm(f => ({ ...f, balance_range: v }))}>
              <SelectTrigger><SelectValue placeholder="Balance Range" /></SelectTrigger>
              <SelectContent>{BALANCE_RANGES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
            </Select>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Relationship Strength</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(s => (
                  <button key={s} onClick={() => setForm(f => ({ ...f, relationship_strength: s }))} className="focus:outline-none">
                    <Star className={`h-5 w-5 ${s <= form.relationship_strength ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`} />
                  </button>
                ))}
              </div>
            </div>
            <Textarea placeholder="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            <Button onClick={() => addRelationship.mutate()} disabled={!form.institution_name} className="bg-amber-600 hover:bg-amber-700">Save Relationship</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {relationships.map((rel: any) => {
          const types = Array.isArray(rel.relationship_types) ? rel.relationship_types : [];
          return (
            <Card key={rel.id} className="border-border hover:border-amber-500/30 transition-all">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-600/20 flex items-center justify-center text-amber-400 font-black text-sm">
                    {rel.institution_name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="font-bold">{rel.institution_name}</div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {types.map((t: string) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
                </div>
                {rel.opened_date && <div className="text-xs text-muted-foreground">Account Age: {getAccountAge(rel.opened_date)}</div>}
                {rel.balance_range && <div className="text-xs text-muted-foreground">Balance: {rel.balance_range}</div>}
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star key={s} className={`h-4 w-4 ${s <= (rel.relationship_strength || 0) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Relationship Recommendations */}
      {recommendedInstitutions.length > 0 && (
        <>
          <h3 className="text-lg font-bold flex items-center gap-2 mt-8"><Lightbulb className="h-5 w-5 text-amber-500" /> Relationship Recommendations</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendedInstitutions.map(inst => {
              const rec = RECOMMENDATIONS[inst];
              return (
                <Card key={inst} className="border-amber-500/10 bg-amber-500/5">
                  <CardContent className="p-4 space-y-2">
                    <div className="font-bold text-amber-400">{inst}</div>
                    <p className="text-xs text-muted-foreground">{rec.why}</p>
                    <div className="text-xs"><span className="font-semibold">First Step:</span> {rec.firstStep}</div>
                    <div className="text-xs"><span className="font-semibold">Timeline:</span> {rec.timeline}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
