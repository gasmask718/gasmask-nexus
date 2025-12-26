/**
 * TopTier Customers List - Full customer database for TopTier
 */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ArrowLeft, Search, Eye, Plus, Users, DollarSign, 
  MapPin, Star, Crown, UserPlus, TrendingUp, Calendar
} from 'lucide-react';
import { US_STATES } from '@/config/crmBlueprints';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { useCRMSimulation } from '@/hooks/useCRMSimulation';
import { useResolvedData } from '@/hooks/useResolvedData';
import { CommunicationActions } from '@/components/crm/toptier/CommunicationActions';
import { format } from 'date-fns';

// Generate simulated customers
const generateSimulatedCustomers = () => {
  const names = [
    'Marcus Johnson', 'Sophia Williams', 'David Chen', 'Ashley Rodriguez',
    'Michael Davis', 'Jennifer Martinez', 'Christopher Brown', 'Amanda Taylor',
    'James Wilson', 'Sarah Thompson', 'Robert Garcia', 'Emily Anderson',
    'William Miller', 'Jessica Thomas', 'Daniel Jackson', 'Lauren White'
  ];
  
  const states = ['FL', 'CA', 'NY', 'TX', 'GA', 'NV', 'AZ', 'IL'];
  const cities: Record<string, string[]> = {
    FL: ['Miami', 'Orlando', 'Tampa', 'Fort Lauderdale'],
    CA: ['Los Angeles', 'San Diego', 'San Francisco', 'Hollywood'],
    NY: ['New York', 'Brooklyn', 'Manhattan', 'Queens'],
    TX: ['Houston', 'Dallas', 'Austin', 'San Antonio'],
    GA: ['Atlanta', 'Savannah', 'Augusta'],
    NV: ['Las Vegas', 'Reno', 'Henderson'],
    AZ: ['Phoenix', 'Scottsdale', 'Tucson'],
    IL: ['Chicago', 'Naperville', 'Aurora'],
  };

  return names.map((name, i) => {
    const state = states[i % states.length];
    const bookingCount = Math.floor(Math.random() * 10) + 1;
    const avgSpend = Math.floor(Math.random() * 15000) + 2000;
    const totalSpend = bookingCount * avgSpend;
    
    let customerType: 'new' | 'returning' | 'vip';
    if (bookingCount >= 5 || totalSpend >= 50000) {
      customerType = 'vip';
    } else if (bookingCount >= 2) {
      customerType = 'returning';
    } else {
      customerType = 'new';
    }
    
    return {
      id: `cust_${i + 1}`,
      name,
      email: `${name.toLowerCase().replace(' ', '.')}@email.com`,
      phone: `+1 ${Math.floor(Math.random() * 900 + 100)}-${Math.floor(Math.random() * 900 + 100)}-${Math.floor(Math.random() * 9000 + 1000)}`,
      primary_state: state,
      cities: cities[state]?.slice(0, Math.floor(Math.random() * 2) + 1) || [],
      preferred_categories: ['exotic_rental_car_promo', 'yachts', 'club_lounge_package'].slice(0, Math.floor(Math.random() * 3) + 1),
      total_bookings: bookingCount,
      lifetime_spend: totalSpend,
      customer_type: customerType,
      last_booking_date: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
    };
  });
};

