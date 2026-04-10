import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Car, Search, Zap, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import AccountNotesPanel from '@/components/funding/AccountNotesPanel';

const paymentBadge: Record<string, { color: string; label: string }> = {
  'wire_to_dealer': { color: 'bg-emerald-500/20 text-emerald-400', label: 'Wire to Dealer' },
  'check_to_dealer': { color: 'bg-blue-500/20 text-blue-400', label: 'Check to Dealer' },
  'draft_to_dealer': { color: 'bg-teal-500/20 text-teal-400', label: 'Draft to Dealer' },
  'direct_to_buyer': { color: 'bg-amber-500/20 text-amber-400', label: 'Direct to Buyer' },
};

const difficultyBadge: Record<string, string> = {
  very_easy: 'bg-emerald-500/20 text-emerald-400',
  easy: 'bg-teal-500/20 text-teal-400',
  moderate: 'bg-amber-500/20 text-amber-400',
  hard: 'bg-orange-500/20 text-orange-400',
  very_hard: 'bg-red-500/20 text-red-400',
};

export default function AutoFinancingPage() {
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSameDay, setFilterSameDay] = useState<string>('all');
  const [filterPrivateParty, setFilterPrivateParty] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [matchScore, setMatchScore] = useState('');
  const [matchAmount, setMatchAmount] = useState('');
  const [matchAge, setMatchAge] = useState('');
  const [matchMileage, setMatchMileage] = useState('');
  const [matchResults, setMatchResults] = useState<any>(null);
  const [matching, setMatching] = useState(false);

  const { data: lenders = [], isLoading } = useQuery({
    queryKey: ['auto-lenders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auto_lenders' as any)
        .select('*')
        .eq('active', true)
        .order('min_apr', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = lenders.filter((l: any) => {
    if (filterType !== 'all' && l.lender_type !== filterType) return false;
    if (filterSameDay === 'yes' && !l.same_day_funding) return false;
    if (filterPrivateParty === 'yes' && !l.private_party_ok) return false;
    return true;
  });

  const runMatch = async () => {
    if (!matchScore) { toast.error('Enter credit score'); return; }
    setMatching(true);
    try {
      const { data, error } = await supabase.functions.invoke('match-auto-lenders', {
        body: {
          credit_score: parseInt(matchScore),
          loan_amount: matchAmount ? parseFloat(matchAmount) : undefined,
          vehicle_age: matchAge ? parseInt(matchAge) : undefined,
          vehicle_mileage: matchMileage ? parseInt(matchMileage) : undefined,
        },
      });
      if (error) throw error;
      setMatchResults(data);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setMatching(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Car className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Auto Financing Hub</h1>
          <p className="text-sm text-muted-foreground">Lender intelligence + dealer payment methods + client matching</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{lenders.length}</p>
          <p className="text-xs text-muted-foreground">Total Lenders</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{lenders.filter((l: any) => l.same_day_funding).length}</p>
          <p className="text-xs text-muted-foreground">Same-Day Funding</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{lenders.filter((l: any) => l.private_party_ok).length}</p>
          <p className="text-xs text-muted-foreground">Private Party OK</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{lenders.filter((l: any) => l.preapproval_available).length}</p>
          <p className="text-xs text-muted-foreground">Pre-Approval Available</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="directory">
        <TabsList>
          <TabsTrigger value="directory">Lender Directory</TabsTrigger>
          <TabsTrigger value="match">Client Match</TabsTrigger>
        </TabsList>

        <TabsContent value="directory" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Lender Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="credit_union">Credit Union</SelectItem>
                <SelectItem value="bank">Bank</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="captive">Captive</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterSameDay} onValueChange={setFilterSameDay}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Same Day" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Speed</SelectItem>
                <SelectItem value="yes">Same Day Only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPrivateParty} onValueChange={setFilterPrivateParty}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Private Party" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="yes">Private Party OK</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lender</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Min Score</TableHead>
                  <TableHead>APR Range</TableHead>
                  <TableHead>Loan Range</TableHead>
                  <TableHead>Payment Method</TableHead>
                  <TableHead>Same Day</TableHead>
                  <TableHead>Pre-Approval</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No lenders found</TableCell></TableRow>
                ) : filtered.map((l: any) => (
                  <>
                    <TableRow key={l.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setExpandedId(expandedId === l.id ? null : l.id)}>
                      <TableCell className="font-medium">{l.name}</TableCell>
                      <TableCell><Badge variant="outline">{l.lender_type}</Badge></TableCell>
                      <TableCell>{l.min_credit_score || '—'}</TableCell>
                      <TableCell>{l.min_apr && l.max_apr ? `${l.min_apr}–${l.max_apr}%` : '—'}</TableCell>
                      <TableCell>{l.min_loan_amount || l.max_loan_amount ? `$${(l.min_loan_amount || 0).toLocaleString()}–$${(l.max_loan_amount || 0).toLocaleString()}` : '—'}</TableCell>
                      <TableCell>
                        {l.payment_method && paymentBadge[l.payment_method] ? (
                          <Badge className={paymentBadge[l.payment_method].color}>{paymentBadge[l.payment_method].label}</Badge>
                        ) : <span className="text-muted-foreground">{l.payment_method || '—'}</span>}
                      </TableCell>
                      <TableCell>{l.same_day_funding ? <Zap className="h-4 w-4 text-amber-400" /> : '—'}</TableCell>
                      <TableCell>{l.preapproval_available ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : '—'}</TableCell>
                    </TableRow>
                    {expandedId === l.id && (
                      <TableRow key={`${l.id}-detail`}>
                        <TableCell colSpan={8}>
                          <div className="grid md:grid-cols-2 gap-4 p-4 bg-muted/10 rounded-lg">
                            <div className="space-y-2">
                              <h4 className="font-semibold text-sm">Application Process</h4>
                              <p className="text-xs text-muted-foreground whitespace-pre-line">{l.application_steps || 'Contact lender directly.'}</p>
                              {l.application_url && <a href={l.application_url} target="_blank" rel="noopener" className="text-xs text-primary underline">Apply Online →</a>}
                            </div>
                            <div className="space-y-2">
                              <h4 className="font-semibold text-sm">Pro Tips</h4>
                              <p className="text-xs text-muted-foreground whitespace-pre-line">{l.pro_tips || 'No tips available.'}</p>
                              <div className="flex flex-wrap gap-2 text-xs">
                                {l.private_party_ok && <Badge variant="outline">Private Party OK</Badge>}
                                {l.membership_required && <Badge variant="outline">Membership: {l.membership_org} (${l.membership_cost})</Badge>}
                                {l.funding_timeline_days && <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />{l.funding_timeline_days} days</Badge>}
                                {l.max_vehicle_age_years && <Badge variant="outline">Max {l.max_vehicle_age_years}yr old</Badge>}
                              </div>
                            </div>
                            <div className="md:col-span-2">
                              <AccountNotesPanel entityType="auto_lender" entityId={l.id} entityLabel={l.name} />
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="match" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Client Auto Lender Match</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Credit Score *</label>
                  <Input value={matchScore} onChange={e => setMatchScore(e.target.value)} type="number" placeholder="680" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Loan Amount</label>
                  <Input value={matchAmount} onChange={e => setMatchAmount(e.target.value)} type="number" placeholder="25000" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Vehicle Age (years)</label>
                  <Input value={matchAge} onChange={e => setMatchAge(e.target.value)} type="number" placeholder="3" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Vehicle Mileage</label>
                  <Input value={matchMileage} onChange={e => setMatchMileage(e.target.value)} type="number" placeholder="45000" />
                </div>
              </div>
              <Button onClick={runMatch} disabled={matching}>
                {matching ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
                Run Match
              </Button>
            </CardContent>
          </Card>

          {matchResults && (
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="border-emerald-500/30">
                <CardHeader><CardTitle className="text-sm text-emerald-400">✅ Qualify Now ({matchResults.qualify_now?.length || 0})</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {matchResults.qualify_now?.map((l: any) => (
                    <div key={l.id} className="p-3 rounded-lg border border-border/30 space-y-1">
                      <p className="font-medium text-sm">{l.name}</p>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline">{l.min_apr}–{l.max_apr}% APR</Badge>
                        {l.payment_method && paymentBadge[l.payment_method] && (
                          <Badge className={paymentBadge[l.payment_method].color}>{paymentBadge[l.payment_method].label}</Badge>
                        )}
                        {l.same_day_funding && <Badge className="bg-amber-500/20 text-amber-400">Same Day</Badge>}
                      </div>
                    </div>
                  ))}
                  {!matchResults.qualify_now?.length && <p className="text-sm text-muted-foreground">No matches found.</p>}
                </CardContent>
              </Card>
              <Card className="border-amber-500/30">
                <CardHeader><CardTitle className="text-sm text-amber-400">⚡ Qualify With Action ({matchResults.qualify_with_action?.length || 0})</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {matchResults.qualify_with_action?.map((l: any) => (
                    <div key={l.id} className="p-3 rounded-lg border border-border/30 space-y-1">
                      <p className="font-medium text-sm">{l.name}</p>
                      <ul className="text-xs text-muted-foreground list-disc pl-4">
                        {l.actions_needed?.map((a: string, i: number) => <li key={i}>{a}</li>)}
                      </ul>
                    </div>
                  ))}
                  {!matchResults.qualify_with_action?.length && <p className="text-sm text-muted-foreground">No pathway matches.</p>}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
