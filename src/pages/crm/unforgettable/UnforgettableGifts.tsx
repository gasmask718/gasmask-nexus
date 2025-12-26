import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Gift, ExternalLink, Phone, Mail, Plus, Search, ArrowRight, DollarSign, Tag, Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';

interface GiftIdea {
  id: string;
  name: string;
  supplier: string;
  productUrl: string;
  category: string;
  priceRange: string;
  fulfillmentType: 'dropship' | 'wholesale' | 'affiliate';
  promoEligible: boolean;
  status: 'active' | 'out_of_stock' | 'discontinued';
  description: string;
  margin: number;
  ordersReferred: number;
}

const SIMULATED_GIFTS: GiftIdea[] = [
  { id: 'gift-001', name: 'Personalized Photo Frame Set', supplier: 'CustomGifts Co', productUrl: 'https://example.com/photo-frames', category: 'Photo & Memories', priceRange: '$25 - $50', fulfillmentType: 'dropship', promoEligible: true, status: 'active', description: 'Beautiful custom engraved photo frames, perfect for event guests', margin: 35, ordersReferred: 89 },
  { id: 'gift-002', name: 'Luxury Candle Gift Set', supplier: 'AromaLux', productUrl: 'https://example.com/candles', category: 'Home & Decor', priceRange: '$40 - $80', fulfillmentType: 'dropship', promoEligible: true, status: 'active', description: 'Premium scented candles in elegant gift packaging', margin: 40, ordersReferred: 156 },
  { id: 'gift-003', name: 'Custom Wine Label Package', supplier: 'WineLabel Pro', productUrl: 'https://example.com/wine-labels', category: 'Beverages', priceRange: '$15 - $30', fulfillmentType: 'affiliate', promoEligible: true, status: 'active', description: 'Personalized wine labels for event celebrations', margin: 25, ordersReferred: 234 },
  { id: 'gift-004', name: 'Party Favor Bags Bundle', supplier: 'Oriental Trading', productUrl: 'https://example.com/favor-bags', category: 'Party Favors', priceRange: '$10 - $25', fulfillmentType: 'wholesale', promoEligible: false, status: 'active', description: 'Bulk party favor bags with customization options', margin: 45, ordersReferred: 312 },
  { id: 'gift-005', name: 'Personalized Champagne Glasses', supplier: 'Etched Elegance', productUrl: 'https://example.com/glasses', category: 'Drinkware', priceRange: '$35 - $75', fulfillmentType: 'dropship', promoEligible: true, status: 'active', description: 'Engraved champagne flutes for weddings and celebrations', margin: 38, ordersReferred: 67 },
  { id: 'gift-006', name: 'Kids Party Goodie Box', supplier: 'Kids Joy Wholesale', productUrl: 'https://example.com/goodie-box', category: 'Kids', priceRange: '$8 - $20', fulfillmentType: 'wholesale', promoEligible: true, status: 'active', description: 'Pre-assembled goodie boxes for children\'s parties', margin: 50, ordersReferred: 178 },
  { id: 'gift-007', name: 'Spa Gift Basket', supplier: 'RelaxWell Co', productUrl: 'https://example.com/spa-basket', category: 'Wellness', priceRange: '$50 - $120', fulfillmentType: 'dropship', promoEligible: true, status: 'out_of_stock', description: 'Luxury spa essentials basket for VIP guests', margin: 30, ordersReferred: 45 },
  { id: 'gift-008', name: 'Custom Event T-Shirts', supplier: 'PrintPro USA', productUrl: 'https://example.com/tshirts', category: 'Apparel', priceRange: '$12 - $25', fulfillmentType: 'affiliate', promoEligible: false, status: 'active', description: 'Custom printed event t-shirts with fast turnaround', margin: 28, ordersReferred: 423 },
];

const CATEGORIES = ['All', 'Photo & Memories', 'Home & Decor', 'Beverages', 'Party Favors', 'Drinkware', 'Kids', 'Wellness', 'Apparel'];

