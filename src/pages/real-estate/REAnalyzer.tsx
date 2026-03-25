import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator } from 'lucide-react';

export default function REAnalyzer() {
  const [form, setForm] = useState({
    address: '', state: '', arv: '', repairs: '', askingPrice: '',
    condition: 'fair',
  });
  const [result, setResult] = useState<any>(null);

  const analyze = () => {
    const arv = parseFloat(form.arv) || 0;
    const repairs = parseFloat(form.repairs) || 0;
    const asking = parseFloat(form.askingPrice) || 0;
    const mao = arv * 0.70 - repairs;
    const spread = asking > 0 ? asking - mao : arv - mao;
    const feeProjection = arv * 0.85 - mao; // market price (~85% ARV) minus your MAO
    let score = 'C';
    if (feeProjection >= 30000) score = 'A';
    else if (feeProjection >= 15000) score = 'B';

    setResult({ arv, repairs, mao, asking, spread, feeProjection, score });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: '#3B6D11' }}>Deal Analyzer</h1>
        <p className="text-muted-foreground">Evaluate any property in seconds</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Property Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><Label>Property Address</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="123 Main St" /></div>
            <div><Label>State</Label><Input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} placeholder="FL" /></div>
            <div><Label>Condition</Label>
              <Select value={form.condition} onValueChange={v => setForm({ ...form, condition: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['excellent','good','fair','poor','uninhabitable'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>After Repair Value (ARV)</Label><Input type="number" value={form.arv} onChange={e => setForm({ ...form, arv: e.target.value })} placeholder="250000" /></div>
            <div><Label>Estimated Repairs</Label><Input type="number" value={form.repairs} onChange={e => setForm({ ...form, repairs: e.target.value })} placeholder="25000" /></div>
            <div><Label>Seller Asking Price</Label><Input type="number" value={form.askingPrice} onChange={e => setForm({ ...form, askingPrice: e.target.value })} placeholder="180000" /></div>
            <Button onClick={analyze} className="w-full" style={{ backgroundColor: '#3B6D11' }}>
              <Calculator className="h-4 w-4 mr-2" />Analyze Deal
            </Button>
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Analysis Results</CardTitle>
                <Badge className="text-lg px-4 py-1" style={{
                  backgroundColor: result.score === 'A' ? '#3B6D11' : result.score === 'B' ? '#f59e0b' : '#ef4444'
                }}>{result.score} Deal</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="text-sm text-muted-foreground">ARV</div>
                  <div className="text-2xl font-bold">${result.arv.toLocaleString()}</div>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="text-sm text-muted-foreground">Repairs</div>
                  <div className="text-2xl font-bold">${result.repairs.toLocaleString()}</div>
                </div>
                <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgba(59,109,17,0.1)' }}>
                  <div className="text-sm text-muted-foreground">MAO (70% ARV - Repairs)</div>
                  <div className="text-2xl font-bold" style={{ color: '#3B6D11' }}>${result.mao.toLocaleString()}</div>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="text-sm text-muted-foreground">Asking Price</div>
                  <div className="text-2xl font-bold">${result.asking.toLocaleString()}</div>
                </div>
              </div>

              <div className="p-4 rounded-lg border-2" style={{ borderColor: '#3B6D11' }}>
                <div className="text-sm text-muted-foreground">Projected Assignment Fee</div>
                <div className="text-3xl font-bold" style={{ color: '#3B6D11' }}>${result.feeProjection.toLocaleString()}</div>
              </div>

              <div className="p-4 rounded-lg bg-muted/50">
                <div className="text-sm text-muted-foreground">Gap to Bridge (Asking vs MAO)</div>
                <div className="text-xl font-bold">${Math.abs(result.asking - result.mao).toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">
                  {result.asking <= result.mao ? '✅ At or below MAO — make the offer!' : '⚠️ Above MAO — negotiate down'}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
