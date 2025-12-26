/**
 * TopTier Analytics - Commissions
 * Company-wide commission ledger with payout tracking
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
  ArrowLeft, Search, Eye, Download, DollarSign, Wallet,
  CheckCircle, Clock, AlertCircle, Building2, Percent
} from 'lucide-react';
import { TOPTIER_PARTNER_CATEGORIES } from '@/config/crmBlueprints';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { useCRMSimulation } from '@/hooks/useCRMSimulation';
import { useResolvedData } from '@/hooks/useResolvedData';
import { format } from 'date-fns';

export default function TopTierAnalyticsCommissions() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [partnerFilter, setPartnerFilter] = useState<string>('all');

  const { simulationMode } = useSimulationMode();
  const { getEntityData } = useCRMSimulation('toptier-experience');
  
  const simulatedBookings = getEntityData('booking');
  const simulatedPartners = getEntityData('partner');
  const { data: bookings, isSimulated } = useResolvedData([], simulatedBookings);
  const { data: partners } = useResolvedData([], simulatedPartners);

  // Generate commission entries from bookings
  const commissionEntries = useMemo(() => {
    const entries: any[] = [];
    
    bookings.forEach((booking: any, index: number) => {
      const linkedPartnerIds = booking.linked_partners || [];
      const amount = booking.total_amount || 0;
      
      linkedPartnerIds.forEach((pId: string) => {
        const partner = partners.find((p: any) => p.id === pId);
        if (partner) {
          const commissionRate = partner.commission_rate || 10;
          const commissionAmount = Math.round(amount * commissionRate / 100);
          // Simulate different payout statuses
          const statuses = ['paid', 'pending', 'overdue', 'scheduled'];
          const payoutStatus = statuses[index % statuses.length];
          
          entries.push({
            id: `comm-${booking.id}-${pId}`,
            deal: booking,
            partner,
            grossAmount: amount,
            commissionRate,
            commissionAmount,
            payoutStatus,
            payoutDate: payoutStatus === 'paid' ? new Date(Date.now() - 86400000 * (index + 1)) : null,
            eventDate: booking.event_date,
          });
        }
      });
    });

    return entries;
  }, [bookings, partners]);

  // Filter commission entries
  const filteredEntries = useMemo(() => {
    return commissionEntries.filter((entry) => {
      const matchesSearch = searchTerm === '' ||
        entry.deal.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.partner.company_name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || entry.payoutStatus === statusFilter;
      const matchesPartner = partnerFilter === 'all' || entry.partner.id === partnerFilter;
      return matchesSearch && matchesStatus && matchesPartner;
    });
  }, [commissionEntries, searchTerm, statusFilter, partnerFilter]);

  // Calculate totals
  const totals = useMemo(() => {
    const total = commissionEntries.reduce((sum, e) => sum + e.commissionAmount, 0);
    const paid = commissionEntries.filter(e => e.payoutStatus === 'paid').reduce((sum, e) => sum + e.commissionAmount, 0);
    const pending = commissionEntries.filter(e => e.payoutStatus === 'pending').reduce((sum, e) => sum + e.commissionAmount, 0);
    const overdue = commissionEntries.filter(e => e.payoutStatus === 'overdue').reduce((sum, e) => sum + e.commissionAmount, 0);
    return { total, paid, pending, overdue };
  }, [commissionEntries]);

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
    const csvContent = [
      ['Partner', 'Deal', 'Gross Amount', 'Commission Rate', 'Commission Amount', 'Status', 'Payout Date'],
      ...filteredEntries.map((e) => [
        e.partner.company_name,
        e.deal.customer_name,
        e.grossAmount,
        `${e.commissionRate}%`,
        e.commissionAmount,
        e.payoutStatus,
        e.payoutDate ? format(e.payoutDate, 'yyyy-MM-dd') : ''
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `toptier-commissions-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
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
              <h1 className="text-2xl font-bold">Commission Ledger</h1>
              {isSimulated && <SimulationBadge />}
            </div>
            <p className="text-muted-foreground">Track all partner commissions and payouts</p>
          </div>
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Commission</p>
                <p className="text-2xl font-bold">${totals.total.toLocaleString()}</p>
              </div>
              <Percent className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Paid</p>
                <p className="text-2xl font-bold text-green-600">${totals.paid.toLocaleString()}</p>
              </div>
              <Wallet className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">${totals.pending.toLocaleString()}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardContent className="pt-4">
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
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by partner or deal..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={partnerFilter} onValueChange={setPartnerFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Partner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Partners</SelectItem>
            {partners.map((partner: any) => (
              <SelectItem key={partner.id} value={partner.id}>{partner.company_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Commission Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Commissions ({filteredEntries.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredEntries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No commission entries found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Partner</TableHead>
                    <TableHead>Deal / Customer</TableHead>
                    <TableHead className="text-right">Gross Amount</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Commission</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payout Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.map((entry) => (
                    <TableRow 
                      key={entry.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/crm/toptier-experience/deals/${entry.deal.id}`)}
                    >
                      <TableCell>
                        <div 
                          className="flex items-center gap-2 cursor-pointer hover:text-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/crm/toptier-experience/partners/profile/${entry.partner.id}`);
                          }}
                        >
                          <Building2 className="h-4 w-4" />
                          {entry.partner.company_name}
                        </div>
                      </TableCell>
                      <TableCell>{entry.deal.customer_name}</TableCell>
                      <TableCell className="text-right">${entry.grossAmount.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{entry.commissionRate}%</TableCell>
                      <TableCell className="text-right font-bold text-green-600">
                        ${entry.commissionAmount.toLocaleString()}
                      </TableCell>
                      <TableCell>{getStatusBadge(entry.payoutStatus)}</TableCell>
                      <TableCell>
                        {entry.payoutDate ? format(entry.payoutDate, 'MMM d, yyyy') : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/crm/toptier-experience/deals/${entry.deal.id}`);
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