export default function UnforgettableGifts() {
  const navigate = useNavigate();
  const { simulationMode } = useSimulationMode();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [fulfillmentFilter, setFulfillmentFilter] = useState('all');

  const gifts = simulationMode ? SIMULATED_GIFTS : [];

  const filteredGifts = gifts.filter(gift => {
    const matchesSearch = gift.name.toLowerCase().includes(searchQuery.toLowerCase()) || gift.supplier.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || gift.category === categoryFilter;
    const matchesFulfillment = fulfillmentFilter === 'all' || gift.fulfillmentType === fulfillmentFilter;
    return matchesSearch && matchesCategory && matchesFulfillment;
  });

  const stats = {
    total: gifts.length,
    promoEligible: gifts.filter(g => g.promoEligible).length,
    totalReferred: gifts.reduce((sum, g) => sum + g.ordersReferred, 0),
    avgMargin: Math.round(gifts.reduce((sum, g) => sum + g.margin, 0) / gifts.length) || 0
  };

  const fulfillmentConfig = {
    dropship: { label: 'Dropship', color: 'bg-blue-500/20 text-blue-400' },
    wholesale: { label: 'Wholesale', color: 'bg-green-500/20 text-green-400' },
    affiliate: { label: 'Affiliate', color: 'bg-purple-500/20 text-purple-400' }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Gift className="h-8 w-8 text-primary" />
            Gift Ideas
            {simulationMode && <SimulationBadge />}
          </h1>
          <p className="text-muted-foreground">Dropshipping gifts and free promo upsells</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/crm/unforgettable_times_usa')}>← Back to CRM</Button>
          <Button><Plus className="h-4 w-4 mr-2" />Add Gift Idea</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Products</p><p className="text-2xl font-bold">{stats.total}</p></CardContent></Card>
        <Card className="border-green-500/30"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Promo Eligible</p><p className="text-2xl font-bold text-green-400">{stats.promoEligible}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Orders Referred</p><p className="text-2xl font-bold">{stats.totalReferred}</p></CardContent></Card>
        <Card className="border-yellow-500/30"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Avg Margin</p><p className="text-2xl font-bold text-yellow-400">{stats.avgMargin}%</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search gifts..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={fulfillmentFilter} onValueChange={setFulfillmentFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Fulfillment" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="dropship">Dropship</SelectItem>
                <SelectItem value="wholesale">Wholesale</SelectItem>
                <SelectItem value="affiliate">Affiliate</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredGifts.map(gift => (
          <Card key={gift.id} className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate(`/crm/unforgettable_times_usa/gifts/${gift.id}`)}>
            <CardContent className="p-4">
              <div className="aspect-square bg-muted rounded-lg flex items-center justify-center mb-3">
                <Gift className="h-12 w-12 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-sm line-clamp-2 mb-1">{gift.name}</h3>
              <p className="text-xs text-muted-foreground mb-2">{gift.supplier}</p>
              <div className="flex items-center justify-between mb-2">
                <Badge variant="outline" className="text-xs">{gift.category}</Badge>
                <Badge className={`text-xs ${fulfillmentConfig[gift.fulfillmentType].color}`}>{fulfillmentConfig[gift.fulfillmentType].label}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{gift.priceRange}</div>
                <div className="flex items-center gap-1"><Tag className="h-3 w-3" />{gift.margin}% margin</div>
              </div>
              <div className="flex items-center justify-between">
                {gift.promoEligible ? <Badge className="text-xs bg-green-500/20 text-green-400">Promo</Badge> : <span />}
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); window.open(gift.productUrl, '_blank'); }}>
                  <ExternalLink className="h-3 w-3 mr-1" />View
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredGifts.length === 0 && (
        <Card><CardContent className="p-12 text-center">
          <Gift className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium">No Gift Ideas Found</h3>
          <p className="text-muted-foreground">{simulationMode ? 'No gifts match your filters' : 'Enable Simulation Mode to see demo data'}</p>
        </CardContent></Card>
      )}
    </div>
  );
}
