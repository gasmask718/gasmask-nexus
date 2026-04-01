/**
 * Phone Number Provisioning Page
 * Buy Twilio numbers (Local + Toll-Free + International) directly from the OS
 */
import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Phone, ShoppingCart, Loader2, CheckCircle, AlertCircle, Search, Zap, MapPin, PhoneCall, Globe } from 'lucide-react';

// ── Types ──
type NumberType = 'local' | 'toll-free';
type Country = 'US' | 'DR';

// ── State area codes ──
const STATE_AREA_CODES: Record<string, { label: string; codes: string[] }> = {
  all: { label: 'All States (929 default)', codes: ['929', '848', '718', '347', '212', '646'] },
  NY: { label: 'New York', codes: ['929', '718', '347'] },
  FL: { label: 'Florida', codes: ['305', '754', '786'] },
  TX: { label: 'Texas', codes: ['214', '713', '832'] },
  CA: { label: 'California', codes: ['213', '310', '323'] },
  NJ: { label: 'New Jersey', codes: ['848', '201', '973'] },
  GA: { label: 'Georgia', codes: ['404', '470', '678'] },
  IL: { label: 'Illinois', codes: ['312', '773'] },
  PA: { label: 'Pennsylvania', codes: ['215', '267'] },
};

const DR_AREA_CODES = ['809', '829', '849'];
const TOLL_FREE_PREFIXES = ['800', '888', '877', '866', '855', '844', '833'];

// ── Business config with recommendations ──
const BUSINESSES = [
  { key: 'unforgettable_times', label: 'Unforgettable Times', envKey: 'UT_PHONE_NUMBER', recType: 'local' as NumberType, recCode: '929', recTag: '💡 Local (929)' },
  { key: 'real_estate', label: 'Real Estate', envKey: 'RE_PHONE_NUMBER', recType: 'local' as NumberType, recCode: '929', recTag: '💡 Local (929)' },
  { key: 'surplus_funds', label: 'Surplus Funds', envKey: 'SF_PHONE_NUMBER', recType: 'toll-free' as NumberType, recCode: '800', recTag: '⭐ Toll-Free (800/888)' },
  { key: 'top_tier', label: 'Top Tier', envKey: 'TT_PHONE_NUMBER', recType: 'toll-free' as NumberType, recCode: '800', recTag: '⭐ Toll-Free (800)' },
  { key: 'brandaro', label: 'Brandaro', envKey: 'BRANDARO_PHONE_NUMBER', recType: 'toll-free' as NumberType, recCode: '888', recTag: '⭐ Toll-Free (888)' },
  { key: 'iclean', label: 'iClean', envKey: 'ICLEAN_PHONE_NUMBER', recType: 'toll-free' as NumberType, recCode: '877', recTag: '⭐ Toll-Free (877)' },
  { key: 'playboxxx', label: 'Playboxxx', envKey: 'PLAYBOXXX_PHONE_NUMBER', recType: 'local' as NumberType, recCode: '929', recTag: '💡 Local (929)' },
] as const;

const COST: Record<string, number> = { local: 1, 'toll-free': 2, dr: 4 };

// ── Brandaro setup plan ──
const BRANDARO_PLAN = [
  { label: 'New York × 5', type: 'Local 929', cost: 5, code: '929', numberType: 'local' as NumberType, country: 'US' as Country, qty: 5 },
  { label: 'Florida × 2', type: 'Local 305', cost: 2, code: '305', numberType: 'local' as NumberType, country: 'US' as Country, qty: 2 },
  { label: 'Texas × 2', type: 'Local 214', cost: 2, code: '214', numberType: 'local' as NumberType, country: 'US' as Country, qty: 2 },
  { label: 'California × 2', type: 'Local 213', cost: 2, code: '213', numberType: 'local' as NumberType, country: 'US' as Country, qty: 2 },
  { label: 'New Jersey × 1', type: 'Local 848', cost: 1, code: '848', numberType: 'local' as NumberType, country: 'US' as Country, qty: 1 },
  { label: 'Georgia × 1', type: 'Local 404', cost: 1, code: '404', numberType: 'local' as NumberType, country: 'US' as Country, qty: 1 },
  { label: 'Dom Republic × 2', type: 'Local 809', cost: 6, code: '809', numberType: 'local' as NumberType, country: 'DR' as Country, qty: 2 },
  { label: 'Inbound × 1', type: 'TF 888', cost: 2, code: '888', numberType: 'toll-free' as NumberType, country: 'US' as Country, qty: 1 },
];

