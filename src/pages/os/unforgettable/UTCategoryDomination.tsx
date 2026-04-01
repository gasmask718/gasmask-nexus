import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Crown, Target, TrendingUp, Shield, Package, Plus, Zap, BarChart3, Users, DollarSign, Star, AlertTriangle, CheckCircle2, ArrowUpRight } from 'lucide-react';
import { useDominationCategories, useCategorySuppliers, useCategoryPricing, useCategoryBranding, useCategoryExpansion, useCategoryMutations } from '@/hooks/useCategoryDomination';

const STATUS_COLORS: Record<string, string> = {
  tracking: 'bg-muted text-muted-foreground',
  targeting: 'bg-blue-500/20 text-blue-400',
  dominating: 'bg-amber-500/20 text-amber-400',
  dominated: 'bg-green-500/20 text-green-400',
};

const TIER_COLORS: Record<string, string> = {
  exclusive: 'bg-purple-500/20 text-purple-400',
  preferred: 'bg-green-500/20 text-green-400',
  standard: 'bg-muted text-muted-foreground',
  backup: 'bg-red-500/20 text-red-400',
};

const PRIORITY_ICONS: Record<string, typeof Crown> = {
  critical: Zap,
  high: Target,
  medium: TrendingUp,
  low: BarChart3,
};

