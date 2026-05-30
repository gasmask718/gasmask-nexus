import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, DollarSign, Clock, CheckCircle } from 'lucide-react';
import { usePayroll } from '@/hooks/useFinancialEngine';
import { format } from 'date-fns';
import { ExportButton } from '@/components/crud/ExportButton';

export default function Floor5PayrollView() {
  const { payroll, isLoading, updateStatus } = usePayroll();

  const pending = payroll.filter(p => p.status === 'pending' || p.status === 'approved');
  const paid = payroll.filter(p => p.status === 'paid');
  const totalPending = pending.reduce((s, p) => s + Number(p.net_pay), 0);
  const totalPaid = paid.reduce((s, p) => s + Number(p.net_pay), 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'default';
      case 'approved': return 'secondary';
      case 'pending': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-500" />
            Worker Payroll
          </h2>
          <p className="text-sm text-muted-foreground">Track worker pay, approve, and process payments</p>
        </div>
        <ExportButton
          data={payroll as Record<string, unknown>[]}
          filename="payroll"
          columns={[
            { key: 'employee_name', label: 'Worker' },
            { key: 'employee_type', label: 'Type' },
            { key: 'base_pay', label: 'Base Pay' },
            { key: 'net_pay', label: 'Net Pay' },
            { key: 'status', label: 'Status' },
            { key: 'pay_period_start', label: 'Period Start' },
            { key: 'pay_period_end', label: 'Period End' },
          ]}
        />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Pending Payroll</p>
            <p className="text-2xl font-bold text-amber-500">${totalPending.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{pending.length} records</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Paid</p>
            <p className="text-2xl font-bold text-emerald-500">${totalPaid.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{paid.length} records</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Workers</p>
            <p className="text-2xl font-bold">
              {new Set(payroll.map(p => p.employee_name)).size}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Payroll</p>
            <p className="text-2xl font-bold">${(totalPending + totalPaid).toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Actions */}
      {pending.length > 0 && (
        <Card className="border-amber-500/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Pending / Approved — Needs Payment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pending.map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50">
                  <div>
                    <p className="font-medium">{p.employee_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.employee_type} • {format(new Date(p.pay_period_start), 'MMM d, yyyy')} – {format(new Date(p.pay_period_end), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold">${Number(p.net_pay).toLocaleString()}</span>
                    <Badge variant={getStatusColor(p.status) as any}>{p.status}</Badge>
                    {p.status === 'pending' && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus({ id: p.id, status: 'approved' })}>
                        Approve
                      </Button>
                    )}
                    {p.status === 'approved' && (
                      <Button size="sm" onClick={() => updateStatus({ id: p.id, status: 'paid' })}>
                        <DollarSign className="h-3 w-3 mr-1" /> Pay
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Payroll Records */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Payroll Records</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : payroll.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Worker</th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Type</th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Period</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">Hours</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">Base</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">Net Pay</th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payroll.slice(0, 25).map(p => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-accent/30">
                      <td className="py-2 px-2 font-medium">{p.employee_name}</td>
                      <td className="py-2 px-2 text-muted-foreground">{p.employee_type}</td>
                      <td className="py-2 px-2 text-muted-foreground">
                        {format(new Date(p.pay_period_start), 'MMM d, yyyy')} – {format(new Date(p.pay_period_end), 'MMM d, yyyy')}
                      </td>
                      <td className="py-2 px-2 text-right">{p.hours_worked ?? '—'}</td>
                      <td className="py-2 px-2 text-right">${Number(p.base_pay).toLocaleString()}</td>
                      <td className="py-2 px-2 text-right font-medium">${Number(p.net_pay).toLocaleString()}</td>
                      <td className="py-2 px-2">
                        <Badge variant={getStatusColor(p.status) as any} className="text-xs">{p.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">No payroll records yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
