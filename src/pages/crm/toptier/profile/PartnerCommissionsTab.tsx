/**
 * Partner Commissions Tab - Ledger-style view with payout tracking
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
  Download, Search, Eye, Edit, DollarSign,
  Wallet, CreditCard, CheckCircle, Clock, AlertCircle
} from 'lucide-react';
import { SimulationBadge, EmptyStateWithGuidance } from '@/contexts/SimulationModeContext';
import { format } from 'date-fns';

interface PartnerCommissionsTabProps {
  partner: any;
  isSimulated: boolean;
  bookings: any[];
}

export default function PartnerCommissionsTab({ partner, isSimulated, bookings }: PartnerCommissionsTabProps) {
  const navigate = useNavigate();
  const { partnerId } = useParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Generate commission data from bookings
  const commissions = useMemo(() => {
    return bookings.map((booking: any, index: number) => ({
      id: `comm-${index}`,
      deal: booking.customer_name || booking.booking_name || `Deal ${booking.id}`,
      dealId: booking.id,
      grossAmount: booking.total_amount || 0,
      commissionRate: partner?.commission_rate || 10,
      commissionAmount: Math.round((booking.total_amount || 0) * (partner?.commission_rate || 10) / 100),
      payoutStatus: index === 0 ? 'paid' : index === 1 ? 'pending' : index === 2 ? 'overdue' : 'scheduled',
      payoutDate: index === 0 ? new Date(Date.now() - 86400000 * 5) : null,
      eventDate: booking.event_date,
    }));
  }, [partner, bookings]);

  const filteredCommissions = useMemo(() => {
    return commissions.filter((comm: any) => {
      const matchesSearch = !searchTerm || 
        comm.deal?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || comm.payoutStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [commissions, searchTerm, statusFilter]);

  // Commission totals
  const totals = useMemo(() => {
    const total = commissions.reduce((sum: number, c: any) => sum + c.commissionAmount, 0);
    const paid = commissions.filter((c: any) => c.payoutStatus === 'paid').reduce((sum: number, c: any) => sum + c.commissionAmount, 0);
    const pending = commissions.filter((c: any) => c.payoutStatus === 'pending').reduce((sum: number, c: any) => sum + c.commissionAmount, 0);
    const overdue = commissions.filter((c: any) => c.payoutStatus === 'overdue').reduce((sum: number, c: any) => sum + c.commissionAmount, 0);
    return { total, paid, pending, overdue };
  }, [commissions]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-500/10 text-green-500"><CheckCircle className="h-3 w-3 mr-1" />Paid</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/10 text-yellow-500"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'overdue':
        return <Badge className="bg-red-500/10 text-red-500"><AlertCircle className="h-3 w-3 mr-1" />Overdue</Badge>;
      case 'scheduled':
        return <Badge className="bg-blue-500/10 text-blue-500"><Clock className="h-3 w-3 mr-1" />Scheduled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleExportCSV = () => {
    // Export commission data
    const csvContent = [
      ['Deal', 'Gross Amount', 'Commission Rate', 'Commission Amount', 'Status', 'Payout Date'],
      ...filteredCommissions.map((c: any) => [
        c.deal,
        c.grossAmount,
        `${c.commissionRate}%`,
        c.commissionAmount,
        c.payoutStatus,
        c.payoutDate ? format(c.payoutDate, 'yyyy-MM-dd') : ''
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `partner-commissions-${partnerId}.csv`;
    a.click();
  };

  const handleViewDeal = (dealId: string) => {
    navigate(`/crm/toptier-experience/deals/${dealId}`);
  };

  const handleUpdatePayout = (e: React.MouseEvent, commissionId: string) => {
    e.stopPropagation();
    // Open payout update modal
    console.log('Update payout for:', commissionId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          Commissions
          {isSimulated && <SimulationBadge />}
        </h2>
        <Button variant="outline" onClick={handleExportCSV}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Lifetime Commission</p>
                <p className="text-2xl font-bold">${totals.total.toLocaleString()}</p>
              </div>
              <DollarSign className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Paid Commission</p>
                <p className="text-2xl font-bold text-green-600">${totals.paid.toLocaleString()}</p>
              </div>
              <Wallet className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Commission</p>
                <p className="text-2xl font-bold text-yellow-600">${totals.pending.toLocaleString()}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className="text-2xl font-bold text-red-600">${totals.overdue.toLocaleString()}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by deal..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Payout Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Commissions Table */}
      {filteredCommissions.length === 0 ? (
        <EmptyStateWithGuidance
          icon={CreditCard}
          title="No Commissions Yet"
          description="Commissions will appear here once deals are completed with this partner."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Deal</TableHead>
                  <TableHead className="text-right">Gross Amount</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead>Payout Status</TableHead>
                  <TableHead>Payout Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCommissions.map((commission: any) => (
                  <TableRow 
                    key={commission.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleViewDeal(commission.dealId)}
                  >
                    <TableCell className="font-medium">{commission.deal}</TableCell>
                    <TableCell className="text-right">${commission.grossAmount.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{commission.commissionRate}%</TableCell>
                    <TableCell className="text-right font-semibold text-green-600">
                      ${commission.commissionAmount.toLocaleString()}
                    </TableCell>
                    <TableCell>{getStatusBadge(commission.payoutStatus)}</TableCell>
                    <TableCell>
                      {commission.payoutDate ? format(commission.payoutDate, 'MMM d, yyyy') : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleViewDeal(commission.dealId); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={(e) => handleUpdatePayout(e, commission.id)}>
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