export default function UTCategoryDomination() {
  const { data: categories = [], isLoading } = useDominationCategories();
  const { createCategory, updateCategory } = useCategoryMutations();
  const [selected, setSelected] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newCat, setNewCat] = useState({ category_name: '', demand_score: 50, margin_score: 50, repeat_frequency: 50, branding_potential: 50, competition_score: 50, priority_level: 'medium' });

  const selectedCat = categories.find((c: any) => c.id === selected);

  const handleCreate = () => {
    createCategory.mutate(newCat, {
      onSuccess: () => {
        setShowAdd(false);
        setNewCat({ category_name: '', demand_score: 50, margin_score: 50, repeat_frequency: 50, branding_potential: 50, competition_score: 50, priority_level: 'medium' });
      },
    });
  };

  const topCategories = categories.filter((c: any) => Number(c.total_score) >= 70);
  const avgScore = categories.length ? (categories.reduce((s: number, c: any) => s + Number(c.total_score), 0) / categories.length).toFixed(1) : '0';
  const dominatedCount = categories.filter((c: any) => c.status === 'dominated').length;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Crown className="h-8 w-8 text-amber-400" /> Category Domination System</h1>
          <p className="text-muted-foreground">Control categories. Lock suppliers. Own the market.</p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Category</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>New Domination Category</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Category Name</Label><Input value={newCat.category_name} onChange={e => setNewCat(p => ({ ...p, category_name: e.target.value }))} placeholder="e.g. Balloon Systems" /></div>
              {(['demand_score', 'margin_score', 'repeat_frequency', 'branding_potential', 'competition_score'] as const).map(k => (
                <div key={k}>
                  <Label className="capitalize">{k.replace(/_/g, ' ')} — {newCat[k]}</Label>
                  <Slider min={0} max={100} step={1} value={[newCat[k]]} onValueChange={([v]) => setNewCat(p => ({ ...p, [k]: v }))} />
                </div>
              ))}
              <div><Label>Priority</Label>
                <Select value={newCat.priority_level} onValueChange={v => setNewCat(p => ({ ...p, priority_level: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['critical','high','medium','low'].map(o => <SelectItem key={o} value={o} className="capitalize">{o}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={handleCreate} disabled={!newCat.category_name || createCategory.isPending}>Create Category</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6 flex items-center gap-4"><Package className="h-10 w-10 text-primary" /><div><p className="text-sm text-muted-foreground">Total Categories</p><p className="text-2xl font-bold">{categories.length}</p></div></CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-4"><Target className="h-10 w-10 text-blue-400" /><div><p className="text-sm text-muted-foreground">High Priority</p><p className="text-2xl font-bold">{topCategories.length}</p></div></CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-4"><Crown className="h-10 w-10 text-amber-400" /><div><p className="text-sm text-muted-foreground">Dominated</p><p className="text-2xl font-bold">{dominatedCount}</p></div></CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-4"><TrendingUp className="h-10 w-10 text-green-400" /><div><p className="text-sm text-muted-foreground">Avg Score</p><p className="text-2xl font-bold">{avgScore}</p></div></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Rankings */}
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-lg">Category Rankings</CardTitle><CardDescription>Click to inspect</CardDescription></CardHeader>
          <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
            {isLoading ? <p className="text-muted-foreground">Loading…</p> : categories.map((c: any, i: number) => {
              const Icon = PRIORITY_ICONS[c.priority_level] || TrendingUp;
              return (
                <button key={c.id} onClick={() => setSelected(c.id)} className={`w-full text-left p-3 rounded-lg border transition-colors ${selected === c.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm font-mono">#{i + 1}</span>
                      <Icon className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">{c.category_name}</span>
                    </div>
                    <span className="font-bold text-lg">{Number(c.total_score).toFixed(1)}</span>
                  </div>
                  <div className="flex gap-2 mt-1">
                    <Badge className={`text-[10px] ${STATUS_COLORS[c.status]}`}>{c.status}</Badge>
                    <Badge variant="outline" className="text-[10px] capitalize">{c.priority_level}</Badge>
                  </div>
                  <Progress value={Number(c.total_score)} className="mt-2 h-1.5" />
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* Detail Panel */}
        <div className="lg:col-span-2">
          {selectedCat ? (
            <CategoryDetail category={selectedCat} onStatusChange={(status: string) => updateCategory.mutate({ id: selectedCat.id, status })} />
          ) : (
            <Card className="h-full flex items-center justify-center"><CardContent><p className="text-muted-foreground text-center">Select a category to view domination details</p></CardContent></Card>
          )}
        </div>
      </div>
    </div>
  );
}

function CategoryDetail({ category, onStatusChange }: { category: any; onStatusChange: (s: string) => void }) {
  return (
    <Tabs defaultValue="overview" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2"><Crown className="h-5 w-5 text-amber-400" />{category.category_name}</h2>
        <Select value={category.status} onValueChange={onStatusChange}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>{['tracking','targeting','dominating','dominated'].map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <TabsList className="grid grid-cols-5 w-full">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
        <TabsTrigger value="pricing">Pricing</TabsTrigger>
        <TabsTrigger value="branding">Branding</TabsTrigger>
        <TabsTrigger value="expansion">Expansion</TabsTrigger>
      </TabsList>
      <TabsContent value="overview"><OverviewTab category={category} /></TabsContent>
      <TabsContent value="suppliers"><SuppliersTab categoryId={category.id} /></TabsContent>
      <TabsContent value="pricing"><PricingTab categoryId={category.id} /></TabsContent>
      <TabsContent value="branding"><BrandingTab categoryId={category.id} /></TabsContent>
      <TabsContent value="expansion"><ExpansionTab categoryId={category.id} /></TabsContent>
    </Tabs>
  );
}

function OverviewTab({ category }: { category: any }) {
  const scores = [
    { label: 'Demand', value: Number(category.demand_score), weight: '30%' },
    { label: 'Margin', value: Number(category.margin_score), weight: '25%' },
    { label: 'Repeat Freq', value: Number(category.repeat_frequency), weight: '20%' },
    { label: 'Branding', value: Number(category.branding_potential), weight: '15%' },
    { label: 'Competition', value: Number(category.competition_score), weight: '10%' },
  ];
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Score Breakdown</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center p-4 rounded-lg bg-primary/5 border border-primary/20">
          <p className="text-sm text-muted-foreground">Domination Score</p>
          <p className="text-5xl font-bold text-primary">{Number(category.total_score).toFixed(1)}</p>
        </div>
        {scores.map(s => (
          <div key={s.label} className="space-y-1">
            <div className="flex justify-between text-sm"><span>{s.label} <span className="text-muted-foreground">({s.weight})</span></span><span className="font-medium">{s.value}</span></div>
            <Progress value={s.value} className="h-2" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SuppliersTab({ categoryId }: { categoryId: string }) {
  const { data: suppliers = [] } = useCategorySuppliers(categoryId);
  const { addCategorySupplier } = useCategoryMutations();
  const [name, setName] = useState('');
  const [tier, setTier] = useState('standard');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2"><Users className="h-5 w-5" /> Supplier Control</CardTitle>
        <div className="flex gap-2 mt-2">
          <Input placeholder="Supplier name" value={name} onChange={e => setName(e.target.value)} className="flex-1" />
          <Select value={tier} onValueChange={setTier}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>{['exclusive','preferred','standard','backup'].map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" onClick={() => { if (name) { addCategorySupplier.mutate({ category_id: categoryId, supplier_name: name, tier }); setName(''); } }}><Plus className="h-4 w-4" /></Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {suppliers.length === 0 ? <p className="text-muted-foreground text-sm">No suppliers linked yet</p> : suppliers.map((s: any) => (
          <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <p className="font-medium">{s.supplier_name}</p>
              <div className="flex gap-2 mt-1">
                <Badge className={`text-[10px] ${TIER_COLORS[s.tier]}`}>{s.tier}</Badge>
                {s.exclusivity_status !== 'none' && <Badge variant="outline" className="text-[10px]">{s.exclusivity_status}</Badge>}
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">{Number(s.performance_score).toFixed(0)}/100</p>
              <p className="text-xs text-muted-foreground">Performance</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PricingTab({ categoryId }: { categoryId: string }) {
  const { data: pricing } = useCategoryPricing(categoryId);
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg flex items-center gap-2"><DollarSign className="h-5 w-5" /> Pricing Engine</CardTitle></CardHeader>
      <CardContent>
        {!pricing ? <p className="text-muted-foreground text-sm">No pricing data yet. Add via the database.</p> : (
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-muted/50"><p className="text-sm text-muted-foreground">Avg Supplier Cost</p><p className="text-2xl font-bold">${Number(pricing.avg_supplier_cost).toFixed(2)}</p></div>
            <div className="p-4 rounded-lg bg-muted/50"><p className="text-sm text-muted-foreground">Avg Selling Price</p><p className="text-2xl font-bold">${Number(pricing.avg_selling_price).toFixed(2)}</p></div>
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20"><p className="text-sm text-muted-foreground">Margin</p><p className="text-2xl font-bold text-green-400">{Number(pricing.margin_pct).toFixed(1)}%</p></div>
            <div className="p-4 rounded-lg bg-muted/50"><p className="text-sm text-muted-foreground">Strategy</p><p className="text-2xl font-bold capitalize">{pricing.pricing_strategy}</p></div>
            {pricing.competitor_price_low && (
              <div className="col-span-2 p-4 rounded-lg border"><p className="text-sm text-muted-foreground">Competitor Range</p><p className="text-lg font-medium">${Number(pricing.competitor_price_low).toFixed(2)} – ${Number(pricing.competitor_price_high).toFixed(2)}</p></div>
            )}
            <div className="col-span-2 grid grid-cols-4 gap-2">
              {[['Retail', pricing.tier_retail_price], ['Business', pricing.tier_business_price], ['Bulk', pricing.tier_bulk_price], ['Kit', pricing.tier_kit_price]].map(([label, val]) => (
                <div key={label as string} className="p-3 rounded-lg border text-center"><p className="text-xs text-muted-foreground">{label as string}</p><p className="font-bold">{val ? `$${Number(val).toFixed(2)}` : '—'}</p></div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BrandingTab({ categoryId }: { categoryId: string }) {
  const { data: branding } = useCategoryBranding(categoryId);
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Star className="h-5 w-5" /> Brand Control</CardTitle></CardHeader>
      <CardContent>
        {!branding ? <p className="text-muted-foreground text-sm">No branding data yet.</p> : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-muted/50 text-center"><p className="text-sm text-muted-foreground">Total Products</p><p className="text-2xl font-bold">{branding.total_products}</p></div>
              <div className="p-4 rounded-lg bg-purple-500/10 text-center"><p className="text-sm text-muted-foreground">Branded</p><p className="text-2xl font-bold text-purple-400">{branding.branded_count}</p></div>
              <div className="p-4 rounded-lg bg-muted/50 text-center"><p className="text-sm text-muted-foreground">White Label</p><p className="text-2xl font-bold">{branding.white_label_count}</p></div>
            </div>
            <div><p className="text-sm text-muted-foreground mb-1">Branding Adoption</p><Progress value={Number(branding.branding_adoption_pct)} className="h-3" /><p className="text-right text-sm font-medium mt-1">{Number(branding.branding_adoption_pct).toFixed(1)}%</p></div>
            {branding.kit_names?.length > 0 && (
              <div><p className="text-sm text-muted-foreground mb-2">Kit Products</p><div className="flex flex-wrap gap-2">{branding.kit_names.map((k: string) => <Badge key={k} variant="outline">{k}</Badge>)}</div></div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ExpansionTab({ categoryId }: { categoryId: string }) {
  const { data: items = [] } = useCategoryExpansion(categoryId);
  const { resolveExpansion } = useCategoryMutations();
  const TYPE_ICONS: Record<string, typeof Package> = { new_product: Package, new_supplier: Users, new_bundle: Star, pricing_strategy: DollarSign };

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg flex items-center gap-2"><ArrowUpRight className="h-5 w-5" /> Expansion Recommendations</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? <p className="text-muted-foreground text-sm">No expansion recommendations yet</p> : items.map((it: any) => {
          const Icon = TYPE_ICONS[it.recommendation_type] || Package;
          return (
            <div key={it.id} className="p-3 rounded-lg border space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-primary" /><span className="font-medium text-sm">{it.title}</span></div>
                <Badge variant="outline" className="text-[10px]">{it.recommendation_type.replace(/_/g, ' ')}</Badge>
              </div>
              {it.description && <p className="text-sm text-muted-foreground">{it.description}</p>}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">AI Confidence: {(Number(it.ai_confidence) * 100).toFixed(0)}%</span>
                {it.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => resolveExpansion.mutate({ id: it.id, status: 'rejected' })}>Reject</Button>
                    <Button size="sm" onClick={() => resolveExpansion.mutate({ id: it.id, status: 'approved' })}><CheckCircle2 className="h-3 w-3 mr-1" />Approve</Button>
                  </div>
                )}
                {it.status !== 'pending' && <Badge className={it.status === 'approved' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>{it.status}</Badge>}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
