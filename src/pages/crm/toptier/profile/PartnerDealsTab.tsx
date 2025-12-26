/**
 * Partner Deals Tab - Full page with table, filters, and actions
 */
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Plus, Search, Filter, Eye, Edit, Trash2,
  Calendar, DollarSign, TrendingUp, CheckCircle,
  Clock, AlertCircle, Building2
} from 'lucide-react';
import { SimulationBadge, EmptyStateWithGuidance } from '@/contexts/SimulationModeContext';
import { format } from 'date-fns';

interface PartnerDealsTabProps {
  partner: any;
  isSimulated: boolean;
  bookings: any[];
}

export default function PartnerDealsTab({ partner, isSimulated, bookings }: PartnerDealsTabProps) {
  const navigate = useNavigate();
  const { partnerId } = useParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  const filteredBookings = useMemo(() => {
    return bookings.filter((booking: any) => {
      const matchesSearch = !searchTerm || 
        booking.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.id?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [bookings, searchTerm, statusFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500/10 text-green-500"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'upcoming':
        return <Badge className="bg-blue-500/10 text-blue-500"><Calendar className="h-3 w-3 mr-1" />Upcoming</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/10 text-yellow-500"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-500/10 text-red-500"><AlertCircle className="h-3 w-3 mr-1" />Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Summary stats
  const totalDeals = filteredBookings.length;
  const totalValue = filteredBookings.reduce((sum: number, b: any) => sum + (b.total_amount || 0), 0);
  const avgValue = totalDeals > 0 ? Math.round(totalValue / totalDeals) : 0;

  const handleCreateDeal = () => {
    // Navigate to create deal with partner pre-linked
    navigate(`/crm/toptier-experience/deals/new?partnerId=${partnerId}`);
  };

  const handleViewDeal = (dealId: string) => {
    navigate(`/crm/toptier-experience/deals/${dealId}`);
  };

  const handleEditDeal = (e: React.MouseEvent, dealId: string) => {
    e.stopPropagation();
    navigate(`/crm/toptier-experience/deals/${dealId}/edit`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          Deals / Bookings
          {isSimulated && <SimulationBadge />}
        </h2>
        <Button onClick={handleCreateDeal}>
          <Plus className="h-4 w-4 mr-2" />
          Create New Deal
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Deals</p>
                <p className="text-2xl font-bold">{totalDeals}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold">${totalValue.toLocaleString()}</p>
              </div>
              <DollarSign className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Deal Value</p>
                <p className="text-2xl font-bold">${avgValue.toLocaleString()}</p>
              </div>
              <DollarSign className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search deals..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Date Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
            <SelectItem value="90d">Last 90 Days</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Deals Table */}
      {filteredBookings.length === 0 ? (
        <EmptyStateWithGuidance
          icon={Building2}
          title="No Deals Yet"
          description="Create your first deal with this partner to start tracking revenue and commissions."
          actionLabel="Create Deal"
          onAction={handleCreateDeal}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Deal Name</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Event Date</TableHead>
                  <TableHead className="text-right">Deal Value</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBookings.map((booking: any) => (
                  <TableRow 
                    key={booking.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleViewDeal(booking.id)}
                  >
                    <TableCell className="font-medium">{booking.booking_name || `Deal ${booking.id}`}</TableCell>
                    <TableCell>{booking.customer_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {booking.partner_categories?.[0] || 'General'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {booking.event_date ? format(new Date(booking.event_date), 'MMM d, yyyy') : '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${(booking.total_amount || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      ${Math.round((booking.total_amount || 0) * (partner.commission_rate || 10) / 100).toLocaleString()}
                    </TableCell>
                    <TableCell>{getStatusBadge(booking.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleViewDeal(booking.id); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={(e) => handleEditDeal(e, booking.id)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
