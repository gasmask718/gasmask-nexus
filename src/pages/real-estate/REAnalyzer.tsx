import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, Mail, FileText, Search, Users } from 'lucide-react';
import { US_STATES } from '@/data/usStates';

const RE_ACCENT = '#3B6D11';
const PROPERTY_TYPES = ['sfr', 'duplex', 'triplex', 'fourplex', 'mobile', 'land'] as const;
const CONDITIONS = [
  { value: 'excellent', label: 'Excellent 🟢', rate: 5 },
  { value: 'good', label: 'Good 🔵', rate: 15 },
  { value: 'fair', label: 'Fair 🟡', rate: 35 },
  { value: 'poor', label: 'Poor 🟠', rate: 60 },
  { value: 'teardown', label: 'Teardown 🔴', rate: 15 },
] as const;

const STATE_OPTIONS: { code: string; name: string }[] = (US_STATES as any[]).map((s: any) =>
  typeof s === 'string' ? { code: s, name: s } : { code: s.code ?? s.value ?? s.abbreviation ?? s.name, name: s.name ?? s.label ?? s.code },
);

interface Form {
  address: string; city: string; state: string; zip: string;
  bedrooms: string; bathrooms: string; sqft: string; year_built: string;
  property_type: string; condition: string;
  arv: string; repairs: string;
}

const EMPTY: Form = {
  address: '', city: '', state: 'FL', zip: '',
  bedrooms: '', bathrooms: '', sqft: '', year_built: '',
  property_type: 'sfr', condition: 'fair',
  arv: '', repairs: '',
};

