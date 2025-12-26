/**
 * TopTier Analytics - All Deals
 * Company-wide view of all deals with filters
 */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  ArrowLeft, Search, Eye, TrendingUp, DollarSign, Calendar,
  CheckCircle, Clock, AlertCircle, Users, Building2
} from 'lucide-react';
import { TOPTIER_PARTNER_CATEGORIES, US_STATES } from '@/config/crmBlueprints';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { useCRMSimulation } from '@/hooks/useCRMSimulation';
import { useResolvedData } from '@/hooks/useResolvedData';
import { format } from 'date-fns';

export default function TopTierAnalyticsDeals() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { simulationMode } = useSimulationMode();
  const { getEntityData } = useCRMSimulation('toptier-experience');
  
  const simulatedBookings = getEntityData('booking');
  const simulatedPartners = getEntityData('partner');
  const { data: bookings, isSimulated } = useResolvedData([], simulatedBookings);
  const { data: partners } = useResolvedData([], simulatedPartners);

  // Enrich bookings with partner details
  const enrichedBookings = useMemo(() => {
    return bookings.map((booking: any) => {
      const linkedPartnerIds = booking.linked_partners || [];
      const linkedPartnerDetails = linkedPartnerIds.map((pId: string) => 
        partners.find((p: any) => p.id === pId)
      ).filter(Boolean);
      return { ...booking, partnerDetails: linkedPartnerDetails };
    });
  }, [bookings, partners]);

  // Filter bookings
  const filteredBookings = useMemo(() => {
    return enrichedBookings.filter((booking: any) => {
      const matchesSearch = searchTerm === '' ||
        booking.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.id?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesState = stateFilter === 'all' || booking.state === stateFilter;
      const matchesCategory = categoryFilter === 'all' || 
        booking.partner_categories?.includes(categoryFilter);
      const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;
      return matchesSearch && matchesState && matchesCategory && matchesStatus;
    }).sort((a: any, b: any) => 
      new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
    );
  }, [enrichedBookings, searchTerm, stateFilter, categoryFilter, statusFilter]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalValue = bookings.reduce((sum: number, b: any) => sum + (b.total_amount || 0), 0);
    const avgValue = bookings.length > 0 ? Math.round(totalValue / bookings.length) : 0;
    const confirmed = bookings.filter((b: any) => b.status === 'confirmed').length;
    const pending = bookings.filter((b: any) => b.status === 'pending' || b.status === 'quote_sent').length;
    return { total: bookings.length, totalValue, avgValue, confirmed, pending };
  }, [bookings]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-green-500/10 text-green-500"><CheckCircle className="h-3 w-3 mr-1" />Confirmed</Badge>;
      case 'pending':
      case 'quote_sent':
        return <Badge className="bg-yellow-500/10 text-yellow-500"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'deposit_paid':
        return <Badge className="bg-blue-500/10 text-blue-500"><DollarSign className="h-3 w-3 mr-1" />Deposit Paid</Badge>;
      case 'completed':
        return <Badge className="bg-purple-500/10 text-purple-500"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-500/10 text-red-500"><AlertCircle className="h-3 w-3 mr-1" />Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate('/crm/toptier-experience/partners')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">All Deals</h1>
              {isSimulated && <SimulationBadge />}
            </div>
            <p className="text-muted-foreground">Company-wide deal analytics and tracking</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Deals</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-cyan-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold">${stats.totalValue.toLocaleString()}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Deal Value</p>
                <p className="text-2xl font-bold">${stats.avgValue.toLocaleString()}</p>
              </div>
              <DollarSign className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Confirmed</p>
                <p className="text-2xl font-bold">{stats.confirmed}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{stats.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by customer or deal ID..."
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
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="quote_sent">Quote Sent</SelectItem>
            <SelectItem value="deposit_paid">Deposit Paid</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Deals Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Deals ({filteredBookings.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredBookings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No deals found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Deal ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Partner(s)</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Event Date</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBookings.map((booking: any) => (
                    <TableRow 
                      key={booking.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/crm/toptier-experience/deals/${booking.id}`)}
                    >
                      <TableCell>
                        <span className="font-mono text-sm">{booking.id.slice(0, 8)}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          {booking.customer_name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {booking.partnerDetails?.slice(0, 2).map((p: any) => (
                            <Badge key={p.id} variant="outline" className="text-xs">
                              {p.company_name}
                            </Badge>
                          ))}
                          {(booking.partnerDetails?.length || 0) > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{booking.partnerDetails.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {TOPTIER_PARTNER_CATEGORIES.find(c => c.value === booking.partner_categories?.[0])?.label || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell>{booking.state || 'N/A'}</TableCell>
                      <TableCell>
                        {booking.event_date ? format(new Date(booking.event_date), 'MMM d, yyyy') : '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${(booking.total_amount || 0).toLocaleString()}
                      </TableCell>
                      <TableCell>{getStatusBadge(booking.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/crm/toptier-experience/deals/${booking.id}`);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
