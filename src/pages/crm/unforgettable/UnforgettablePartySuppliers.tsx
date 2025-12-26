import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, MapPin, Phone, Mail, Plus, Search, ArrowRight, DollarSign, ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';

const US_STATES = ['All States', 'California', 'Florida', 'Georgia', 'Illinois', 'New York', 'Texas', 'Nevada'];

interface Supplier {
  id: string;
  name: string;
  statesServed: string[];
  city: string;
  primaryState: string;
  productCategories: string[];
  priceRange: string;
  minOrder: number;
  partnerStatus: 'active' | 'pending' | 'inactive';
  phone: string;
  email: string;
  ordersPlaced: number;
  totalSpent: number;
}

const SIMULATED_SUPPLIERS: Supplier[] = [
  { id: 'sup-001', name: 'Party City Wholesale', statesServed: ['Florida', 'Georgia', 'Alabama'], city: 'Miami', primaryState: 'Florida', productCategories: ['Balloons', 'Decorations', 'Tableware', 'Party Favors'], priceRange: 'Budget-Friendly', minOrder: 100, partnerStatus: 'active', phone: '+1 (305) 555-0101', email: 'wholesale@partycity.com', ordersPlaced: 45, totalSpent: 12500 },
  { id: 'sup-002', name: 'Oriental Trading Co', statesServed: ['Nationwide'], city: 'Omaha', primaryState: 'Nebraska', productCategories: ['Bulk Party Supplies', 'Toys', 'Novelties', 'Costumes'], priceRange: 'Budget-Friendly', minOrder: 50, partnerStatus: 'active', phone: '+1 (800) 555-0202', email: 'business@orientaltrading.com', ordersPlaced: 78, totalSpent: 28000 },
  { id: 'sup-003', name: 'Elegant Events Supply', statesServed: ['New York', 'New Jersey', 'Connecticut'], city: 'New York', primaryState: 'New York', productCategories: ['Premium Tableware', 'Linens', 'Centerpieces', 'Candles'], priceRange: 'Premium', minOrder: 500, partnerStatus: 'active', phone: '+1 (212) 555-0303', email: 'orders@elegantevents.com', ordersPlaced: 23, totalSpent: 18500 },
  { id: 'sup-004', name: 'Fiesta Wholesale TX', statesServed: ['Texas', 'Oklahoma', 'New Mexico'], city: 'Houston', primaryState: 'Texas', productCategories: ['Piñatas', 'Mexican Party Supplies', 'Quinceañera Items', 'Decorations'], priceRange: 'Mid-Range', minOrder: 200, partnerStatus: 'active', phone: '+1 (713) 555-0404', email: 'ventas@fiestawholesale.com', ordersPlaced: 56, totalSpent: 15800 },
  { id: 'sup-005', name: 'LA Party Depot', statesServed: ['California', 'Arizona', 'Nevada'], city: 'Los Angeles', primaryState: 'California', productCategories: ['Hollywood Props', 'Red Carpet Items', 'VIP Supplies', 'Photo Booth Props'], priceRange: 'Premium', minOrder: 300, partnerStatus: 'pending', phone: '+1 (213) 555-0505', email: 'bulk@lapartydepot.com', ordersPlaced: 0, totalSpent: 0 },
  { id: 'sup-006', name: 'Kids Party Wholesale', statesServed: ['Illinois', 'Indiana', 'Wisconsin', 'Michigan'], city: 'Chicago', primaryState: 'Illinois', productCategories: ['Character Supplies', 'Bounce House Accessories', 'Games', 'Prizes'], priceRange: 'Budget-Friendly', minOrder: 75, partnerStatus: 'active', phone: '+1 (312) 555-0606', email: 'orders@kidsparty.com', ordersPlaced: 34, totalSpent: 8900 },
];

export default function UnforgettablePartySuppliers() {
  const navigate = useNavigate();
  const { simulationMode } = useSimulationMode();
  const [searchQuery, setSearchQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('All States');
  const [statusFilter, setStatusFilter] = useState('all');

  const suppliers = simulationMode ? SIMULATED_SUPPLIERS : [];

  const filteredSuppliers = suppliers.filter(sup => {
    const matchesSearch = sup.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesState = stateFilter === 'All States' || sup.statesServed.includes(stateFilter) || sup.statesServed.includes('Nationwide');
    const matchesStatus = statusFilter === 'all' || sup.partnerStatus === statusFilter;
    return matchesSearch && matchesState && matchesStatus;
  });

  const stats = {
    total: suppliers.length,
    active: suppliers.filter(s => s.partnerStatus === 'active').length,
    totalOrders: suppliers.reduce((sum, s) => sum + s.ordersPlaced, 0),
    totalSpent: suppliers.reduce((sum, s) => sum + s.totalSpent, 0)
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Package className="h-8 w-8 text-primary" />
            Party Supplies Suppliers
            {simulationMode && <SimulationBadge />}
          </h1>
          <p className="text-muted-foreground">Wholesale party supply partners</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/crm/unforgettable_times_usa')}>← Back to CRM</Button>
          <Button><Plus className="h-4 w-4 mr-2" />Add Supplier</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Suppliers</p><p className="text-2xl font-bold">{stats.total}</p></CardContent></Card>
        <Card className="border-green-500/30"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Active</p><p className="text-2xl font-bold text-green-400">{stats.active}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Orders Placed</p><p className="text-2xl font-bold">{stats.totalOrders}</p></CardContent></Card>
        <Card className="border-yellow-500/30"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Spent</p><p className="text-2xl font-bold text-yellow-400">${stats.totalSpent.toLocaleString()}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search suppliers..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>{US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSuppliers.map(sup => (
          <Card key={sup.id} className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate(`/crm/unforgettable_times_usa/party-suppliers/${sup.id}`)}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg">{sup.name}</CardTitle>
                <Badge variant={sup.partnerStatus === 'active' ? 'default' : 'secondary'}>{sup.partnerStatus}</Badge>
              </div>
              <CardDescription className="flex items-center gap-1"><MapPin className="h-3 w-3" />{sup.city}, {sup.primaryState}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1">
                {sup.productCategories.slice(0, 3).map(cat => <Badge key={cat} variant="outline" className="text-xs">{cat}</Badge>)}
                {sup.productCategories.length > 3 && <Badge variant="outline" className="text-xs">+{sup.productCategories.length - 3}</Badge>}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-1"><ShoppingCart className="h-3 w-3" />{sup.ordersPlaced} orders</div>
                <div className="flex items-center gap-1"><DollarSign className="h-3 w-3 text-green-400" />${sup.totalSpent.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Min: ${sup.minOrder}</div>
                <div className="text-xs text-muted-foreground">{sup.priceRange}</div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1"><Phone className="h-3 w-3 mr-1" />Call</Button>
                <Button variant="outline" size="sm" className="flex-1"><Mail className="h-3 w-3 mr-1" />Email</Button>
                <Button size="sm"><ArrowRight className="h-3 w-3" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredSuppliers.length === 0 && (
        <Card><CardContent className="p-12 text-center">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium">No Suppliers Found</h3>
          <p className="text-muted-foreground">{simulationMode ? 'No suppliers match your filters' : 'Enable Simulation Mode to see demo data'}</p>
        </CardContent></Card>
      )}
    </div>
  );
}