export default function REAnalyzer() {
  const [form, setForm] = useState<Form>(EMPTY);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [matchOpen, setMatchOpen] = useState(false);
  const [matching, setMatching] = useState(false);
  const [matches, setMatches] = useState<any[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [savedDeals, setSavedDeals] = useState<any[]>([]);

  const update = (patch: Partial<Form>) => setForm(f => ({ ...f, ...patch }));

  const arv = Number(form.arv) || 0;
  const repairs = Number(form.repairs) || 0;
  const sqft = Number(form.sqft) || 0;
  const condRate = CONDITIONS.find(c => c.value === form.condition)?.rate ?? 0;
  const quickRepairEst = sqft * condRate;

  const mao = Math.max(0, arv * 0.7 - repairs);
  const ourOffer = mao * 0.9;
  const assignFee = mao * 0.1;
  const grade = assignFee > 20000 ? 'A' : assignFee > 10000 ? 'B' : assignFee > 5000 ? 'C' : 'D';
  const gradeMeta = {
    A: { bg: 'bg-green-600', label: '🏆 Strong Deal' },
    B: { bg: 'bg-blue-600', label: '✅ Good Deal' },
    C: { bg: 'bg-yellow-600', label: '⚠️ Marginal Deal' },
    D: { bg: 'bg-red-600', label: '❌ Pass on This One' },
  }[grade];

  const fetchSaved = async () => {
    const { data } = await supabase.from('re_properties').select('*').order('created_at', { ascending: false }).limit(20);
    setSavedDeals(data ?? []);
  };
  useEffect(() => { fetchSaved(); }, []);

  const saveDeal = async (): Promise<string | null> => {
    if (!form.address || !form.state) { toast.error('Address and state are required.'); return null; }
    setSaving(true);
    try {
      const { data, error } = await supabase.from('re_properties').insert({
        address: form.address, city: form.city || null, state: form.state, zip: form.zip || null,
        bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
        bathrooms: form.bathrooms ? Number(form.bathrooms) : null,
        sqft: form.sqft ? Number(form.sqft) : null,
        year_built: form.year_built ? Number(form.year_built) : null,
        property_type: form.property_type, condition: form.condition,
        arv_estimate: arv, repair_estimate: repairs,
        mao, our_offer: ourOffer, assignment_fee: assignFee,
        status: 'analyzing',
      }).select('id').single();
      if (error) throw error;
      setSavedId(data!.id);
      toast.success('Deal saved!');
      fetchSaved();
      return data!.id;
    } catch (e: any) {
      toast.error(`Save failed: ${e.message}`);
      return null;
    } finally {
      setSaving(false);
    }
  };

  // Client-side fallback matcher (mirrors re-match-buyers edge function scoring)
  const matchBuyersLocal = async () => {
    const { data, error } = await supabase
      .from('re_buyers')
      .select('id, name, company, email, phone, status, buyer_type, states, buy_box_min, buy_box_max, property_types, re_buyer_criteria(states, cities, property_types, min_beds, max_price, min_arv, max_arv, condition_acceptable, max_repair_cost, active)')
      .or('status.eq.active,status.is.null');
    if (error) throw error;

    const scored = (data ?? []).map((b: any) => {
      const crit = (b.re_buyer_criteria ?? []).find((c: any) => c.active) ?? (b.re_buyer_criteria ?? [])[0];
      let score = 0;
      let maxScore = 0;
      const state = form.state;
      const city = (form.city ?? '').toLowerCase();
      const propType = (form.property_type ?? '').toLowerCase();
      const beds = form.bedrooms ? Number(form.bedrooms) : null;

      // Buyer-level buy box + states
      if (b.states?.length) { maxScore++; if (b.states.includes(state)) score++; }
      if (b.property_types?.length) { maxScore++; if (b.property_types.includes(propType)) score++; }
      if (b.buy_box_min != null || b.buy_box_max != null) {
        maxScore++;
        const okMin = b.buy_box_min == null || ourOffer >= Number(b.buy_box_min);
        const okMax = b.buy_box_max == null || ourOffer <= Number(b.buy_box_max);
        if (okMin && okMax) score++;
      }

      // Criteria-level refinements
      if (crit) {
        if (crit.states?.length) { maxScore++; if (crit.states.includes(state)) score++; }
        if (crit.cities?.length) {
          maxScore++;
          if (crit.cities.some((c: string) => city.includes(c.toLowerCase()))) score++;
        }
        if (crit.property_types?.length) { maxScore++; if (crit.property_types.includes(propType)) score++; }
        if (crit.min_beds != null && beds != null) { maxScore++; if (beds >= Number(crit.min_beds)) score++; }
        if (crit.max_price != null) { maxScore++; if (ourOffer <= Number(crit.max_price)) score++; }
        if (crit.min_arv != null || crit.max_arv != null) {
          maxScore++;
          const okMin = crit.min_arv == null || arv >= Number(crit.min_arv);
          const okMax = crit.max_arv == null || arv <= Number(crit.max_arv);
          if (okMin && okMax) score++;
        }
        if (crit.max_repair_cost != null) {
          maxScore++;
          if (repairs <= Number(crit.max_repair_cost)) score++;
        }
        if (crit.condition_acceptable?.length) {
          maxScore++;
          if (crit.condition_acceptable.includes(form.condition)) score++;
        }
      }

      if (maxScore === 0) { score = 3; maxScore = 6; }

      return {
        id: b.id,
        name: b.name,
        company: b.company,
        email: b.email,
        phone: b.phone,
        buyer_type: b.buyer_type,
        match_score: score,
        max_score: maxScore,
        match_pct: Math.round((score / Math.max(maxScore, 1)) * 100),
      };
    });

    scored.sort((a, b) => b.match_pct - a.match_pct || b.match_score - a.match_score);
    return scored;
  };

  const runMatch = async () => {
    // Auto-save first if the deal hasn't been persisted yet
    let propertyId = savedId;
    if (!propertyId) {
      if (!form.address || !form.state) {
        toast.error('Enter address + state before matching buyers.');
        return;
      }
      propertyId = await saveDeal();
      if (!propertyId) return;
    }

    setMatchOpen(true); setMatching(true); setMatches([]);
    try {
      // Try the edge function first (service-role scoring, canonical)
      const { data, error } = await supabase.functions.invoke('re-match-buyers', {
        body: {
          property_id: propertyId, state: form.state, city: form.city,
          property_type: form.property_type, arv_estimate: arv,
          repair_estimate: repairs, asking_price: ourOffer,
        },
      });
      if (error) throw error;
      const list = (data as any)?.matches ?? [];
      if (list.length > 0) {
        setMatches(list);
      } else {
        // Fall through to client-side query
        const local = await matchBuyersLocal();
        setMatches(local);
      }
    } catch (e: any) {
      console.warn('[re-match-buyers] edge failed, using client fallback:', e?.message);
      try {
        const local = await matchBuyersLocal();
        setMatches(local);
        if (local.length === 0) toast.info('No buyers in the database yet — add some in the Buyer Network tab.');
      } catch (fallbackErr: any) {
        toast.error(`Match failed: ${fallbackErr.message}`);
      }
    } finally {
      setMatching(false);
    }
  };


  const sendOffer = async (buyer: any) => {
    if (!savedId) return;
    try {
      const { error } = await supabase.from('re_offers').insert({
        property_id: savedId, buyer_id: buyer.id,
        offer_amount: ourOffer, assignment_fee: assignFee, status: 'sent',
      });
      if (error) throw error;
      toast.success(`Deal sent to ${buyer.company ?? buyer.name}!`);
    } catch (e: any) {
      toast.error(`Send failed: ${e.message}`);
    }
  };

  const dealSheet = useMemo(() => (
    `DEAL ALERT — ${form.address}\n` +
    `ARV: $${arv.toLocaleString()}\n` +
    `Asking: $${ourOffer.toLocaleString()}\n` +
    `Repairs: $${repairs.toLocaleString()}\n` +
    `Net Profit Potential: $${assignFee.toLocaleString()}\n` +
    `Property Type: ${form.property_type}\n` +
    `Condition: ${form.condition}\n` +
    `Beds/Baths: ${form.bedrooms || '?'}/${form.bathrooms || '?'}\n` +
    `Contact: David — Dynasty Wholesale`
  ), [form, arv, repairs, ourOffer, assignFee]);

  const zillowUrl = `https://www.zillow.com/homes/${encodeURIComponent(`${form.address} ${form.city} ${form.state}`)}_rb/`;
  const redfinUrl = form.zip ? `https://www.redfin.com/zipcode/${form.zip}` : 'https://www.redfin.com';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: RE_ACCENT }}>🔢 Deal Analyzer</h1>
          <p className="text-muted-foreground">Run the numbers before you make an offer</p>
        </div>
        <a href="#saved-deals"><Button variant="outline">📋 My Analyzed Deals</Button></a>
      </div>

      <Card>
        <CardHeader><CardTitle>Property Input</CardTitle></CardHeader>
        <CardContent>
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div><Label>Street Address *</Label><Input value={form.address} onChange={e => update({ address: e.target.value })} placeholder="123 Main St" /></div>
              <div><Label>City *</Label><Input value={form.city} onChange={e => update({ city: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>State *</Label>
                  <Select value={form.state} onValueChange={v => update({ state: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATE_OPTIONS.map(s => <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Zip Code</Label><Input maxLength={5} value={form.zip} onChange={e => update({ zip: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>Beds</Label><Input type="number" min={1} max={10} value={form.bedrooms} onChange={e => update({ bedrooms: e.target.value })} /></div>
                <div><Label>Baths</Label><Input type="number" min={1} step={0.5} value={form.bathrooms} onChange={e => update({ bathrooms: e.target.value })} /></div>
                <div><Label>Sqft</Label><Input type="number" value={form.sqft} onChange={e => update({ sqft: e.target.value })} /></div>
              </div>
              <div><Label>Year Built</Label><Input type="number" min={1800} max={2026} value={form.year_built} onChange={e => update({ year_built: e.target.value })} /></div>
              <div>
                <Label>Property Type</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {PROPERTY_TYPES.map(p => (
                    <Button key={p} type="button" size="sm" variant={form.property_type === p ? 'default' : 'outline'} onClick={() => update({ property_type: p })}>
                      {p.toUpperCase()}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Condition</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {CONDITIONS.map(c => (
                    <Button key={c.value} type="button" size="sm" variant={form.condition === c.value ? 'default' : 'outline'} onClick={() => update({ condition: c.value })}>
                      {c.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <Label>Estimated After Repair Value (ARV)</Label>
                <Input type="number" value={form.arv} onChange={e => update({ arv: e.target.value })} placeholder="250000" />
                <div className="flex gap-3 mt-1 text-xs">
                  <a className="text-blue-400 inline-flex items-center gap-1" href={zillowUrl} target="_blank" rel="noreferrer"><Search className="h-3 w-3" />Zillow Comps</a>
                  <a className="text-blue-400 inline-flex items-center gap-1" href={redfinUrl} target="_blank" rel="noreferrer"><Search className="h-3 w-3" />Redfin</a>
                </div>
              </div>
              <div>
                <Label>Estimated Repair Cost</Label>
                <Input type="number" value={form.repairs} onChange={e => update({ repairs: e.target.value })} placeholder="25000" />
                {sqft > 0 && (
                  <div className="mt-1 text-xs text-muted-foreground flex items-center gap-2">
                    <span>Quick estimate ({form.condition} × ${condRate}/sqft): ${quickRepairEst.toLocaleString()}</span>
                    <Button size="sm" variant="ghost" type="button" onClick={() => update({ repairs: String(quickRepairEst) })}>Use This</Button>
                  </div>
                )}
              </div>

              {arv > 0 && (
                <Card className="border-2" style={{ borderColor: RE_ACCENT }}>
                  <CardContent className="pt-4 space-y-1.5 text-sm font-mono">
                    <div className="flex justify-between"><span>ARV</span><span>${arv.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span>× 70% Rule</span><span>× 0.70</span></div>
                    <div className="flex justify-between"><span>= Gross Max</span><span>${(arv * 0.7).toLocaleString()}</span></div>
                    <div className="flex justify-between"><span>− Repairs</span><span>−${repairs.toLocaleString()}</span></div>
                    <div className="border-t my-2" />
                    <div className="flex justify-between text-base font-bold"><span>MAO</span><span style={{ color: RE_ACCENT }}>${mao.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span>Our Offer (90% MAO)</span><span>${ourOffer.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span>Target Assignment Fee</span><span>${assignFee.toLocaleString()}</span></div>
                    <div className="pt-2 flex justify-center">
                      <Badge className={`${gradeMeta.bg} text-white text-base px-4 py-1`}>{grade} — {gradeMeta.label}</Badge>
                    </div>
                  </CardContent>
                </Card>
              )}

              {mao > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button size="lg" onClick={saveDeal} disabled={saving} style={{ backgroundColor: RE_ACCENT }}>
                    <Save className="h-4 w-4 mr-1" />{saving ? 'Saving...' : 'Save Deal Analysis'}
                  </Button>
                  <Button size="lg" variant="outline" disabled={saving || matching} onClick={runMatch}><Users className="h-4 w-4 mr-1" />{matching ? 'Matching…' : 'Match to Buyers'}</Button>
                  <Button size="lg" variant="outline" onClick={() => setSheetOpen(true)}><FileText className="h-4 w-4 mr-1" />Generate Deal Sheet</Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card id="saved-deals">
        <CardHeader><CardTitle>📁 Previously Analyzed Deals</CardTitle></CardHeader>
        <CardContent>
          {savedDeals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No saved deals yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr><th className="text-left p-2">Address</th><th className="text-left p-2">ARV</th><th className="text-left p-2">MAO</th><th className="text-left p-2">Status</th><th className="text-left p-2">Analyzed</th></tr>
                </thead>
                <tbody>
                  {savedDeals.map(d => (
                    <tr key={d.id} className="border-b border-border/50">
                      <td className="p-2">{d.address}</td>
                      <td className="p-2">${Number(d.arv_estimate ?? 0).toLocaleString()}</td>
                      <td className="p-2">${Number(d.mao ?? 0).toLocaleString()}</td>
                      <td className="p-2"><Badge variant="outline">{d.status}</Badge></td>
                      <td className="p-2 text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={matchOpen} onOpenChange={setMatchOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Matching Buyers</DialogTitle></DialogHeader>
          {matching ? (
            <p className="text-sm text-muted-foreground">Finding matching buyers...</p>
          ) : matches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No buyers match this criteria yet. Add more buyers in the Buyer Network tab.</p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {matches.map(b => (
                <Card key={b.id}>
                  <CardContent className="pt-4 flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold">{b.company ?? b.name}</div>
                      <div className="text-xs text-muted-foreground">{b.email} · {b.phone}</div>
                      <div className="text-xs mt-1">Match: {b.match_score}/{b.max_score} ({b.match_pct}%)</div>
                      <div className="h-1.5 w-40 bg-muted rounded mt-1 overflow-hidden">
                        <div className="h-full" style={{ width: `${b.match_pct}%`, backgroundColor: RE_ACCENT }} />
                      </div>
                    </div>
                    <Button size="sm" onClick={() => sendOffer(b)}><Mail className="h-3 w-3 mr-1" />Send Deal</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Deal Sheet</DialogTitle></DialogHeader>
          <Textarea readOnly value={dealSheet} className="font-mono text-xs h-64" />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(dealSheet); toast.success('Copied!'); }}>Copy to Clipboard</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
