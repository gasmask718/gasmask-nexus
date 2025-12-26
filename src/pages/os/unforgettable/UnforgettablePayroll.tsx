import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Download,
  Search,
  Filter,
  Calendar,
  CreditCard,
  TrendingUp,
  Users
} from 'lucide-react';

// Mock payroll data
const mockPayrollData = [
  { id: '1', name: 'Marcus Johnson', role: 'Lead DJ', hoursWorked: 48, rate: 75, total: 3600, status: 'pending', lastPaid: '2024-01-15' },
  { id: '2', name: 'Sarah Chen', role: 'Event Coordinator', hoursWorked: 80, rate: 45, total: 3600, status: 'paid', lastPaid: '2024-01-20' },
  { id: '3', name: 'Mike Torres', role: 'Bartender', hoursWorked: 32, rate: 35, total: 1120, status: 'pending', lastPaid: '2024-01-10' },
  { id: '4', name: 'Jessica Williams', role: 'MC/Host', hoursWorked: 24, rate: 65, total: 1560, status: 'processing', lastPaid: '2024-01-18' },
  { id: '5', name: 'David Kim', role: 'Setup Crew Lead', hoursWorked: 56, rate: 30, total: 1680, status: 'paid', lastPaid: '2024-01-20' },
  { id: '6', name: 'Amanda Brown', role: 'Photographer', hoursWorked: 20, rate: 85, total: 1700, status: 'pending', lastPaid: '2024-01-05' },
];

const mockPaymentHistory = [
  { id: '1', date: '2024-01-20', staff: 12, total: 28500, method: 'Direct Deposit', status: 'completed' },
  { id: '2', date: '2024-01-15', staff: 8, total: 18200, method: 'Direct Deposit', status: 'completed' },
  { id: '3', date: '2024-01-10', staff: 15, total: 32100, method: 'Direct Deposit', status: 'completed' },
  { id: '4', date: '2024-01-05', staff: 10, total: 24800, method: 'Check', status: 'completed' },
];

export default function UnforgettablePayroll() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredPayroll = mockPayrollData.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.role.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPending = mockPayrollData.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.total, 0);
  const totalProcessing = mockPayrollData.filter(p => p.status === 'processing').reduce((sum, p) => sum + p.total, 0);
  const totalPaidThisMonth = mockPayrollData.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.total, 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Paid</Badge>;
      case 'pending':
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Pending</Badge>;
      case 'processing':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Processing</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Staff Payroll</h1>
          <p className="text-muted-foreground">Manage payments, track hours, and process payroll</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button className="bg-primary hover:bg-primary/90">
            <CreditCard className="h-4 w-4 mr-2" />
            Process Payroll
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Clock className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-foreground">${totalPending.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <AlertCircle className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Processing</p>
                <p className="text-2xl font-bold text-foreground">${totalProcessing.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Paid This Month</p>
                <p className="text-2xl font-bold text-foreground">${totalPaidThisMonth.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <TrendingUp className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">MTD Total</p>
                <p className="text-2xl font-bold text-foreground">${(totalPending + totalProcessing + totalPaidThisMonth).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="current" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="current">Current Period</TabsTrigger>
          <TabsTrigger value="history">Payment History</TabsTrigger>
          <TabsTrigger value="rates">Pay Rates</TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search staff..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-background border-border"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 bg-background border-border">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Payroll Table */}
          <Card className="bg-card border-border">
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Staff Member</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Role</th>
                    <th className="text-center p-4 text-sm font-medium text-muted-foreground">Hours</th>
                    <th className="text-center p-4 text-sm font-medium text-muted-foreground">Rate</th>
                    <th className="text-center p-4 text-sm font-medium text-muted-foreground">Total</th>
                    <th className="text-center p-4 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-right p-4 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayroll.map((item) => (
                    <tr key={item.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="p-4">
                        <p className="font-medium text-foreground">{item.name}</p>
                        <p className="text-xs text-muted-foreground">Last paid: {item.lastPaid}</p>
                      </td>
                      <td className="p-4 text-muted-foreground">{item.role}</td>
                      <td className="p-4 text-center text-foreground">{item.hoursWorked}h</td>
                      <td className="p-4 text-center text-foreground">${item.rate}/hr</td>
                      <td className="p-4 text-center font-semibold text-foreground">${item.total.toLocaleString()}</td>
                      <td className="p-4 text-center">{getStatusBadge(item.status)}</td>
                      <td className="p-4 text-right">
                        <Button variant="ghost" size="sm">
                          <DollarSign className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">Payment History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Date</th>
                    <th className="text-center p-4 text-sm font-medium text-muted-foreground">Staff Paid</th>
                    <th className="text-center p-4 text-sm font-medium text-muted-foreground">Total Amount</th>
                    <th className="text-center p-4 text-sm font-medium text-muted-foreground">Method</th>
                    <th className="text-center p-4 text-sm font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {mockPaymentHistory.map((payment) => (
                    <tr key={payment.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-foreground">{payment.date}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="text-foreground">{payment.staff}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center font-semibold text-foreground">${payment.total.toLocaleString()}</td>
                      <td className="p-4 text-center text-muted-foreground">{payment.method}</td>
                      <td className="p-4 text-center">
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                          {payment.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rates" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">Pay Rates by Role</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { role: 'Lead DJ', rate: 75, overtime: 112.50 },
                  { role: 'DJ', rate: 55, overtime: 82.50 },
                  { role: 'Event Coordinator', rate: 45, overtime: 67.50 },
                  { role: 'MC/Host', rate: 65, overtime: 97.50 },
                  { role: 'Bartender', rate: 35, overtime: 52.50 },
                  { role: 'Server', rate: 25, overtime: 37.50 },
                  { role: 'Setup Crew', rate: 25, overtime: 37.50 },
                  { role: 'Photographer', rate: 85, overtime: 127.50 },
                  { role: 'Security', rate: 30, overtime: 45 },
                ].map((rate, i) => (
                  <div key={i} className="p-4 rounded-lg border border-border bg-muted/30">
                    <p className="font-medium text-foreground">{rate.role}</p>
                    <div className="flex justify-between mt-2 text-sm">
                      <span className="text-muted-foreground">Regular:</span>
                      <span className="text-foreground">${rate.rate}/hr</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Overtime:</span>
                      <span className="text-amber-400">${rate.overtime}/hr</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
