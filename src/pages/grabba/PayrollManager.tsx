import { useState } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Users, DollarSign, Calendar, Plus, CheckCircle, Clock, 
  XCircle, Calculator, RefreshCw
} from 'lucide-react';
import { usePayroll } from '@/hooks/useFinancialEngine';
import { format } from 'date-fns';

const EMPLOYEE_TYPES = [
  { value: 'driver', label: 'Driver' },
  { value: 'va', label: 'Virtual Assistant' },
  { value: 'ambassador', label: 'Ambassador' },
  { value: 'warehouse', label: 'Warehouse Staff' },
  { value: 'other', label: 'Other' },
];

export default function PayrollManager() {
  const { payroll, isLoading, createPayroll, updateStatus } = usePayroll();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newRecord, setNewRecord] = useState({
    employee_type: 'driver',
    employee_name: '',
    pay_period_start: '',
    pay_period_end: '',
    hours_worked: '',
    hourly_rate: '',
    base_pay: '',
    bonuses: '',
    commissions: '',
    deductions: '',
  });

  const calculateNetPay = () => {
    const base = parseFloat(newRecord.base_pay) || 0;
    const bonuses = parseFloat(newRecord.bonuses) || 0;
    const commissions = parseFloat(newRecord.commissions) || 0;
    const deductions = parseFloat(newRecord.deductions) || 0;
    return base + bonuses + commissions - deductions;
  };

  const handleCreatePayroll = () => {
    if (!newRecord.employee_name || !newRecord.pay_period_start || !newRecord.pay_period_end || !newRecord.base_pay) {
      return;
    }

    createPayroll({
      employee_type: newRecord.employee_type,
      employee_name: newRecord.employee_name,
      pay_period_start: newRecord.pay_period_start,
      pay_period_end: newRecord.pay_period_end,
      hours_worked: parseFloat(newRecord.hours_worked) || 0,
      hourly_rate: parseFloat(newRecord.hourly_rate) || 0,
      base_pay: parseFloat(newRecord.base_pay),
      bonuses: parseFloat(newRecord.bonuses) || 0,
      commissions: parseFloat(newRecord.commissions) || 0,
      deductions: parseFloat(newRecord.deductions) || 0,
      net_pay: calculateNetPay(),
    });

    setNewRecord({
      employee_type: 'driver',
      employee_name: '',
      pay_period_start: '',
      pay_period_end: '',
      hours_worked: '',
      hourly_rate: '',
      base_pay: '',
      bonuses: '',
      commissions: '',
      deductions: '',
    });
    setDialogOpen(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Paid</Badge>;
      case 'approved':
        return <Badge className="bg-blue-100 text-blue-800"><Clock className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'cancelled':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Cancelled</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  const pendingTotal = payroll.filter(p => p.status === 'pending').reduce((sum, p) => sum + Number(p.net_pay), 0);
  const paidThisMonth = payroll.filter(p => p.status === 'paid').reduce((sum, p) => sum + Number(p.net_pay), 0);

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Payroll Manager</h1>
            <p className="text-muted-foreground">Manage employee payments and commissions</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Payroll
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create Payroll Record</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4 max-h-[60vh] overflow-y-auto">
                <div className="space-y-2">
                  <Label>Employee Type</Label>
                  <Select 
                    value={newRecord.employee_type}
                    onValueChange={(value) => setNewRecord(prev => ({ ...prev, employee_type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EMPLOYEE_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Employee Name *</Label>
                  <Input
                    value={newRecord.employee_name}
                    onChange={(e) => setNewRecord(prev => ({ ...prev, employee_name: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Period Start *</Label>
                    <Input
                      type="date"
                      value={newRecord.pay_period_start}
                      onChange={(e) => setNewRecord(prev => ({ ...prev, pay_period_start: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Period End *</Label>
                    <Input
                      type="date"
                      value={newRecord.pay_period_end}
                      onChange={(e) => setNewRecord(prev => ({ ...prev, pay_period_end: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Hours Worked</Label>
                    <Input
                      type="number"
                      value={newRecord.hours_worked}
                      onChange={(e) => setNewRecord(prev => ({ ...prev, hours_worked: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Hourly Rate</Label>
                    <Input
                      type="number"
                      value={newRecord.hourly_rate}
                      onChange={(e) => setNewRecord(prev => ({ ...prev, hourly_rate: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Base Pay *</Label>
                  <Input
                    type="number"
                    value={newRecord.base_pay}
                    onChange={(e) => setNewRecord(prev => ({ ...prev, base_pay: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Bonuses</Label>
                    <Input
                      type="number"
                      value={newRecord.bonuses}
                      onChange={(e) => setNewRecord(prev => ({ ...prev, bonuses: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Commissions</Label>
                    <Input
                      type="number"
                      value={newRecord.commissions}
                      onChange={(e) => setNewRecord(prev => ({ ...prev, commissions: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Deductions</Label>
                    <Input
                      type="number"
                      value={newRecord.deductions}
                      onChange={(e) => setNewRecord(prev => ({ ...prev, deductions: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Net Pay:</span>
                    <span className="text-xl font-bold text-green-600">${calculateNetPay().toFixed(2)}</span>
                  </div>
                </div>

                <Button className="w-full" onClick={handleCreatePayroll}>
                  Create Payroll Record
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Payroll</p>
                  <p className="text-2xl font-bold text-orange-600">${pendingTotal.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-full">
                  <Clock className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Paid This Month</p>
                  <p className="text-2xl font-bold text-green-600">${paidThisMonth.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Records</p>
                  <p className="text-2xl font-bold">{payroll.length}</p>
                </div>
                <div className="p-3 bg-primary/10 rounded-full">
                  <Users className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payroll Table */}
        <Card>
          <CardHeader>
            <CardTitle>Payroll Records</CardTitle>
            <CardDescription>All employee payment records</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : payroll.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Net Pay</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payroll.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.employee_name}</TableCell>
                      <TableCell className="capitalize">{record.employee_type}</TableCell>
                      <TableCell>
                        {format(new Date(record.pay_period_start), 'MMM d')} - {format(new Date(record.pay_period_end), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="font-medium">${Number(record.net_pay).toLocaleString()}</TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                      <TableCell>
                        {record.status === 'pending' && (
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => updateStatus({ id: record.id, status: 'approved' })}
                            >
                              Approve
                            </Button>
                            <Button 
                              size="sm"
                              onClick={() => updateStatus({ id: record.id, status: 'paid' })}
                            >
                              Mark Paid
                            </Button>
                          </div>
                        )}
                        {record.status === 'approved' && (
                          <Button 
                            size="sm"
                            onClick={() => updateStatus({ id: record.id, status: 'paid' })}
                          >
                            Mark Paid
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No payroll records yet</p>
                <Button variant="outline" className="mt-4" onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Record
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