interface AvailableNumber {
  phone_number: string;
  friendly_name: string;
  locality: string;
  region: string;
}

type WizardStep = 'business' | 'area_code' | 'results' | 'agent' | 'purchasing' | 'done';

interface BulkProgress {
  business: string;
  numberType: NumberType;
  cost: number;
  status: 'pending' | 'searching' | 'purchasing' | 'done' | 'error';
  number?: string;
  error?: string;
}

interface BrandaroProgress {
  label: string;
  status: 'pending' | 'searching' | 'purchasing' | 'done' | 'error';
  numbers: string[];
  error?: string;
}

export default function PhoneProvisioningPage() {
  const queryClient = useQueryClient();

  // Wizard state
  const [step, setStep] = useState<WizardStep>('business');
  const [selectedBusiness, setSelectedBusiness] = useState('');
  const [country, setCountry] = useState<Country>('US');
  const [numberType, setNumberType] = useState<NumberType>('local');
  const [targetState, setTargetState] = useState('all');
  const [selectedCode, setSelectedCode] = useState('929');
  const [availableNumbers, setAvailableNumbers] = useState<AvailableNumber[]>([]);
  const [selectedNumber, setSelectedNumber] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('');
  const [searching, setSearching] = useState(false);
  const [purchaseStatus, setPurchaseStatus] = useState('');
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<BulkProgress[]>([]);
  const [brandaroBuying, setBrandaroBuying] = useState(false);
  const [brandaroProgress, setBrandaroProgress] = useState<BrandaroProgress[]>([]);

  // ── Fetch existing numbers ──
  const { data: existingNumbers = [], isLoading: numbersLoading } = useQuery({
    queryKey: ['dc-phone-numbers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('dc_phone_numbers').select('*').order('business');
      if (error) throw error;
      return data || [];
    },
  });

  // ── Fetch agents ──
  const { data: agents = [] } = useQuery({
    queryKey: ['dc-agents'],
    queryFn: async () => {
      const { data, error } = await supabase.from('dc_agents').select('name, agent_id, business, agent_type, is_active').eq('is_active', true).order('business');
      if (error) throw error;
      return data || [];
    },
  });

  const businessesWithNumbers = new Set(existingNumbers.map((n: any) => n.business));
  const missingBusinesses = BUSINESSES.filter(b => !businessesWithNumbers.has(b.key));
  const filteredAgents = agents.filter((a: any) => a.business === selectedBusiness);

  // Area codes based on country + state
  const activeAreaCodes = useMemo(() => {
    if (country === 'DR') return DR_AREA_CODES;
    if (numberType === 'toll-free') return TOLL_FREE_PREFIXES;
    return STATE_AREA_CODES[targetState]?.codes || STATE_AREA_CODES.all.codes;
  }, [country, numberType, targetState]);

  // ── Cost summary from existing numbers ──
  const costSummary = useMemo(() => {
    const localCount = existingNumbers.filter((n: any) => n.number_type !== 'toll-free').length;
    const tollFreeCount = existingNumbers.filter((n: any) => n.number_type === 'toll-free').length;
    return { localCount, tollFreeCount, total: localCount * 1 + tollFreeCount * 2 };
  }, [existingNumbers]);

  const handleSelectBusiness = (key: string) => {
    setSelectedBusiness(key);
    const biz = BUSINESSES.find(b => b.key === key);
    if (biz) {
      setCountry('US');
      setNumberType(biz.recType);
      setSelectedCode(biz.recCode);
      setTargetState('all');
    }
  };

  const callProvision = async (payload: Record<string, any>) => {
    const { data, error } = await supabase.functions.invoke('provision-dc-number', { body: payload });
    if (error) throw error;
    return data;
  };

  const handleSearch = async () => {
    setSearching(true);
    setAvailableNumbers([]);
    try {
      const data = await callProvision({
        action: 'search',
        number_type: numberType,
        country,
        area_code: numberType === 'local' ? selectedCode : undefined,
        toll_free_prefix: numberType === 'toll-free' ? selectedCode : undefined,
      });
      setAvailableNumbers(data.numbers || []);
      setStep('results');
    } catch (e: any) {
      toast.error('Search failed: ' + (e.message || 'Unknown error'));
    } finally {
      setSearching(false);
    }
  };

  const handlePurchase = async () => {
    if (!selectedNumber) return;
    setStep('purchasing');
    const businessLabel = BUSINESSES.find(b => b.key === selectedBusiness)?.label || selectedBusiness;

    try {
      setPurchaseStatus('Purchasing in Twilio...');
      const data = await callProvision({
        action: 'purchase',
        phone_number: selectedNumber,
        friendly_name: `${businessLabel} AI Line`,
        number_type: numberType,
        country,
      });

      setPurchaseStatus('Updating database...');
      await supabase
        .from('dc_phone_numbers')
        .update({
          business: selectedBusiness,
          assigned_agent_id: selectedAgent || null,
          assigned_agent_name: agents.find((a: any) => a.agent_id === selectedAgent)?.name || null,
          number_type: numberType,
        })
        .eq('phone_number', data.phone_number);

      setPurchaseStatus('✅ Line is LIVE!');
      setStep('done');
      queryClient.invalidateQueries({ queryKey: ['dc-phone-numbers'] });
      toast.success(`Number ${data.phone_number} purchased and assigned!`);
    } catch (e: any) {
      setPurchaseStatus('');
      setStep('results');
      toast.error('Purchase failed: ' + (e.message || 'Unknown error'));
    }
  };

  const handleBulkBuy = async () => {
    if (missingBusinesses.length === 0) { toast.info('All businesses already have numbers.'); return; }
    setBulkRunning(true);
    const progress: BulkProgress[] = missingBusinesses.map(b => ({
      business: b.label, numberType: b.recType, cost: COST[b.recType], status: 'pending',
    }));
    setBulkProgress([...progress]);

    for (let i = 0; i < missingBusinesses.length; i++) {
      const biz = missingBusinesses[i];
      progress[i].status = 'searching';
      setBulkProgress([...progress]);
      try {
        const searchData = await callProvision({
          action: 'search', number_type: biz.recType,
          area_code: biz.recType === 'local' ? biz.recCode : undefined,
          toll_free_prefix: biz.recType === 'toll-free' ? biz.recCode : undefined,
        });
        const numbers = searchData.numbers || [];
        if (numbers.length === 0) { progress[i].status = 'error'; progress[i].error = 'No numbers'; setBulkProgress([...progress]); continue; }
        progress[i].status = 'purchasing';
        setBulkProgress([...progress]);
        const purchaseData = await callProvision({ action: 'purchase', phone_number: numbers[0].phone_number, friendly_name: `${biz.label} AI Line`, number_type: biz.recType });
        await supabase.from('dc_phone_numbers').update({ business: biz.key, number_type: biz.recType }).eq('phone_number', purchaseData.phone_number);
        progress[i].status = 'done'; progress[i].number = purchaseData.phone_number;
        setBulkProgress([...progress]);
      } catch (e: any) {
        progress[i].status = 'error'; progress[i].error = e.message || 'Failed';
        setBulkProgress([...progress]);
      }
    }
    setBulkRunning(false);
    queryClient.invalidateQueries({ queryKey: ['dc-phone-numbers'] });
    toast.success('Bulk purchase complete!');
  };

  // ── Brandaro full package buy ──
  const handleBrandaroPackage = async () => {
    setBrandaroBuying(true);
    const progress: BrandaroProgress[] = BRANDARO_PLAN.map(p => ({ label: p.label, status: 'pending', numbers: [] }));
    setBrandaroProgress([...progress]);

    for (let i = 0; i < BRANDARO_PLAN.length; i++) {
      const plan = BRANDARO_PLAN[i];
      progress[i].status = 'searching';
      setBrandaroProgress([...progress]);
      try {
        for (let q = 0; q < plan.qty; q++) {
          const searchData = await callProvision({
            action: 'search', number_type: plan.numberType, country: plan.country,
            area_code: plan.numberType === 'local' ? plan.code : undefined,
            toll_free_prefix: plan.numberType === 'toll-free' ? plan.code : undefined,
          });
          const numbers = searchData.numbers || [];
          if (numbers.length === 0) { progress[i].status = 'error'; progress[i].error = 'No numbers'; setBrandaroProgress([...progress]); break; }
          progress[i].status = 'purchasing';
          setBrandaroProgress([...progress]);
          const purchaseData = await callProvision({ action: 'purchase', phone_number: numbers[0].phone_number, friendly_name: `Brandaro ${plan.label}`, number_type: plan.numberType, country: plan.country });
          await supabase.from('dc_phone_numbers').update({ business: 'brandaro', number_type: plan.numberType }).eq('phone_number', purchaseData.phone_number);
          progress[i].numbers.push(purchaseData.phone_number);
          setBrandaroProgress([...progress]);
        }
        if (progress[i].status !== 'error') progress[i].status = 'done';
        setBrandaroProgress([...progress]);
      } catch (e: any) {
        progress[i].status = 'error'; progress[i].error = e.message || 'Failed';
        setBrandaroProgress([...progress]);
      }
    }
    setBrandaroBuying(false);
    queryClient.invalidateQueries({ queryKey: ['dc-phone-numbers'] });
    toast.success('Brandaro package complete!');
  };

  const resetWizard = () => {
    setStep('business'); setSelectedBusiness(''); setCountry('US'); setNumberType('local');
    setTargetState('all'); setSelectedCode('929'); setAvailableNumbers([]);
    setSelectedNumber(''); setSelectedAgent(''); setPurchaseStatus('');
  };

  const bulkCostEstimate = missingBusinesses.reduce((sum, b) => sum + COST[b.recType], 0);
  const brandaroTotal = BRANDARO_PLAN.reduce((s, p) => s + p.cost, 0);

  const currentCost = country === 'DR' ? '$3-5' : numberType === 'toll-free' ? '$2.00' : '$1.00';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Phone Number Provisioning</h1>
        <p className="text-muted-foreground">Buy & assign Twilio numbers — Local, Toll-Free, International</p>
      </div>

      {/* ── SECTION 1: Current Numbers ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Phone className="h-5 w-5" /> Current Numbers</CardTitle>
        </CardHeader>
        <CardContent>
          {numbersLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Number</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {existingNumbers.map((num: any) => (
                  <TableRow key={num.id}>
                    <TableCell className="capitalize font-medium">{(num.business || '').replace(/_/g, ' ')}</TableCell>
                    <TableCell className="font-mono">{num.phone_number}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{num.number_type === 'toll-free' ? '📞 TF' : '📍 Local'}</Badge></TableCell>
                    <TableCell>{num.assigned_agent_name || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={num.is_active ? 'default' : 'destructive'} className={num.is_active ? 'bg-green-600' : ''}>
                        {num.is_active ? '✅ Active' : '🔴 Inactive'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {missingBusinesses.map(biz => (
                  <TableRow key={biz.key} className="opacity-60">
                    <TableCell className="font-medium">{biz.label}</TableCell>
                    <TableCell className="text-muted-foreground italic">Not provisioned</TableCell>
                    <TableCell><span className="text-xs text-muted-foreground">{biz.recTag}</span></TableCell>
                    <TableCell>—</TableCell>
                    <TableCell><Badge variant="outline" className="text-red-500 border-red-500">🔴 Needed</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── SECTION 2: Buy New Number Wizard ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" /> Buy New Number</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step 1: Select Business */}
          {step === 'business' && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Step 1 — Select Business</p>
              <div className="flex flex-wrap gap-2">
                {BUSINESSES.map(biz => {
                  const hasBiz = businessesWithNumbers.has(biz.key);
                  return (
                    <Button key={biz.key} variant={selectedBusiness === biz.key ? 'default' : 'outline'} size="sm" onClick={() => handleSelectBusiness(biz.key)} className="relative">
                      {biz.label}
                      {hasBiz && <CheckCircle className="ml-1 h-3 w-3 text-green-400" />}
                    </Button>
                  );
                })}
              </div>
              {selectedBusiness && (
                <>
                  <div className="text-xs text-muted-foreground">Recommended: {BUSINESSES.find(b => b.key === selectedBusiness)?.recTag}</div>
                  <Button onClick={() => setStep('area_code')}>Next — Choose Number Type</Button>
                </>
              )}
            </div>
          )}

          {/* Step 2: Country + Number Type + Code */}
          {step === 'area_code' && (
            <div className="space-y-4">
              <p className="text-sm font-medium">Step 2 — Choose Number</p>

              {/* Country Toggle */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Country</p>
                <div className="flex gap-2">
                  <Button variant={country === 'US' ? 'default' : 'outline'} size="sm" onClick={() => { setCountry('US'); setNumberType('local'); setSelectedCode('929'); setTargetState('all'); }}>
                    🇺🇸 United States
                  </Button>
                  <Button variant={country === 'DR' ? 'default' : 'outline'} size="sm" onClick={() => { setCountry('DR'); setNumberType('local'); setSelectedCode('809'); }}>
                    🇩🇴 Dominican Republic
                  </Button>
                </div>
              </div>

              {country === 'DR' ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Select DR area code — <span className="font-semibold">$3-5/month</span></p>
                  <p className="text-xs text-muted-foreground italic">Local DR number — callers see a Dominican Republic number calling — 3-4x higher answer rate</p>
                  <div className="flex flex-wrap gap-2">
                    {DR_AREA_CODES.map(code => (
                      <Button key={code} variant={selectedCode === code ? 'default' : 'outline'} size="sm" onClick={() => setSelectedCode(code)}>{code}</Button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {/* Type Toggle */}
                  <div className="flex gap-2">
                    <Button variant={numberType === 'local' ? 'default' : 'outline'} size="sm" onClick={() => { setNumberType('local'); setSelectedCode(STATE_AREA_CODES[targetState]?.codes[0] || '929'); }}>
                      <MapPin className="mr-1 h-4 w-4" /> Local Number
                    </Button>
                    <Button variant={numberType === 'toll-free' ? 'default' : 'outline'} size="sm" onClick={() => { setNumberType('toll-free'); setSelectedCode('800'); }}>
                      <PhoneCall className="mr-1 h-4 w-4" /> Toll-Free Number
                    </Button>
                  </div>

                  {numberType === 'local' ? (
                    <div className="space-y-2">
                      {/* State selector */}
                      <div className="flex items-center gap-3">
                        <p className="text-xs text-muted-foreground">Target State:</p>
                        <Select value={targetState} onValueChange={(v) => { setTargetState(v); setSelectedCode(STATE_AREA_CODES[v]?.codes[0] || '929'); }}>
                          <SelectTrigger className="w-[220px] h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(STATE_AREA_CODES).map(([key, val]) => (
                              <SelectItem key={key} value={key}>{val.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-xs text-muted-foreground">Select area code — <span className="font-semibold">$1.00/month</span></p>
                      <div className="flex flex-wrap gap-2">
                        {activeAreaCodes.map(code => (
                          <Button key={code} variant={selectedCode === code ? 'default' : 'outline'} size="sm" onClick={() => setSelectedCode(code)}>{code}</Button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Select toll-free prefix — <span className="font-semibold">$2.00/month</span></p>
                      <p className="text-xs text-muted-foreground italic">Callers reach you for free — builds trust and credibility</p>
                      <div className="flex flex-wrap gap-2">
                        {TOLL_FREE_PREFIXES.map(code => (
                          <Button key={code} variant={selectedCode === code ? 'default' : 'outline'} size="sm" onClick={() => setSelectedCode(code)}>{code}</Button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setStep('business')}>Back</Button>
                <Button onClick={handleSearch} disabled={searching}>
                  {searching ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Searching...</> : <><Search className="mr-2 h-4 w-4" />Search Available Numbers</>}
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Results */}
          {step === 'results' && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Step 3 — Pick a Number</p>
              <Badge variant="outline">
                {country === 'DR' ? '🇩🇴 DR' : numberType === 'toll-free' ? '📞 Toll-Free' : '📍 Local'} · {currentCost}/month
              </Badge>
              {availableNumbers.length === 0 ? (
                <p className="text-muted-foreground">No numbers found. Try a different code.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {availableNumbers.map(num => (
                    <Card key={num.phone_number} className={`cursor-pointer transition-all ${selectedNumber === num.phone_number ? 'ring-2 ring-primary' : 'hover:border-primary/50'}`}
                      onClick={() => { setSelectedNumber(num.phone_number); setStep('agent'); }}>
                      <CardContent className="p-4">
                        <p className="font-mono text-lg font-bold">{num.phone_number}</p>
                        <p className="text-xs text-muted-foreground">{num.locality ? `${num.locality}, ${num.region}` : country === 'DR' ? 'Dominican Republic' : numberType === 'toll-free' ? 'US Toll-Free' : num.region}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
              <Button variant="ghost" size="sm" onClick={() => setStep('area_code')}>Back</Button>
            </div>
          )}

          {/* Step 4: Select Agent */}
          {step === 'agent' && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Step 4 — Assign Agent (optional)</p>
              <p className="text-xs text-muted-foreground">Number: <span className="font-mono font-bold">{selectedNumber}</span> · {currentCost}/mo</p>
              <div className="flex flex-wrap gap-2">
                {filteredAgents.map((agent: any) => (
                  <Button key={agent.agent_id} variant={selectedAgent === agent.agent_id ? 'default' : 'outline'} size="sm" onClick={() => setSelectedAgent(agent.agent_id)}>
                    {agent.name}
                  </Button>
                ))}
                {filteredAgents.length === 0 && <p className="text-muted-foreground text-sm">No agents found for this business.</p>}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setStep('results')}>Back</Button>
                <Button onClick={handlePurchase}><ShoppingCart className="mr-2 h-4 w-4" /> Buy {selectedNumber} — {currentCost}/mo</Button>
              </div>
            </div>
          )}

          {step === 'purchasing' && (
            <div className="flex items-center gap-3 p-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="font-medium">{purchaseStatus}</span>
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-3 p-4">
              <div className="flex items-center gap-2 text-green-600 font-bold text-lg"><CheckCircle className="h-6 w-6" /> Line is LIVE!</div>
              <Button onClick={resetWizard}>Buy Another Number</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── SECTION 3: Bulk Buy (missing businesses) ── */}
      {missingBusinesses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5" /> Bulk Provision</CardTitle>
            <CardDescription>Auto-buy recommended types for {missingBusinesses.length} missing business{missingBusinesses.length > 1 ? 'es' : ''}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm space-y-1 bg-muted/50 rounded-lg p-3">
              {missingBusinesses.map(b => (
                <div key={b.key} className="flex justify-between">
                  <span>{b.label}</span>
                  <span className="text-muted-foreground">{b.recTag} — ${COST[b.recType]}/mo</span>
                </div>
              ))}
              <div className="border-t pt-1 mt-2 font-bold flex justify-between">
                <span>Total</span><span>~${bulkCostEstimate}/month</span>
              </div>
            </div>
            <Button size="lg" onClick={handleBulkBuy} disabled={bulkRunning} className="w-full">
              {bulkRunning ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Provisioning...</> : <>Buy All {missingBusinesses.length} Business Numbers — ~${bulkCostEstimate}/mo</>}
            </Button>
            {bulkProgress.length > 0 && (
              <div className="space-y-2">
                {bulkProgress.map((bp, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm p-2 rounded-md bg-muted/50">
                    {bp.status === 'pending' && <div className="h-4 w-4 rounded-full bg-muted-foreground/30" />}
                    {bp.status === 'searching' && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                    {bp.status === 'purchasing' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                    {bp.status === 'done' && <CheckCircle className="h-4 w-4 text-green-500" />}
                    {bp.status === 'error' && <AlertCircle className="h-4 w-4 text-red-500" />}
                    <span className="font-medium">{bp.business}</span>
                    {bp.number && <span className="font-mono text-xs">{bp.number}</span>}
                    {bp.error && <span className="text-xs text-red-500">{bp.error}</span>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── SECTION 4: Brandaro Complete Package ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" /> Brandaro Complete Setup</CardTitle>
          <CardDescription>16 numbers across NY, FL, TX, CA, NJ, GA, DR + Inbound TF</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm space-y-1">
            <div className="grid grid-cols-3 gap-x-4 font-bold text-foreground border-b pb-1 mb-1">
              <span>Region</span><span>Type</span><span className="text-right">$/mo</span>
            </div>
            {BRANDARO_PLAN.map((p, i) => (
              <div key={i} className="grid grid-cols-3 gap-x-4">
                <span>{p.label}</span>
                <span className="text-muted-foreground">{p.type}</span>
                <span className="text-right">${p.cost}</span>
              </div>
            ))}
            <div className="border-t pt-1 mt-1 grid grid-cols-3 gap-x-4 font-bold">
              <span>Total: 16 numbers</span><span></span><span className="text-right">~${brandaroTotal}/mo</span>
            </div>
          </div>

          <Button size="lg" onClick={handleBrandaroPackage} disabled={brandaroBuying} className="w-full">
            {brandaroBuying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Purchasing Brandaro Package...</> : <>Buy Complete Brandaro Package — ${brandaroTotal}/mo</>}
          </Button>

          {brandaroProgress.length > 0 && (
            <div className="space-y-2">
              {brandaroProgress.map((bp, i) => (
                <div key={i} className="flex items-center gap-3 text-sm p-2 rounded-md bg-muted/50">
                  {bp.status === 'pending' && <div className="h-4 w-4 rounded-full bg-muted-foreground/30" />}
                  {(bp.status === 'searching' || bp.status === 'purchasing') && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                  {bp.status === 'done' && <CheckCircle className="h-4 w-4 text-green-500" />}
                  {bp.status === 'error' && <AlertCircle className="h-4 w-4 text-red-500" />}
                  <span className="font-medium">{bp.label}</span>
                  {bp.numbers.length > 0 && <span className="font-mono text-xs">{bp.numbers.join(', ')}</span>}
                  {bp.error && <span className="text-xs text-red-500">{bp.error}</span>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── SECTION 5: Cost Summary ── */}
      {existingNumbers.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">💰 Monthly Cost Summary</CardTitle></CardHeader>
          <CardContent>
            <div className="text-sm space-y-1">
              {costSummary.localCount > 0 && <p>Local numbers: {costSummary.localCount} × $1 = <span className="font-bold">${costSummary.localCount}/month</span></p>}
              {costSummary.tollFreeCount > 0 && <p>Toll-free numbers: {costSummary.tollFreeCount} × $2 = <span className="font-bold">${costSummary.tollFreeCount * 2}/month</span></p>}
              <p className="border-t pt-1 mt-1 font-bold text-base">Total monthly: ${costSummary.total}/month</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
