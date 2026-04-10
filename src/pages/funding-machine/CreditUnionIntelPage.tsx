import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, ExternalLink, Star, Target, BookOpen, Users, TrendingUp, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const DIFFICULTY_COLORS: Record<string, string> = {
  very_easy: 'bg-green-500/20 text-green-400 border-green-500/30',
  easy: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  moderate: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  hard: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  very_hard: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const DIFFICULTY_LABELS: Record<string, string> = {
  very_easy: 'Very Easy', easy: 'Easy', moderate: 'Moderate', hard: 'Hard', very_hard: 'Very Hard',
};

const PRODUCT_TYPES = [
  'personal_loan', 'auto_loan', 'credit_card', 'heloc', 'business_loan',
  'share_secured_loan', 'cd_secured_loan', 'line_of_credit', 'mortgage', 'student_loan',
];

export default function CreditUnionIntelPage() {
  const [creditUnions, setCreditUnions] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('intelligence');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterDifficulty, setFilterDifficulty] = useState('all');
  const [filterMinScore, setFilterMinScore] = useState('');
  const [filterMinAmount, setFilterMinAmount] = useState('');
  const [filterNational, setFilterNational] = useState('all');

  // Client match
  const [selectedClientId, setSelectedClientId] = useState('');
  const [matchResults, setMatchResults] = useState<any>(null);
  const [matchLoading, setMatchLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [cuRes, prodRes, clientRes] = await Promise.all([
      supabase.from('credit_unions').select('*').order('overall_fundability_rank'),
      supabase.from('credit_union_products').select('*, credit_unions(*)').eq('active', true).order('approval_difficulty'),
      supabase.from('funding_clients').select('id, full_name, first_name, last_name, credit_score_estimate').order('created_at', { ascending: false }),
    ]);
    setCreditUnions(cuRes.data || []);
    setProducts(prodRes.data || []);
    setClients(clientRes.data || []);
    setLoading(false);
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (filterType !== 'all' && p.product_type !== filterType) return false;
      if (filterDifficulty !== 'all' && p.approval_difficulty !== filterDifficulty) return false;
      if (filterMinScore && p.min_credit_score && p.min_credit_score > Number(filterMinScore)) return false;
      if (filterMinAmount && p.max_loan_amount && p.max_loan_amount < Number(filterMinAmount)) return false;
      if (filterNational !== 'all') {
        const cu = p.credit_unions;
        if (filterNational === 'national' && !cu?.national_membership_available) return false;
        if (filterNational === 'regional' && cu?.national_membership_available) return false;
      }
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const cu = p.credit_unions;
        return (
          p.product_name?.toLowerCase().includes(s) ||
          cu?.name?.toLowerCase().includes(s) ||
          p.product_type?.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [products, filterType, filterDifficulty, filterMinScore, filterMinAmount, filterNational, searchTerm]);

  const runClientMatch = async () => {
    if (!selectedClientId) return;
    setMatchLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('score-client-for-credit-unions', {
        body: { client_id: selectedClientId },
      });
      if (error) throw error;
      setMatchResults(data);
    } catch (err: any) {
      toast.error(err.message || 'Match failed');
    } finally {
      setMatchLoading(false);
    }
  };

  const openDetail = (product: any) => {
    setSelectedProduct(product);
    setDrawerOpen(true);
  };

  const fmt = (n: number | null) => n != null ? `$${n.toLocaleString()}` : '—';
  const pct = (n: number | null) => n != null ? `${n}%` : '—';

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Credit Union Intelligence</h1>
        <p className="text-muted-foreground">Searchable database of credit union products, membership paths, and approval intelligence.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{creditUnions.length}</p>
          <p className="text-xs text-muted-foreground">Credit Unions</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{products.length}</p>
          <p className="text-xs text-muted-foreground">Products Loaded</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{products.filter(p => p.approval_difficulty === 'very_easy' || p.approval_difficulty === 'easy').length}</p>
          <p className="text-xs text-muted-foreground">Easy Approval</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-amber-400">{products.filter(p => p.is_credit_builder).length}</p>
          <p className="text-xs text-muted-foreground">Credit Builders</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{creditUnions.filter(cu => cu.national_membership_available).length}</p>
          <p className="text-xs text-muted-foreground">National Access</p>
        </CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="intelligence"><Search className="h-4 w-4 mr-1" />Intelligence View</TabsTrigger>
          <TabsTrigger value="match"><Target className="h-4 w-4 mr-1" />Client Match</TabsTrigger>
          <TabsTrigger value="directory"><BookOpen className="h-4 w-4 mr-1" />A–Z Directory</TabsTrigger>
        </TabsList>

        {/* INTELLIGENCE VIEW */}
        <TabsContent value="intelligence" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search credit unions or products..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[160px]"><SelectValue placeholder="Product Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {PRODUCT_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterDifficulty} onValueChange={setFilterDifficulty}>
                  <SelectTrigger className="w-[140px]"><SelectValue placeholder="Difficulty" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {Object.entries(DIFFICULTY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterNational} onValueChange={setFilterNational}>
                  <SelectTrigger className="w-[140px]"><SelectValue placeholder="Access" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="national">National</SelectItem>
                    <SelectItem value="regional">Regional</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="Min Score" type="number" value={filterMinScore} onChange={e => setFilterMinScore(e.target.value)} className="w-[110px]" />
                <Input placeholder="Min Amount" type="number" value={filterMinAmount} onChange={e => setFilterMinAmount(e.target.value)} className="w-[120px]" />
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Credit Union</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Min Score</TableHead>
                      <TableHead>Max Amount</TableHead>
                      <TableHead>APR</TableHead>
                      <TableHead>Difficulty</TableHead>
                      <TableHead>Membership</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.length === 0 ? (
                      <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No products match your filters</TableCell></TableRow>
                    ) : filteredProducts.map(p => {
                      const cu = p.credit_unions;
                      return (
                        <TableRow key={p.id} className="cursor-pointer hover:bg-muted/30" onClick={() => openDetail(p)}>
                          <TableCell className="font-medium">{cu?.name || '—'}</TableCell>
                          <TableCell>{p.product_name}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{p.product_type?.replace(/_/g, ' ')}</Badge></TableCell>
                          <TableCell>{p.min_credit_score || '—'}</TableCell>
                          <TableCell>{fmt(p.max_loan_amount)}</TableCell>
                          <TableCell>{p.min_apr && p.max_apr ? `${p.min_apr}–${p.max_apr}%` : '—'}</TableCell>
                          <TableCell>
                            <Badge className={`text-xs ${DIFFICULTY_COLORS[p.approval_difficulty] || ''}`}>
                              {DIFFICULTY_LABELS[p.approval_difficulty] || p.approval_difficulty}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate">{cu?.third_party_membership_org || cu?.membership_requirement || '—'}</TableCell>
                          <TableCell>
                            {cu?.application_url && (
                              <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); window.open(cu.application_url, '_blank'); }}>
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* CLIENT MATCH */}
        <TabsContent value="match" className="space-y-4">
          <Card>
            <CardContent className="p-4 flex gap-4 items-end">
              <div className="flex-1">
                <p className="text-sm font-medium mb-1">Select Client</p>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger><SelectValue placeholder="Choose a client..." /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name || `${c.first_name} ${c.last_name}`} — Score: {c.credit_score_estimate || 'N/A'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={runClientMatch} disabled={!selectedClientId || matchLoading}>
                {matchLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Target className="h-4 w-4 mr-2" />}
                Run Match
              </Button>
            </CardContent>
          </Card>

          {matchResults && (
            <div className="space-y-4">
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4">
                  <p className="font-semibold">{matchResults.client.name} — Score: {matchResults.client.credit_score}</p>
                  <p className="text-sm text-muted-foreground">
                    {matchResults.total_qualify_now} products qualify now • {matchResults.total_pathways} pathway opportunities
                  </p>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-green-400 flex items-center gap-2"><TrendingUp className="h-5 w-5" />Qualify Now ({matchResults.total_qualify_now})</h3>
                  {matchResults.qualify_now.slice(0, 20).map((p: any) => (
                    <Card key={p.id} className="border-green-500/20 bg-green-500/5">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{p.product_name}</p>
                            <p className="text-sm text-muted-foreground">{p.credit_unions?.name}</p>
                          </div>
                          <Badge className={DIFFICULTY_COLORS[p.approval_difficulty]}>{DIFFICULTY_LABELS[p.approval_difficulty]}</Badge>
                        </div>
                        <p className="text-sm mt-2">Up to {fmt(p.max_loan_amount)} • {p.min_apr}–{p.max_apr}% APR</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-amber-400 flex items-center gap-2"><Star className="h-5 w-5" />Qualify With Action ({matchResults.total_pathways})</h3>
                  {matchResults.pathways.slice(0, 20).map((p: any) => (
                    <Card key={p.id} className="border-amber-500/20 bg-amber-500/5">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{p.product_name}</p>
                            <p className="text-sm text-muted-foreground">{p.credit_unions?.name}</p>
                          </div>
                          <Badge variant="outline" className="text-amber-400">+{p.score_gap} pts</Badge>
                        </div>
                        <p className="text-sm mt-2 text-amber-300">{p.action_required}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* A-Z DIRECTORY */}
        <TabsContent value="directory" className="space-y-4">
          {creditUnions.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No credit unions loaded yet.</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {creditUnions.sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(cu => {
                const cuProducts = products.filter(p => p.credit_union_id === cu.id);
                return (
                  <Card key={cu.id} className="hover:border-primary/30 transition-colors">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-foreground">{cu.name}</p>
                          {cu.abbreviation && <p className="text-xs text-muted-foreground">{cu.abbreviation}</p>}
                        </div>
                        {cu.overall_fundability_rank && (
                          <Badge variant="outline" className="text-xs">Rank #{cu.overall_fundability_rank}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{cu.headquarters_state} • {cu.national_membership_available ? '🌐 National' : '📍 Regional'}</p>
                      {cu.third_party_membership_org && (
                        <p className="text-xs text-amber-400">Join via: {cu.third_party_membership_org} {cu.third_party_membership_cost ? `($${cu.third_party_membership_cost})` : ''}</p>
                      )}
                      <p className="text-xs text-muted-foreground">{cuProducts.length} products loaded</p>
                      <div className="flex gap-2 pt-1">
                        {cu.website_url && <Button size="sm" variant="outline" className="text-xs" onClick={() => window.open(cu.website_url, '_blank')}>Website</Button>}
                        {cu.application_url && <Button size="sm" variant="outline" className="text-xs" onClick={() => window.open(cu.application_url, '_blank')}>Apply</Button>}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Detail Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
          {selectedProduct && (
            <div className="space-y-6">
              <SheetHeader>
                <SheetTitle>{selectedProduct.product_name}</SheetTitle>
                <p className="text-sm text-muted-foreground">{selectedProduct.credit_unions?.name}</p>
              </SheetHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Min Score</p>
                    <p className="text-lg font-bold">{selectedProduct.min_credit_score || 'None'}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Ideal Score</p>
                    <p className="text-lg font-bold">{selectedProduct.ideal_credit_score || '—'}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Loan Range</p>
                    <p className="text-sm font-bold">{fmt(selectedProduct.min_loan_amount)} – {fmt(selectedProduct.max_loan_amount)}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">APR Range</p>
                    <p className="text-sm font-bold">{selectedProduct.min_apr}% – {selectedProduct.max_apr}%</p>
                  </div>
                </div>

                <div className="bg-muted/30 rounded-lg p-3 flex items-center justify-between">
                  <span className="text-sm">Difficulty</span>
                  <Badge className={DIFFICULTY_COLORS[selectedProduct.approval_difficulty]}>
                    {DIFFICULTY_LABELS[selectedProduct.approval_difficulty]}
                  </Badge>
                </div>

                {selectedProduct.min_membership_months > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                    <p className="text-sm font-medium text-amber-400">⏳ Waiting Period</p>
                    <p className="text-sm text-muted-foreground">{selectedProduct.min_membership_months} month(s) membership required before applying</p>
                  </div>
                )}

                {/* Membership */}
                {selectedProduct.credit_unions && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Membership Path</h4>
                    <p className="text-sm text-muted-foreground">{selectedProduct.credit_unions.membership_requirement}</p>
                    {selectedProduct.credit_unions.third_party_membership_org && (
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                        <p className="text-sm font-medium">3rd Party: {selectedProduct.credit_unions.third_party_membership_org}</p>
                        {selectedProduct.credit_unions.third_party_membership_cost && <p className="text-xs text-muted-foreground">Cost: ${selectedProduct.credit_unions.third_party_membership_cost}</p>}
                        {selectedProduct.credit_unions.third_party_membership_url && (
                          <Button size="sm" variant="link" className="p-0 h-auto text-xs" onClick={() => window.open(selectedProduct.credit_unions.third_party_membership_url, '_blank')}>
                            Sign Up Link →
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Application Steps */}
                {selectedProduct.application_steps && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Step-by-Step Application</h4>
                    <div className="text-sm text-muted-foreground whitespace-pre-line">{selectedProduct.application_steps}</div>
                  </div>
                )}

                {/* Pro Tips */}
                {selectedProduct.pro_tips && (
                  <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
                    <h4 className="font-semibold text-sm text-green-400 mb-1">💡 Pro Tips</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-line">{selectedProduct.pro_tips}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Funding Timeline:</span> <strong>{selectedProduct.funding_timeline_days ? `${selectedProduct.funding_timeline_days} days` : '—'}</strong></div>
                  <div><span className="text-muted-foreground">Reports to:</span> <strong>{selectedProduct.reports_to_bureaus || '—'}</strong></div>
                  <div><span className="text-muted-foreground">Credit Builder:</span> <strong>{selectedProduct.is_credit_builder ? '✅ Yes' : 'No'}</strong></div>
                  <div><span className="text-muted-foreground">DTI Max:</span> <strong>{selectedProduct.dti_max_percent ? `${selectedProduct.dti_max_percent}%` : '—'}</strong></div>
                  <div><span className="text-muted-foreground">How to Apply:</span> <strong>{selectedProduct.how_to_apply || '—'}</strong></div>
                  <div><span className="text-muted-foreground">Collateral:</span> <strong>{selectedProduct.collateral_required ? selectedProduct.collateral_type || 'Required' : 'None'}</strong></div>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
