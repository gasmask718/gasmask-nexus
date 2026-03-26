import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Package, TrendingUp, DollarSign, Zap, Search, Plus, RefreshCw, Star,
  ArrowLeft, Truck, BarChart3, Gift, Wrench, ExternalLink, Target
} from 'lucide-react';
import { useUTProducts, useUTSuppliers, useUTProductCategories, useUTProductMutations } from '@/hooks/useUTProducts';
import { toast } from 'sonner';

const PRODUCT_TYPE_TABS = [
  { value: 'all', label: 'All Products', icon: Package },
  { value: 'gift', label: 'Gift Ideas', icon: Gift },
  { value: 'business_asset', label: 'Business Builder', icon: Wrench },
];

const REC_COLORS: Record<string, string> = {
  high: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  low: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export default function UTProductEngine() {
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [recFilter, setRecFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  const { data: products = [], isLoading } = useUTProducts({
    product_type: typeFilter === 'all' ? undefined : typeFilter,
    search: search || undefined,
    category: catFilter || undefined,
    recommendation_level: recFilter || undefined,
  });
  const { data: suppliers = [] } = useUTSuppliers();
  const { data: categories = [] } = useUTProductCategories();
  const { scoreProducts, createProduct } = useUTProductMutations();

  const giftCount = products.filter((p: any) => p.product_type === 'gift').length;
  const assetCount = products.filter((p: any) => p.product_type === 'business_asset').length;
  const trendingCount = products.filter((p: any) => p.is_trending).length;
  const avgScore = products.length
    ? (products.reduce((s: number, p: any) => s + (Number(p.overall_score) || 0), 0) / products.length).toFixed(1)
    : '0';

  const [newProduct, setNewProduct] = useState<Record<string, any>>({
    name: '', description: '', product_type: 'gift', category: '', sell_price: '',
    cost_price: '', landed_cost: '', shipping_speed_days: '', fulfillment_model: 'dropship',
    supplier_id: '', rental_price_estimate: '', tags: '',
  });

  const handleCreate = () => {
    if (!newProduct.name || !newProduct.category) {
      toast.error('Name and category required');
      return;
    }
    const payload: Record<string, any> = {
      name: newProduct.name,
      description: newProduct.description || null,
      product_type: newProduct.product_type,
      category: newProduct.category,
      fulfillment_model: newProduct.fulfillment_model || 'dropship',
    };
    if (newProduct.sell_price) payload.sell_price = Number(newProduct.sell_price);
    if (newProduct.cost_price) payload.cost_price = Number(newProduct.cost_price);
    if (newProduct.landed_cost) payload.landed_cost = Number(newProduct.landed_cost);
    if (newProduct.shipping_speed_days) payload.shipping_speed_days = Number(newProduct.shipping_speed_days);
    if (newProduct.supplier_id) payload.supplier_id = newProduct.supplier_id;
    if (newProduct.rental_price_estimate) payload.rental_price_estimate = Number(newProduct.rental_price_estimate);
    if (newProduct.tags) payload.tags = newProduct.tags.split(',').map((t: string) => t.trim());

    // Auto-calc margin
    if (payload.sell_price && payload.landed_cost) {
      payload.margin_pct = ((payload.sell_price - payload.landed_cost) / payload.sell_price * 100).toFixed(1);
    } else if (payload.sell_price && payload.cost_price) {
      payload.margin_pct = ((payload.sell_price - payload.cost_price) / payload.sell_price * 100).toFixed(1);
    }

    createProduct.mutate(payload, { onSuccess: () => setShowCreate(false) });
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/os/unforgettable')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Package className="h-6 w-6 text-primary" />
              Product Engine
            </h1>
            <p className="text-sm text-muted-foreground">Gift Ideas · Business Builder · Supplier Intelligence</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/os/unforgettable/suppliers')}>
            <Truck className="h-4 w-4 mr-1" /> Suppliers
          </Button>
          <Button variant="outline" size="sm" onClick={() => scoreProducts.mutate()}
            disabled={scoreProducts.isPending}>
            <RefreshCw className={`h-4 w-4 mr-1 ${scoreProducts.isPending ? 'animate-spin' : ''}`} />
            Score All
          </Button>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Product</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>New Product</DialogTitle></DialogHeader>
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                <div>
                  <Label>Name *</Label>
                  <Input value={newProduct.name} onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Type *</Label>
                    <Select value={newProduct.product_type} onValueChange={v => setNewProduct(p => ({ ...p, product_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gift">Gift Idea</SelectItem>
                        <SelectItem value="business_asset">Business Asset</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Category *</Label>
                    <Input value={newProduct.category} onChange={e => setNewProduct(p => ({ ...p, category: e.target.value }))}
                      placeholder="e.g. balloon_kit" />
                  </div>
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={newProduct.description} onChange={e => setNewProduct(p => ({ ...p, description: e.target.value }))} rows={2} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Cost $</Label><Input type="number" value={newProduct.cost_price} onChange={e => setNewProduct(p => ({ ...p, cost_price: e.target.value }))} /></div>
                  <div><Label>Landed $</Label><Input type="number" value={newProduct.landed_cost} onChange={e => setNewProduct(p => ({ ...p, landed_cost: e.target.value }))} /></div>
                  <div><Label>Sell $</Label><Input type="number" value={newProduct.sell_price} onChange={e => setNewProduct(p => ({ ...p, sell_price: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Fulfillment</Label>
                    <Select value={newProduct.fulfillment_model} onValueChange={v => setNewProduct(p => ({ ...p, fulfillment_model: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dropship">Dropship</SelectItem>
                        <SelectItem value="warehouse">Warehouse</SelectItem>
                        <SelectItem value="on_demand">On Demand</SelectItem>
                        <SelectItem value="hybrid">Hybrid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Ship Days</Label><Input type="number" value={newProduct.shipping_speed_days} onChange={e => setNewProduct(p => ({ ...p, shipping_speed_days: e.target.value }))} /></div>
                </div>
                {newProduct.product_type === 'business_asset' && (
                  <div>
                    <Label>Rental Price Estimate (per event)</Label>
                    <Input type="number" value={newProduct.rental_price_estimate} onChange={e => setNewProduct(p => ({ ...p, rental_price_estimate: e.target.value }))} />
                  </div>
                )}
                <div>
                  <Label>Supplier</Label>
                  <Select value={newProduct.supplier_id} onValueChange={v => setNewProduct(p => ({ ...p, supplier_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Tags (comma-separated)</Label><Input value={newProduct.tags} onChange={e => setNewProduct(p => ({ ...p, tags: e.target.value }))} /></div>
                <Button className="w-full" onClick={handleCreate} disabled={createProduct.isPending}>Create Product</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-card border-border/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{products.length}</p>
            <p className="text-xs text-muted-foreground">Total Products</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-pink-400">{giftCount}</p>
            <p className="text-xs text-muted-foreground">Gift Ideas</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">{assetCount}</p>
            <p className="text-xs text-muted-foreground">Business Assets</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{trendingCount}</p>
            <p className="text-xs text-muted-foreground">Trending</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={recFilter} onValueChange={v => setRecFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="AI Score" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Scores</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs + Product Grid */}
      <Tabs value={typeFilter} onValueChange={setTypeFilter}>
        <TabsList>
          {PRODUCT_TYPE_TABS.map(t => (
            <TabsTrigger key={t.value} value={t.value} className="gap-1">
              <t.icon className="h-4 w-4" /> {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-4">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading products...</div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>No products yet. Add your first product above.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((p: any) => (
                <Card key={p.id} className="bg-card border-border/50 hover:border-primary/30 transition-colors cursor-pointer"
                  onClick={() => setSelectedProduct(p)}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{p.name}</h3>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge variant="outline" className="text-[10px]">
                            {p.product_type === 'gift' ? '🎁 Gift' : '🔧 Asset'}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">{p.category}</Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">{p.overall_score ?? 0}</div>
                        <Badge className={`text-[10px] ${REC_COLORS[p.recommendation_level] || REC_COLORS.low}`}>
                          {p.recommendation_level || 'unscored'}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Sell</span>
                        <p className="font-semibold">${Number(p.sell_price || 0).toFixed(0)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Margin</span>
                        <p className="font-semibold">{Number(p.margin_pct || 0).toFixed(0)}%</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Ship</span>
                        <p className="font-semibold">{p.shipping_speed_days ? `${p.shipping_speed_days}d` : '—'}</p>
                      </div>
                    </div>

                    {p.product_type === 'business_asset' && p.events_to_break_even && (
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded p-2 text-xs">
                        <div className="flex justify-between">
                          <span>Break-even</span>
                          <span className="font-bold text-blue-400">{p.events_to_break_even} events</span>
                        </div>
                        {p.monthly_income_estimate && (
                          <div className="flex justify-between mt-1">
                            <span>Est. Monthly</span>
                            <span className="font-bold text-emerald-400">${Number(p.monthly_income_estimate).toFixed(0)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{p.fulfillment_model}</span>
                      {p.supplier_name && <span>via {p.supplier_name}</span>}
                      {p.is_trending && <Badge className="bg-orange-500/20 text-orange-400 text-[10px]">🔥 Trending</Badge>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </Tabs>

      {/* Detail Panel */}
      {selectedProduct && (
        <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{selectedProduct.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Badge>{selectedProduct.product_type === 'gift' ? '🎁 Gift' : '🔧 Business Asset'}</Badge>
                <Badge variant="outline">{selectedProduct.category}</Badge>
                <Badge className={REC_COLORS[selectedProduct.recommendation_level] || ''}>{selectedProduct.recommendation_level}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Cost:</span> ${Number(selectedProduct.cost_price || selectedProduct.landed_cost || 0).toFixed(2)}</div>
                <div><span className="text-muted-foreground">Sell:</span> ${Number(selectedProduct.sell_price || 0).toFixed(2)}</div>
                <div><span className="text-muted-foreground">Margin:</span> {Number(selectedProduct.margin_pct || 0).toFixed(1)}%</div>
                <div><span className="text-muted-foreground">Ship:</span> {selectedProduct.shipping_speed_days || '—'} days</div>
                <div><span className="text-muted-foreground">Fulfillment:</span> {selectedProduct.fulfillment_model}</div>
                <div><span className="text-muted-foreground">Supplier:</span> {selectedProduct.supplier_name || '—'}</div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">AI Scores</h4>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {[
                    { label: 'Overall', val: selectedProduct.overall_score },
                    { label: 'Trend', val: selectedProduct.trend_score },
                    { label: 'Conversion', val: selectedProduct.conversion_score },
                    { label: 'Visual', val: selectedProduct.visual_appeal_score },
                    { label: 'Event Fit', val: selectedProduct.event_relevance_score },
                    { label: 'Gift Fit', val: selectedProduct.gift_relevance_score },
                  ].map(s => (
                    <div key={s.label} className="bg-muted/50 rounded p-2 text-center">
                      <p className="font-bold">{Number(s.val || 0).toFixed(1)}</p>
                      <p className="text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {selectedProduct.product_type === 'business_asset' && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded p-3">
                  <h4 className="text-sm font-semibold text-blue-400 mb-2">ROI Analysis</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Rental/Event: <strong>${Number(selectedProduct.rental_price_estimate || 0).toFixed(0)}</strong></div>
                    <div>Break-even: <strong>{selectedProduct.events_to_break_even || '—'} events</strong></div>
                    <div>Monthly Est: <strong>${Number(selectedProduct.monthly_income_estimate || 0).toFixed(0)}</strong></div>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
