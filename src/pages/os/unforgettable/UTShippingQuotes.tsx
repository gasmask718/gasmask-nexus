import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Ship, Calculator, CheckCircle, DollarSign, Clock, Zap, TrendingUp } from 'lucide-react';

const DUTY_RATES: Record<string, number> = {
  'Party Supplies': 0.05,
  'Textiles/Fabric': 0.20,
  'Electronics/LED': 0.03,
  'Balloons/Latex': 0.04,
  'Furniture/Decor': 0.07,
  'Plastic Products': 0.05,
  'Paper Products': 0.00,
  'Metal/Steel': 0.06,
  'Inflatables': 0.04,
  'Glassware': 0.08,
};
const SECTION_301_RATE = 0.25;
const MPF_RATE = 0.003464;
const MPF_MIN = 31.67;
const MPF_MAX = 614.35;

type Option = { method: string; days: number; cost: number };

export default function UTShippingQuotes() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [rfqId, setRfqId] = useState('');
  const [productName, setProductName] = useState('');
  const [productCost, setProductCost] = useState(0);
  const [brandingCost, setBrandingCost] = useState(0);
  const [quantity, setQuantity] = useState(50);
  const [productType, setProductType] = useState('Party Supplies');
  const [country, setCountry] = useState('China');
  const [optionA, setOptionA] = useState<Option>({ method: 'DHL Express', days: 7, cost: 280 });
  const [optionB, setOptionB] = useState<Option>({ method: 'Air Economy', days: 14, cost: 140 });
  const [optionC, setOptionC] = useState<Option>({ method: 'Sea LCL', days: 35, cost: 60 });
  const [calculated, setCalculated] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [savedQuotes, setSavedQuotes] = useState<any[]>([]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchSuppliers();
    fetchRfqs();
    fetchSavedQuotes();
  }, []);

  const fetchSuppliers = async () => { const { data } = await supabase.from('ut_suppliers' as any).select('*'); setSuppliers((data || []) as any[]); };
  const fetchRfqs = async () => { const { data } = await supabase.from('ut_rfq_requests' as any).select('*').order('created_at', { ascending: false }); setRfqs((data || []) as any[]); };
  const fetchSavedQuotes = async () => { const { data } = await supabase.from('ut_supplier_quotes' as any).select('*').order('created_at', { ascending: false }); setSavedQuotes((data || []) as any[]); };

  const calculateLanded = (option: Option) => {
    const totalProduct = productCost;
    const totalBranding = brandingCost;
    const dutyRate = DUTY_RATES[productType] || 0.05;
    const section301 = country === 'China' ? SECTION_301_RATE : 0;
    const dutyBase = totalProduct + totalBranding;
    const duty = dutyBase * (dutyRate + section301);
    const mpfRaw = dutyBase * MPF_RATE;
    const mpf = Math.min(Math.max(mpfRaw, MPF_MIN), MPF_MAX);
    return {
      shipping: option.cost,
      product: totalProduct,
      branding: totalBranding,
      duty: Math.round(duty * 100) / 100,
      mpf: Math.round(mpf * 100) / 100,
      total: Math.round((totalProduct + totalBranding + option.cost + duty + mpf) * 100) / 100,
      perUnit: Math.round(((totalProduct + totalBranding + option.cost + duty + mpf) / quantity) * 100) / 100,
      days: option.days,
      method: option.method,
    };
  };

  const calculate = () => {
    const a = calculateLanded(optionA);
    const b = calculateLanded(optionB);
    const c = calculateLanded(optionC);

    // Tag recommendations
    const sorted = [a, b, c].sort((x, y) => x.total - y.total);
    const fastest = [a, b, c].sort((x, y) => x.days - y.days)[0];

    const tagged = [a, b, c].map(opt => ({
      ...opt,
      tag: opt === fastest ? '🔵 FASTEST' : opt === sorted[0] ? '💰 CHEAPEST' : '',
    }));

    // Find best value (lowest total that isn't the cheapest by much but is faster)
    const bestValue = tagged.reduce((best, opt) => {
      const score = opt.total * 0.6 + opt.days * 20 * 0.4;
      const bestScore = best.total * 0.6 + best.days * 20 * 0.4;
      return score < bestScore ? opt : best;
    });
    tagged.forEach(t => { if (t === bestValue && !t.tag) t.tag = '✅ BEST OVERALL'; });

    setResults(tagged);
    setCalculated(true);
  };

  const confirmOption = async (opt: any, label: string) => {
    const deposit = Math.round(opt.total * 0.3 * 100) / 100;
    const { error } = await supabase.from('ut_supplier_quotes' as any).insert({
      supplier_id: supplierId || null,
      supplier_name: supplierName || suppliers.find(s => s.id === supplierId)?.name || 'Unknown',
      product_name: productName,
      quantity,
      product_cost: productCost,
      branding_cost: brandingCost,
      [`option_${label.toLowerCase()}_method`]: opt.method,
      [`option_${label.toLowerCase()}_days`]: opt.days,
      [`option_${label.toLowerCase()}_cost`]: opt.shipping,
      [`option_${label.toLowerCase()}_landed`]: opt.total,
      selected_option: label,
      deposit_amount: deposit,
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      notes,
    } as any);

    if (error) { toast.error('Failed to save quote'); return; }
    toast.success(`Option ${label} confirmed! Deposit: $${deposit}`);
    fetchSavedQuotes();
  };

  const OptionInput = ({ label, option, setOption }: { label: string; option: Option; setOption: (o: Option) => void }) => (
    <div className="border rounded-lg p-3 space-y-2">
      <p className="font-semibold text-sm">{label}</p>
      <Select value={option.method} onValueChange={v => setOption({ ...option, method: v })}>
        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
        <SelectContent>
          {['DHL Express', 'FedEx', 'UPS', 'Air Economy', 'Sea LCL', 'Sea FCL', 'Local Pickup'].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
        </SelectContent>
      </Select>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="text-xs">Days</label><Input type="number" value={option.days} onChange={e => setOption({ ...option, days: Number(e.target.value) })} className="h-8" /></div>
        <div><label className="text-xs">Cost $</label><Input type="number" value={option.cost} onChange={e => setOption({ ...option, cost: Number(e.target.value) })} className="h-8" /></div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">🚢 Shipping Quote Comparator</h1>
        <p className="text-muted-foreground">Enter supplier shipping options, instantly see your true landed cost</p>
      </div>

      <Card>
        <CardHeader><CardTitle><Calculator className="inline mr-2 h-5 w-5" />Quote Calculator</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium">Supplier</label>
              <Select value={supplierId} onValueChange={v => { setSupplierId(v); setSupplierName(suppliers.find(s => s.id === v)?.name || ''); }}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">RFQ / Product</label>
              <Select value={rfqId} onValueChange={v => { setRfqId(v); const r = rfqs.find(rr => rr.id === v); if (r) setProductName(r.product_name); }}>
                <SelectTrigger><SelectValue placeholder="Select RFQ" /></SelectTrigger>
                <SelectContent>{rfqs.map(r => <SelectItem key={r.id} value={r.id}>{r.product_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><label className="text-sm font-medium">Product Name</label><Input value={productName} onChange={e => setProductName(e.target.value)} /></div>
          </div>
          <div className="grid md:grid-cols-4 gap-3">
            <div><label className="text-sm font-medium">Product Cost (total) $</label><Input type="number" value={productCost} onChange={e => setProductCost(Number(e.target.value))} /></div>
            <div><label className="text-sm font-medium">Branding Cost (total) $</label><Input type="number" value={brandingCost} onChange={e => setBrandingCost(Number(e.target.value))} /></div>
            <div><label className="text-sm font-medium">Quantity</label><Input type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value))} /></div>
            <div>
              <label className="text-sm font-medium">Country</label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="China">🇨🇳 China</SelectItem>
                  <SelectItem value="India">🇮🇳 India</SelectItem>
                  <SelectItem value="USA">🇺🇸 USA (domestic)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Product Type (for duty)</label>
            <Select value={productType} onValueChange={setProductType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.keys(DUTY_RATES).map(k => <SelectItem key={k} value={k}>{k} ({(DUTY_RATES[k] * 100).toFixed(0)}%{k !== 'Paper Products' && country === 'China' ? ' +25% §301' : ''})</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <OptionInput label="Option A" option={optionA} setOption={setOptionA} />
            <OptionInput label="Option B" option={optionB} setOption={setOptionB} />
            <OptionInput label="Option C" option={optionC} setOption={setOptionC} />
          </div>

          <Button size="lg" className="w-full" onClick={calculate}>
            <Zap className="mr-2 h-4 w-4" /> Calculate All Options
          </Button>
        </CardContent>
      </Card>

      {calculated && results.length > 0 && (
        <Card>
          <CardHeader><CardTitle>📊 Comparison Results</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2"></th>
                    {results.map((r, i) => <th key={i} className="text-center p-2 font-bold">Option {String.fromCharCode(65 + i)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Ship Method', key: 'method' },
                    { label: 'Ship Days', key: 'days', suffix: ' days' },
                    { label: 'Ship Cost', key: 'shipping', prefix: '$' },
                    { label: 'Product Cost', key: 'product', prefix: '$' },
                    { label: 'Branding', key: 'branding', prefix: '$' },
                    { label: 'Import Duty', key: 'duty', prefix: '$' },
                    { label: 'MPF Fee', key: 'mpf', prefix: '$' },
                  ].map(row => (
                    <tr key={row.label} className="border-b">
                      <td className="p-2 font-medium">{row.label}</td>
                      {results.map((r, i) => (
                        <td key={i} className="text-center p-2">{row.prefix || ''}{r[row.key]?.toLocaleString?.() || r[row.key]}{row.suffix || ''}</td>
                      ))}
                    </tr>
                  ))}
                  <tr className="border-t-2 border-primary font-bold bg-muted/30">
                    <td className="p-2">TOTAL LANDED</td>
                    {results.map((r, i) => <td key={i} className="text-center p-2 text-lg">${r.total.toLocaleString()}</td>)}
                  </tr>
                  <tr className="font-bold">
                    <td className="p-2">Per Unit</td>
                    {results.map((r, i) => <td key={i} className="text-center p-2">${r.perUnit}</td>)}
                  </tr>
                  <tr>
                    <td className="p-2">Time to Door</td>
                    {results.map((r, i) => <td key={i} className="text-center p-2">{r.days} days</td>)}
                  </tr>
                  <tr>
                    <td className="p-2">Recommendation</td>
                    {results.map((r, i) => <td key={i} className="text-center p-2"><Badge variant="outline">{r.tag || '—'}</Badge></td>)}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ROI Section */}
            <div className="mt-4 p-4 rounded-lg bg-muted/50 border">
              <p className="font-semibold mb-1"><TrendingUp className="inline mr-1 h-4 w-4" /> Rental ROI Analysis</p>
              <p className="text-sm text-muted-foreground">At $75 rental price per unit:</p>
              <div className="grid md:grid-cols-3 gap-2 mt-2">
                {results.map((r, i) => (
                  <div key={i} className="text-center">
                    <p className="text-xs text-muted-foreground">Option {String.fromCharCode(65 + i)}</p>
                    <p className="font-bold text-green-400">Break-even: {Math.ceil(r.total / 75)} rentals</p>
                    <p className="text-xs">Annual profit: ${Math.round((75 * quantity * 12) - r.total).toLocaleString()} 🔥</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Confirm Buttons */}
            <div className="grid md:grid-cols-3 gap-3 mt-4">
              {results.map((r, i) => {
                const label = String.fromCharCode(65 + i);
                return (
                  <Button key={i} variant="outline" className="h-auto py-3" onClick={() => confirmOption(r, label)}>
                    <div className="text-center">
                      <CheckCircle className="h-5 w-5 mx-auto mb-1" />
                      <p className="font-bold">Select Option {label}</p>
                      <p className="text-xs text-muted-foreground">Pay ${r.shipping} shipping</p>
                      <p className="text-xs">30% deposit: ${Math.round(r.total * 0.3)}</p>
                    </div>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Saved Quotes */}
      {savedQuotes.length > 0 && (
        <Card>
          <CardHeader><CardTitle>📋 Saved Shipping Quotes</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b">
                  <th className="text-left p-2">Product</th>
                  <th className="text-left p-2">Supplier</th>
                  <th className="text-center p-2">Selected</th>
                  <th className="text-center p-2">Deposit</th>
                  <th className="text-center p-2">Status</th>
                </tr></thead>
                <tbody>
                  {savedQuotes.map(q => (
                    <tr key={q.id} className="border-b">
                      <td className="p-2">{q.product_name}</td>
                      <td className="p-2">{q.supplier_name}</td>
                      <td className="text-center p-2"><Badge variant="outline">Option {q.selected_option}</Badge></td>
                      <td className="text-center p-2">${q.deposit_amount}</td>
                      <td className="text-center p-2"><Badge variant={q.status === 'confirmed' ? 'default' : 'outline'}>{q.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