export default function TopTierCustomers() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const { simulationMode } = useSimulationMode();
  const { getEntityData } = useCRMSimulation('toptier-experience');
  
  // Use simulated customers
  const simulatedCustomers = useMemo(() => generateSimulatedCustomers(), []);
  const { data: customers, isSimulated } = useResolvedData([], simulatedCustomers);

  // Filter customers
  const filteredCustomers = useMemo(() => {
    return customers.filter((customer: any) => {
      const matchesSearch = searchTerm === '' ||
        customer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.email?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesState = stateFilter === 'all' || customer.primary_state === stateFilter;
      const matchesType = typeFilter === 'all' || customer.customer_type === typeFilter;
      return matchesSearch && matchesState && matchesType;
    }).sort((a: any, b: any) => b.lifetime_spend - a.lifetime_spend);
  }, [customers, searchTerm, stateFilter, typeFilter]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = customers.length;
    const vip = customers.filter((c: any) => c.customer_type === 'vip').length;
    const returning = customers.filter((c: any) => c.customer_type === 'returning').length;
    const newCustomers = customers.filter((c: any) => c.customer_type === 'new').length;
    const totalSpend = customers.reduce((sum: number, c: any) => sum + (c.lifetime_spend || 0), 0);
    const totalBookings = customers.reduce((sum: number, c: any) => sum + (c.total_bookings || 0), 0);
    
    return { total, vip, returning, newCustomers, totalSpend, totalBookings };
  }, [customers]);

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'vip':
        return <Badge className="bg-purple-500/10 text-purple-500"><Crown className="h-3 w-3 mr-1" />VIP</Badge>;
      case 'returning':
        return <Badge className="bg-blue-500/10 text-blue-500"><TrendingUp className="h-3 w-3 mr-1" />Returning</Badge>;
      case 'new':
        return <Badge className="bg-green-500/10 text-green-500"><UserPlus className="h-3 w-3 mr-1" />New</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
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
              <h1 className="text-2xl font-bold">Customer Database</h1>
              {isSimulated && <SimulationBadge />}
            </div>
            <p className="text-muted-foreground">Track customers, bookings, and lifetime value</p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={() => {
                console.log('[CRM] Add New Customer button mounted', { 
                  currentRoute: window.location.pathname,
                  targetRoute: '/crm/toptier-experience/customers/new'
                });
                navigate('/crm/toptier-experience/customers/new');
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add New Customer
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Customers</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Users className="h-8 w-8 text-cyan-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">VIP Customers</p>
                <p className="text-2xl font-bold">{stats.vip}</p>
              </div>
              <Crown className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Returning</p>
                <p className="text-2xl font-bold">{stats.returning}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">New</p>
                <p className="text-2xl font-bold">{stats.newCustomers}</p>
              </div>
              <UserPlus className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Bookings</p>
                <p className="text-2xl font-bold">{stats.totalBookings}</p>
              </div>
              <Calendar className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Lifetime Value</p>
                <p className="text-2xl font-bold">${(stats.totalSpend / 1000).toFixed(0)}k</p>
              </div>
              <DollarSign className="h-8 w-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={stateFilter} onValueChange={setStateFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="State" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            {US_STATES.map(state => (
              <SelectItem key={state.value} value={state.value}>{state.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="vip">VIP</SelectItem>
            <SelectItem value="returning">Returning</SelectItem>
            <SelectItem value="new">New</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Customers Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Customers ({filteredCustomers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="mx-auto h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center mb-6">
                <Users className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No customers found</h3>
              <p className="text-sm max-w-md mx-auto mb-6">
                {searchTerm || stateFilter !== 'all' || typeFilter !== 'all'
                  ? 'Try adjusting your filters or search term'
                  : 'Start building your customer database by adding your first customer'}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button 
                  onClick={() => {
                    console.log('[CRM] Add New Customer button (empty state) clicked');
                    navigate('/crm/toptier-experience/customers/new');
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Customer
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => navigate('/crm/toptier-experience/bookings')}
                >
                  Create Booking
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Customer</th>
                    <th className="text-left py-3 px-4 font-medium">State</th>
                    <th className="text-left py-3 px-4 font-medium">Cities</th>
                    <th className="text-right py-3 px-4 font-medium">Bookings</th>
                    <th className="text-right py-3 px-4 font-medium">Lifetime Spend</th>
                    <th className="text-left py-3 px-4 font-medium">Last Booking</th>
                    <th className="text-left py-3 px-4 font-medium">Type</th>
                    <th className="text-right py-3 px-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((customer: any) => (
                    <tr 
                      key={customer.id} 
                      className="border-b hover:bg-muted/50 cursor-pointer"
                      onClick={() => navigate(`/crm/toptier-experience/customers/${customer.id}`)}
                    >
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium">{customer.name}</p>
                          <p className="text-sm text-muted-foreground">{customer.email}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {customer.primary_state}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {customer.cities?.slice(0, 2).map((city: string) => (
                            <Badge key={city} variant="outline" className="text-xs">
                              {city}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-medium">
                        {customer.total_bookings}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-green-600">
                        ${customer.lifetime_spend?.toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        {customer.last_booking_date && format(new Date(customer.last_booking_date), 'MMM d, yyyy')}
                      </td>
                      <td className="py-3 px-4">
                        {getTypeBadge(customer.customer_type)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <CommunicationActions
                            contact={{
                              id: customer.id,
                              name: customer.name,
                              phone: customer.phone,
                              email: customer.email,
                            }}
                            entityType="customer"
                            size="icon"
                          />
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/crm/toptier-experience/customers/${customer.id}`);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
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
