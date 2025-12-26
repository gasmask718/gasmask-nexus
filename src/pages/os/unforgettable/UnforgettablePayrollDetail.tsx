import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, DollarSign, Calendar, Clock, CheckCircle, AlertCircle } from 'lucide-react';

const SIMULATED_PAYROLL_DATA = {
  'stf-001': {
    name: 'Maria Garcia',
    role: 'Event Coordinator',
    hourlyRate: 35,
    totalEarnings: 4200,
    pendingPayment: 840,
    history: [
      { id: 'pay-001', date: 'Dec 20, 2025', event: 'Johnson Wedding', hours: 8, amount: 280, status: 'paid' },
      { id: 'pay-002', date: 'Dec 18, 2025', event: 'Tech Corp Party', hours: 6, amount: 210, status: 'paid' },
      { id: 'pay-003', date: 'Dec 15, 2025', event: 'Martinez Quinceañera', hours: 10, amount: 350, status: 'paid' },
      { id: 'pay-004', date: 'Dec 26, 2025', event: 'Current Event', hours: 8, amount: 280, status: 'pending' },
      { id: 'pay-005', date: 'Dec 28, 2025', event: 'Upcoming Event', hours: 8, amount: 280, status: 'scheduled' },
    ],
  },
};

const DEFAULT_PAYROLL = {
  name: 'Staff Member',
  role: 'Team Member',
  hourlyRate: 25,
  totalEarnings: 2500,
  pendingPayment: 500,
  history: [
    { id: 'pay-001', date: 'Dec 20, 2025', event: 'Sample Event', hours: 6, amount: 150, status: 'paid' },
    { id: 'pay-002', date: 'Dec 18, 2025', event: 'Another Event', hours: 8, amount: 200, status: 'paid' },
    { id: 'pay-003', date: 'Dec 26, 2025', event: 'Current Event', hours: 6, amount: 150, status: 'pending' },
  ],
};

export default function UnforgettablePayrollDetail() {
  const navigate = useNavigate();
  const { staffId } = useParams<{ staffId: string }>();
  
  const payroll = SIMULATED_PAYROLL_DATA[staffId as keyof typeof SIMULATED_PAYROLL_DATA] || DEFAULT_PAYROLL;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">Paid</Badge>;
      case 'pending':
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">Pending</Badge>;
      case 'scheduled':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">Scheduled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/os/unforgettable/payroll')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{payroll.name}</h1>
          <p className="text-muted-foreground">{payroll.role} • ${payroll.hourlyRate}/hr</p>
        </div>
        <Badge variant="outline" className="ml-auto bg-amber-500/10 text-amber-600 border-amber-500/30">
          Simulated Data
        </Badge>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-transparent border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <p className="text-sm text-muted-foreground">Total Earnings</p>
            </div>
            <p className="text-3xl font-bold">${payroll.totalEarnings.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500/10 to-transparent border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <p className="text-sm text-muted-foreground">Pending Payment</p>
            </div>
            <p className="text-3xl font-bold text-amber-600">${payroll.pendingPayment.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-pink-500/10 to-transparent border-pink-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-5 w-5 text-pink-600" />
              <p className="text-sm text-muted-foreground">Hourly Rate</p>
            </div>
            <p className="text-3xl font-bold">${payroll.hourlyRate}</p>
          </CardContent>
        </Card>
      </div>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-pink-500" />
            Payment History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Date</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Event</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Hours</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Amount</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {payroll.history.map((payment) => (
                  <tr key={payment.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {payment.date}
                      </span>
                    </td>
                    <td className="p-3 font-medium">{payment.event}</td>
                    <td className="p-3">
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {payment.hours}h
                      </span>
                    </td>
                    <td className="p-3 font-medium">${payment.amount}</td>
                    <td className="p-3">{getStatusBadge(payment.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={() => navigate(`/os/unforgettable/staff/${staffId}`)}>
          View Staff Profile
        </Button>
        <Button variant="outline" onClick={() => navigate('/os/unforgettable/scheduling')}>
          View Schedule
        </Button>
      </div>
    </div>
  );
}
