import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator, TrendingUp, CheckCircle2, AlertTriangle } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// FUNDING QUALIFICATION CALCULATOR
// Client-side estimator — no database writes, no duplicated business logic.
// ═══════════════════════════════════════════════════════════════════════════════

type Strength = 'Strong' | 'Moderate' | 'Weak';

interface Recommendation {
  product: string;
  fit: 'Excellent' | 'Good' | 'Marginal';
  note: string;
}

function fmtUsd(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

function estimate({
  creditScore,
  annualRevenue,
  yearsInBusiness,
  requestedAmount,
}: {
  creditScore: number;
  annualRevenue: number;
  yearsInBusiness: number;
  requestedAmount: number;
}) {
  // Simple heuristic model — replace/tune as business logic evolves.
  let baseline = annualRevenue * 0.15;

  const creditMultiplier =
    creditScore >= 780 ? 2.2 :
    creditScore >= 720 ? 1.8 :
    creditScore >= 680 ? 1.35 :
    creditScore >= 640 ? 1.0 :
    creditScore >= 600 ? 0.65 : 0.35;

  const yearsMultiplier =
    yearsInBusiness >= 5 ? 1.3 :
    yearsInBusiness >= 2 ? 1.1 :
    yearsInBusiness >= 1 ? 0.85 : 0.5;

  const midpoint = Math.max(5000, baseline * creditMultiplier * yearsMultiplier);
  const low = midpoint * 0.6;
  const high = midpoint * 1.5;

  // Strength scoring (0-100)
  const creditPts = Math.max(0, Math.min(40, ((creditScore - 550) / 250) * 40));
  const revPts = Math.max(0, Math.min(35, (annualRevenue / 500000) * 35));
  const yearsPts = Math.max(0, Math.min(25, (yearsInBusiness / 5) * 25));
  const score = Math.round(creditPts + revPts + yearsPts);
  const strength: Strength = score >= 70 ? 'Strong' : score >= 45 ? 'Moderate' : 'Weak';

  // Timeline (business days)
  const timeline =
    strength === 'Strong' ? '3 – 10 business days'
    : strength === 'Moderate' ? '2 – 4 weeks'
    : '4 – 8 weeks (repair recommended first)';

  // Recommended products
  const recs: Recommendation[] = [];
  if (creditScore >= 680 && yearsInBusiness >= 2) {
    recs.push({ product: 'Business Line of Credit', fit: creditScore >= 720 ? 'Excellent' : 'Good', note: 'Chase / BofA / Bluevine / Fundbox' });
  }
  if (creditScore >= 680 && yearsInBusiness >= 2 && annualRevenue >= 100000) {
    recs.push({ product: 'SBA 7(a) Loan', fit: creditScore >= 720 ? 'Excellent' : 'Good', note: 'Longer approval, best rates' });
  }
  if (creditScore >= 640) {
    recs.push({ product: 'Business Credit Cards (Stacking)', fit: 'Good', note: 'Amex, Chase Ink, Capital One Spark' });
  }
  if (annualRevenue >= 120000) {
    recs.push({ product: 'Revenue-Based Advance (MCA)', fit: yearsInBusiness >= 1 ? 'Good' : 'Marginal', note: 'Fast funding, higher cost' });
  }
  if (yearsInBusiness >= 1 && annualRevenue >= 50000) {
    recs.push({ product: 'Equipment Financing', fit: 'Good', note: 'Collateralized, easier approval' });
  }
  if (creditScore < 640) {
    recs.push({ product: 'Credit Repair + Business Builder', fit: 'Marginal', note: 'Recommended before funding push' });
  }

  // Next actions
  const actions: string[] = [];
  if (creditScore < 680) actions.push('Run dispute rounds to lift score above 680');
  if (yearsInBusiness < 2) actions.push('Age business entity and file 2 tax returns');
  if (annualRevenue < 100000) actions.push('Grow monthly deposits to $10K+ before applying');
  if (requestedAmount > high) actions.push(`Requested amount exceeds estimated ceiling (${fmtUsd(high)}) — consider phased stacking`);
  if (actions.length === 0) actions.push('Client is fundable — proceed to Funding Matrix');

  return { low, midpoint, high, score, strength, timeline, recommendations: recs, actions };
}

export default function FundingQualificationCalculator() {
  const [creditScore, setCreditScore] = useState(700);
  const [annualRevenue, setAnnualRevenue] = useState(250000);
  const [yearsInBusiness, setYearsInBusiness] = useState(3);
  const [industry, setIndustry] = useState('general');
  const [requestedAmount, setRequestedAmount] = useState(50000);

  const result = useMemo(
    () => estimate({ creditScore, annualRevenue, yearsInBusiness, requestedAmount }),
    [creditScore, annualRevenue, yearsInBusiness, requestedAmount],
  );

  const strengthColor =
    result.strength === 'Strong' ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
    : result.strength === 'Moderate' ? 'text-amber-400 border-amber-500/40 bg-amber-500/10'
    : 'text-red-400 border-red-500/40 bg-red-500/10';

  return (
    <div className="space-y-6">
      {/* Inputs */}
      <Card className="border-amber-500/30">
        <CardHeader>
          <CardTitle className="text-amber-400 flex items-center gap-2">
            <Calculator className="h-5 w-5" /> Funding Qualification Calculator
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs">Credit Score</Label>
            <Input
              type="number"
              min={300}
              max={850}
              value={creditScore}
              onChange={(e) => setCreditScore(Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label className="text-xs">Annual Revenue ($)</Label>
            <Input
              type="number"
              min={0}
              value={annualRevenue}
              onChange={(e) => setAnnualRevenue(Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label className="text-xs">Years in Business</Label>
            <Input
              type="number"
              min={0}
              step={0.5}
              value={yearsInBusiness}
              onChange={(e) => setYearsInBusiness(Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label className="text-xs">Industry (optional)</Label>
            <Select value={industry} onValueChange={setIndustry}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="retail">Retail</SelectItem>
                <SelectItem value="services">Services</SelectItem>
                <SelectItem value="ecommerce">E-commerce</SelectItem>
                <SelectItem value="construction">Construction</SelectItem>
                <SelectItem value="restaurant">Restaurant / Food</SelectItem>
                <SelectItem value="trucking">Trucking / Logistics</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Requested Amount ($) (optional)</Label>
            <Input
              type="number"
              min={0}
              value={requestedAmount}
              onChange={(e) => setRequestedAmount(Number(e.target.value) || 0)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-amber-500/30">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Estimated Funding Range</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-amber-400">
              {fmtUsd(result.low)} – {fmtUsd(result.high)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Midpoint {fmtUsd(result.midpoint)}
            </div>
          </CardContent>
        </Card>
        <Card className={`border ${strengthColor.split(' ').find(c => c.startsWith('border')) || ''}`}>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Approval Strength</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-black ${strengthColor.split(' ').find(c => c.startsWith('text')) || ''}`}>{result.strength}</span>
              <Badge variant="outline" className={strengthColor}>{result.score}/100</Badge>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-500/30">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Estimated Timeline</CardTitle></CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-amber-400 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> {result.timeline}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recommended products */}
      <Card>
        <CardHeader><CardTitle className="text-base">Recommended Funding Products</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {result.recommendations.length === 0 ? (
            <div className="text-sm text-muted-foreground">No products match current profile.</div>
          ) : (
            result.recommendations.map((r, i) => (
              <div key={i} className="flex items-start justify-between p-3 rounded-lg border border-border/60">
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" /> {r.product}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{r.note}</div>
                </div>
                <Badge variant="outline" className={
                  r.fit === 'Excellent' ? 'border-emerald-500/40 text-emerald-400'
                  : r.fit === 'Good' ? 'border-amber-500/40 text-amber-400'
                  : 'border-red-500/40 text-red-400'
                }>
                  {r.fit}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Next actions */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-400" /> Recommended Next Actions</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {result.actions.map((a, i) => (
              <li key={i} className="text-sm flex items-start gap-2">
                <span className="text-amber-400 mt-1">•</span>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
