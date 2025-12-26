/**
 * TopTier Deals List - All bookings/deals for TopTier
 */
import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ArrowLeft, Search, Eye, Plus, Calendar, DollarSign, 
  MapPin, Users, Building2, Filter
} from 'lucide-react';
import { US_STATES, TOPTIER_PARTNER_CATEGORIES } from '@/config/crmBlueprints';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { format } from 'date-fns';

// Generate simulated deals
const generateSimulatedDeals = () => {
  const customers = ['Marcus Johnson', 'Sophia Williams', 'David Chen', 'Ashley Rodriguez', 'Michael Davis'];
  const partners = ['Miami Luxury Cars', 'LA Yacht Club', 'Vegas Helicopter Tours', 'NYC Event Space', 'Atlanta Security'];
  const categories = ['exotic_rental_car_promo', 'yachts', 'helicopter_promo', 'eventspaces_rooftop', 'security_promo'];
  const states = ['FL', 'CA', 'NV', 'NY', 'GA'];
  const cities = ['Miami', 'Los Angeles', 'Las Vegas', 'New York', 'Atlanta'];
  const statuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];

  return Array.from({ length: 20 }, (_, i) => ({
    id: `deal_${i + 1}`,
    customer_name: customers[i % customers.length],
    customer_id: `cust_${(i % customers.length) + 1}`,
    partner_name: partners[i % partners.length],
    partner_id: `partner_${(i % partners.length) + 1}`,
    category: categories[i % categories.length],
    state: states[i % states.length],
    city: cities[i % cities.length],
    event_date: new Date(Date.now() + (i - 10) * 24 * 60 * 60 * 1000).toISOString(),
    booking_value: Math.floor(Math.random() * 15000) + 2000,
    commission: Math.floor(Math.random() * 2000) + 200,
    status: statuses[i % statuses.length],
    created_at: new Date(Date.now() - i * 2 * 24 * 60 * 60 * 1000).toISOString(),
  }));
};

export default function TopTierDeals() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState<string>(searchParams.get('state') || 'all');
  const [categoryFilter, setCategoryFilter] = useState<string>(searchParams.get('category') || 'all');
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'all');
  const [partnerFilter] = useState<string>(searchParams.get('partner') || 'all');
  const [customerFilter] = useState<string>(searchParams.get('customer') || 'all');

  const { simulationMode } = useSimulationMode();
  const deals = useMemo(() => generateSimulatedDeals(), []);
  const isSimulated = simulationMode;

  // Filter deals
  const filteredDeals = useMemo(() => {
    return deals.filter((deal) => {
      const matchesSearch = searchTerm === '' ||
        deal.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        deal.partner_name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesState = stateFilter === 'all' || deal.state === stateFilter;
      const matchesCategory = categoryFilter === 'all' || deal.category === categoryFilter;
      const matchesStatus = statusFilter === 'all' || deal.status === statusFilter;
      const matchesPartner = partnerFilter === 'all' || deal.partner_id === partnerFilter;
      const matchesCustomer = customerFilter === 'all' || deal.customer_id === customerFilter;
      return matchesSearch && matchesState && matchesCategory && matchesStatus && matchesPartner && matchesCustomer;
    }).sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());
  }, [deals, searchTerm, stateFilter, categoryFilter, statusFilter, partnerFilter, customerFilter]);

  // Stats
  const stats = useMemo(() => ({
    total: filteredDeals.length,
    pending: filteredDeals.filter(d => d.status === 'pending').length,
    confirmed: filteredDeals.filter(d => d.status === 'confirmed').length,
    completed: filteredDeals.filter(d => d.status === 'completed').length,
    totalValue: filteredDeals.reduce((sum, d) => sum + d.booking_value, 0),
    totalCommission: filteredDeals.reduce((sum, d) => sum + d.commission, 0),
  }), [filteredDeals]);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-500/10 text-yellow-600',
      confirmed: 'bg-blue-500/10 text-blue-600',
      in_progress: 'bg-purple-500/10 text-purple-600',
      completed: 'bg-green-500/10 text-green-600',
      cancelled: 'bg-red-500/10 text-red-600',
    };
    return <Badge className={styles[status] || 'bg-muted'}>{status.replace('_', ' ')}</Badge>;
  };

  const getCategoryLabel = (value: string) => {
    return TOPTIER_PARTNER_CATEGORIES.find(c => c.value === value)?.label || value;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-fit"
          onClick={() => navigate('/crm/toptier-experience/partners')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">Deals & Bookings</h1>
              {isSimulated && <SimulationBadge />}
            </div>
            <p className="text-muted-foreground">Manage all TopTier experience bookings</p>
          </div>
          <Button onClick={() => navigate('/crm/toptier-experience/deals/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Create Deal
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total Deals</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Confirmed</p>
            <p className="text-2xl font-bold text-blue-600">{stats.confirmed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Completed</p>
            <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total Value</p>
            <p className="text-2xl font-bold">${(stats.totalValue / 1000).toFixed(0)}k</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Commission</p>
            <p className="text-2xl font-bold text-emerald-600">${(stats.totalCommission / 1000).toFixed(1)}k</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by customer or partner..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={stateFilter} onValueChange={setStateFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="State" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            {US_STATES.map(state => (
              <SelectItem key={state.value} value={state.value}>{state.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {TOPTIER_PARTNER_CATEGORIES.map(cat => (
              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Deals Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Deals ({filteredDeals.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredDeals.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No deals found</h3>
              <p className="text-muted-foreground mb-4">Create your first deal to get started</p>
              <Button onClick={() => navigate('/crm/toptier-experience/deals/new')}>
                <Plus className="h-4 w-4 mr-2" />
                Create Deal
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Customer</th>
                    <th className="text-left py-3 px-4 font-medium">Partner</th>
                    <th className="text-left py-3 px-4 font-medium">Category</th>
                    <th className="text-left py-3 px-4 font-medium">Location</th>
                    <th className="text-left py-3 px-4 font-medium">Event Date</th>
                    <th className="text-right py-3 px-4 font-medium">Value</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                    <th className="text-right py-3 px-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDeals.map((deal) => (
                    <tr 
                      key={deal.id} 
                      className="border-b hover:bg-muted/50 cursor-pointer"
                      onClick={() => navigate(`/crm/toptier-experience/deals/${deal.id}`)}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span 
                            className="text-primary hover:underline cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/crm/toptier-experience/customers/${deal.customer_id}`);
                            }}
                          >
                            {deal.customer_name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span 
                            className="text-primary hover:underline cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/crm/toptier-experience/partners/profile/${deal.partner_id}`);
                            }}
                          >
                            {deal.partner_name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-xs">
                          {getCategoryLabel(deal.category)}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {deal.city}, {deal.state}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {format(new Date(deal.event_date), 'MMM d, yyyy')}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-green-600">
                        ${deal.booking_value.toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(deal.status)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/crm/toptier-experience/deals/${deal.id}`);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
