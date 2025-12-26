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
  MapPin, Star, Crown, UserPlus, TrendingUp, Calendar,
  Instagram, ExternalLink, Cake
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
    
    // Generate random DOB (ages 25-55)
    const birthYear = 1970 + Math.floor(Math.random() * 30);
    const birthMonth = Math.floor(Math.random() * 12) + 1;
    const birthDay = Math.floor(Math.random() * 28) + 1;
    const dob = `${birthYear}-${String(birthMonth).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`;
    
    // Generate random social media handles
    const socialHandles = {
      instagram: Math.random() > 0.3 ? `@${name.toLowerCase().replace(' ', '')}` : '',
      tiktok: Math.random() > 0.5 ? `@${name.toLowerCase().replace(' ', '_')}` : '',
      twitter: Math.random() > 0.6 ? `@${name.toLowerCase().replace(' ', '')}` : '',
      facebook: Math.random() > 0.4 ? `https://facebook.com/${name.toLowerCase().replace(' ', '.')}` : '',
    };
    
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
      dob,
      social_instagram: socialHandles.instagram,
      social_tiktok: socialHandles.tiktok,
      social_twitter: socialHandles.twitter,
      social_facebook: socialHandles.facebook,
      has_social: Object.values(socialHandles).some(h => h),
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
  const [hasSocialFilter, setHasSocialFilter] = useState<string>('all');
  const [ageRangeFilter, setAgeRangeFilter] = useState<string>('all');

  // Helper to calculate age from DOB
  const calculateAge = (dob: string) => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Helper to get social URL
  const getSocialUrl = (platform: string, handle: string) => {
    if (!handle) return '';
    if (handle.startsWith('http')) return handle;
    const cleanHandle = handle.replace('@', '');
    switch (platform) {
      case 'instagram': return `https://instagram.com/${cleanHandle}`;
      case 'tiktok': return `https://tiktok.com/@${cleanHandle}`;
      default: return handle;
    }
  };

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
      const matchesSocial = hasSocialFilter === 'all' || 
        (hasSocialFilter === 'yes' && customer.has_social) ||
        (hasSocialFilter === 'no' && !customer.has_social);
      
      // Age range filter
      let matchesAge = true;
      if (ageRangeFilter !== 'all') {
        const age = calculateAge(customer.dob);
        if (age !== null) {
          switch (ageRangeFilter) {
            case '18-25': matchesAge = age >= 18 && age <= 25; break;
            case '26-35': matchesAge = age >= 26 && age <= 35; break;
            case '36-45': matchesAge = age >= 36 && age <= 45; break;
            case '46-55': matchesAge = age >= 46 && age <= 55; break;
            case '55+': matchesAge = age > 55; break;
          }
        } else {
          matchesAge = false;
        }
      }
      
      return matchesSearch && matchesState && matchesType && matchesSocial && matchesAge;
    }).sort((a: any, b: any) => b.lifetime_spend - a.lifetime_spend);
  }, [customers, searchTerm, stateFilter, typeFilter, hasSocialFilter, ageRangeFilter]);

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

      {/* Stats Cards with VIEW DETAILS buttons */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Customers */}
        <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
          <CardContent className="pt-4 pb-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Customers</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Users className="h-8 w-8 text-cyan-500" />
            </div>
            <Button
              variant="link"
              size="sm"
              className="p-0 h-auto text-cyan-600 hover:text-cyan-700 font-medium"
              onClick={() => {
                console.log('[CRM KPI] View Details clicked: Total Customers');
                navigate('/crm/toptier-experience/customers');
              }}
            >
              VIEW DETAILS →
            </Button>
          </CardContent>
        </Card>

        {/* VIP Customers */}
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="pt-4 pb-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">VIP Customers</p>
                <p className="text-2xl font-bold">{stats.vip}</p>
              </div>
              <Crown className="h-8 w-8 text-purple-500" />
            </div>
            <Button
              variant="link"
              size="sm"
              className="p-0 h-auto text-purple-600 hover:text-purple-700 font-medium"
              onClick={() => {
                console.log('[CRM KPI] View Details clicked: VIP Customers');
                navigate('/crm/toptier-experience/customers/vip');
              }}
            >
              VIEW DETAILS →
            </Button>
          </CardContent>
        </Card>

        {/* Returning Customers */}
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="pt-4 pb-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Returning</p>
                <p className="text-2xl font-bold">{stats.returning}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-500" />
            </div>
            <Button
              variant="link"
              size="sm"
              className="p-0 h-auto text-blue-600 hover:text-blue-700 font-medium"
              onClick={() => {
                console.log('[CRM KPI] View Details clicked: Returning Customers');
                navigate('/crm/toptier-experience/customers/returning');
              }}
            >
              VIEW DETAILS →
            </Button>
          </CardContent>
        </Card>

        {/* New Customers */}
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="pt-4 pb-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">New</p>
                <p className="text-2xl font-bold">{stats.newCustomers}</p>
              </div>
              <UserPlus className="h-8 w-8 text-green-500" />
            </div>
            <Button
              variant="link"
              size="sm"
              className="p-0 h-auto text-green-600 hover:text-green-700 font-medium"
              onClick={() => {
                console.log('[CRM KPI] View Details clicked: New Customers');
                navigate('/crm/toptier-experience/customers/newly-added');
              }}
            >
              VIEW DETAILS →
            </Button>
          </CardContent>
        </Card>

        {/* Total Bookings */}
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="pt-4 pb-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Bookings</p>
                <p className="text-2xl font-bold">{stats.totalBookings}</p>
              </div>
              <Calendar className="h-8 w-8 text-amber-500" />
            </div>
            <Button
              variant="link"
              size="sm"
              className="p-0 h-auto text-amber-600 hover:text-amber-700 font-medium"
              onClick={() => {
                console.log('[CRM KPI] View Details clicked: Total Bookings');
                navigate('/crm/toptier-experience/customers/bookings');
              }}
            >
              VIEW DETAILS →
            </Button>
          </CardContent>
        </Card>

        {/* Lifetime Value */}
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="pt-4 pb-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Lifetime Value</p>
                <p className="text-2xl font-bold">${(stats.totalSpend / 1000).toFixed(0)}k</p>
              </div>
              <DollarSign className="h-8 w-8 text-emerald-500" />
            </div>
            <Button
              variant="link"
              size="sm"
              className="p-0 h-auto text-emerald-600 hover:text-emerald-700 font-medium"
              onClick={() => {
                console.log('[CRM KPI] View Details clicked: Lifetime Value');
                navigate('/crm/toptier-experience/customers/value');
              }}
            >
              VIEW DETAILS →
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
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
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="vip">VIP</SelectItem>
            <SelectItem value="returning">Returning</SelectItem>
            <SelectItem value="new">New</SelectItem>
          </SelectContent>
        </Select>
        <Select value={ageRangeFilter} onValueChange={setAgeRangeFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Age Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Ages</SelectItem>
            <SelectItem value="18-25">18-25</SelectItem>
            <SelectItem value="26-35">26-35</SelectItem>
            <SelectItem value="36-45">36-45</SelectItem>
            <SelectItem value="46-55">46-55</SelectItem>
            <SelectItem value="55+">55+</SelectItem>
          </SelectContent>
        </Select>
        <Select value={hasSocialFilter} onValueChange={setHasSocialFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Social Media" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any Social</SelectItem>
            <SelectItem value="yes">Has Social</SelectItem>
            <SelectItem value="no">No Social</SelectItem>
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
                    <th className="text-left py-3 px-4 font-medium">DOB / Age</th>
                    <th className="text-left py-3 px-4 font-medium">State</th>
                    <th className="text-center py-3 px-4 font-medium">Social</th>
                    <th className="text-right py-3 px-4 font-medium">Bookings</th>
                    <th className="text-right py-3 px-4 font-medium">Lifetime Spend</th>
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
                        {customer.dob ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Cake className="h-3 w-3 text-muted-foreground" />
                            <span>{format(new Date(customer.dob), 'MMM d')}</span>
                            <span className="text-muted-foreground">({calculateAge(customer.dob)})</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {customer.primary_state}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          {customer.social_instagram && (
                            <a
                              href={getSocialUrl('instagram', customer.social_instagram)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1 rounded hover:bg-muted transition-colors"
                            >
                              <Instagram className="h-4 w-4 text-pink-500" />
                            </a>
                          )}
                          {customer.social_tiktok && (
                            <a
                              href={getSocialUrl('tiktok', customer.social_tiktok)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1 rounded hover:bg-muted transition-colors"
                            >
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                              </svg>
                            </a>
                          )}
                          {!customer.has_social && (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-medium">
                        {customer.total_bookings}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-green-600">
                        ${customer.lifetime_spend?.toLocaleString()}
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
