/**
 * TopTier Customer Requests - Company-wide view of new customer inquiries
 */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ArrowLeft, Search, Eye, Plus, MessageSquare, DollarSign, 
  Users, MapPin, Calendar, Inbox, ArrowRight, Phone, Mail,
  Clock, CheckCircle, AlertCircle, UserPlus
} from 'lucide-react';
import { TOPTIER_PARTNER_CATEGORIES, US_STATES } from '@/config/crmBlueprints';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { format } from 'date-fns';
import EmptyStateWithGuidance from '@/components/crm/EmptyStateWithGuidance';

interface CustomerRequest {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  requested_category: string;
  requested_state: string;
  requested_city: string;
  budget_min: number;
  budget_max: number;
  requested_date: string;
  event_details: string;
  status: 'new' | 'contacted' | 'quoted' | 'converted' | 'lost';
  created_at: string;
  assigned_to?: string;
  notes?: string;
}

export default function TopTierCustomerRequests() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { simulationMode } = useSimulationMode();

  // Simulated customer requests
  const requests: CustomerRequest[] = useMemo(() => {
    if (!simulationMode) return [];
    
    const names = ['Jessica Williams', 'Michael Brown', 'Sarah Johnson', 'David Martinez', 'Emily Chen', 'Robert Taylor'];
    const categories = ['exotic_rental_car_promo', 'yachts', 'helicopter_promo', 'club_lounge_package', 'private_chef_promo'];
    const states = ['FL', 'CA', 'NY', 'TX', 'NV'];
    const cities: Record<string, string[]> = {
      FL: ['Miami', 'Orlando', 'Tampa'],
      CA: ['Los Angeles', 'San Francisco', 'San Diego'],
      NY: ['New York', 'Brooklyn', 'Queens'],
      TX: ['Houston', 'Dallas', 'Austin'],
      NV: ['Las Vegas', 'Reno'],
    };
    const statuses: CustomerRequest['status'][] = ['new', 'contacted', 'quoted', 'new', 'contacted'];

    return Array.from({ length: 12 }, (_, i) => {
      const state = states[i % states.length];
      return {
        id: `req-${i + 1}`,
        customer_name: names[i % names.length],
        customer_email: `${names[i % names.length].toLowerCase().replace(' ', '.')}@email.com`,
        customer_phone: `(${Math.floor(Math.random() * 900) + 100}) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
        requested_category: categories[i % categories.length],
        requested_state: state,
        requested_city: cities[state][i % cities[state].length],
        budget_min: Math.floor(Math.random() * 5000) + 1000,
        budget_max: Math.floor(Math.random() * 10000) + 5000,
        requested_date: new Date(Date.now() + Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString(),
        event_details: 'Looking for a luxury experience for a special celebration.',
        status: statuses[i % statuses.length],
        created_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        assigned_to: i % 3 === 0 ? 'Sales Team' : undefined,
        notes: i % 2 === 0 ? 'High priority client' : undefined,
      };
    });
  }, [simulationMode]);

  // Filter requests
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      const matchesSearch = searchTerm === '' ||
        req.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.customer_email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesState = stateFilter === 'all' || req.requested_state === stateFilter;
      const matchesCategory = categoryFilter === 'all' || req.requested_category === categoryFilter;
      const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
      return matchesSearch && matchesState && matchesCategory && matchesStatus;
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [requests, searchTerm, stateFilter, categoryFilter, statusFilter]);

  // Calculate stats
  const stats = useMemo(() => {
    const newCount = requests.filter(r => r.status === 'new').length;
    const contactedCount = requests.filter(r => r.status === 'contacted').length;
    const quotedCount = requests.filter(r => r.status === 'quoted').length;
    const totalBudget = requests.reduce((sum, r) => sum + ((r.budget_min + r.budget_max) / 2), 0);
    
    return { total: requests.length, new: newCount, contacted: contactedCount, quoted: quotedCount, avgBudget: Math.round(totalBudget / requests.length) };
  }, [requests]);

  const getStatusBadge = (status: CustomerRequest['status']) => {
    switch (status) {
      case 'new':
        return <Badge className="bg-blue-500/10 text-blue-500"><Inbox className="h-3 w-3 mr-1" />New</Badge>;
      case 'contacted':
        return <Badge className="bg-yellow-500/10 text-yellow-500"><Phone className="h-3 w-3 mr-1" />Contacted</Badge>;
      case 'quoted':
        return <Badge className="bg-purple-500/10 text-purple-500"><DollarSign className="h-3 w-3 mr-1" />Quoted</Badge>;
      case 'converted':
        return <Badge className="bg-green-500/10 text-green-500"><CheckCircle className="h-3 w-3 mr-1" />Converted</Badge>;
      case 'lost':
        return <Badge className="bg-red-500/10 text-red-500"><AlertCircle className="h-3 w-3 mr-1" />Lost</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleViewRequest = (requestId: string) => {
    navigate(`/crm/toptier-experience/requests/${requestId}`);
  };

  const handleConvertToDeal = (e: React.MouseEvent, requestId: string) => {
    e.stopPropagation();
    navigate(`/crm/toptier-experience/deals/new?requestId=${requestId}`);
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
              <h1 className="text-2xl font-bold">Customer Requests</h1>
              {simulationMode && <SimulationBadge />}
            </div>
            <p className="text-muted-foreground">Inbound inquiries awaiting conversion</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Requests</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Inbox className="h-8 w-8 text-cyan-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">New</p>
                <p className="text-2xl font-bold">{stats.new}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Contacted</p>
                <p className="text-2xl font-bold">{stats.contacted}</p>
              </div>
              <Phone className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Quoted</p>
                <p className="text-2xl font-bold">{stats.quoted}</p>
              </div>
              <DollarSign className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Budget</p>
                <p className="text-2xl font-bold">${stats.avgBudget.toLocaleString()}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by customer name or email..."
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
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="quoted">Quoted</SelectItem>
            <SelectItem value="converted">Converted</SelectItem>
            <SelectItem value="lost">Lost</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Requests List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Requests ({filteredRequests.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredRequests.length === 0 ? (
            <EmptyStateWithGuidance
              icon={<Inbox className="h-12 w-12" />}
              title="No requests found"
              description="New customer inquiries will appear here"
            />
          ) : (
            <div className="space-y-4">
              {filteredRequests.map((request) => (
                <div 
                  key={request.id}
                  className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => handleViewRequest(request.id)}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-medium">{request.customer_name}</h3>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {request.customer_email}
                            <span className="mx-1">•</span>
                            <Phone className="h-3 w-3" />
                            {request.customer_phone}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant="outline">
                          {TOPTIER_PARTNER_CATEGORIES.find(c => c.value === request.requested_category)?.label || request.requested_category}
                        </Badge>
                        <Badge variant="secondary">
                          <MapPin className="h-3 w-3 mr-1" />
                          {request.requested_city}, {request.requested_state}
                        </Badge>
                        <Badge variant="secondary">
                          <Calendar className="h-3 w-3 mr-1" />
                          {format(new Date(request.requested_date), 'MMM d, yyyy')}
                        </Badge>
                        <Badge variant="secondary">
                          <DollarSign className="h-3 w-3 mr-1" />
                          ${request.budget_min.toLocaleString()} - ${request.budget_max.toLocaleString()}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(request.status)}
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={(e) => handleConvertToDeal(e, request.id)}
                        >
                          <ArrowRight className="h-4 w-4 mr-2" />
                          Convert to Deal
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewRequest(request.id);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3 inline mr-1" />
                    Received {format(new Date(request.created_at), 'MMM d, yyyy h:mm a')}
                    {request.assigned_to && (
                      <span className="ml-4">
                        <UserPlus className="h-3 w-3 inline mr-1" />
                        Assigned to: {request.assigned_to}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
