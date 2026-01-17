import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  DollarSign, Clock, AlertTriangle, CheckCircle, 
  TrendingDown, Calendar, FileWarning 
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import type { WholesalerPayment, WholesalerDispute } from '@/hooks/useWholesalerIntelligence';

interface WholesalerFinancialRiskProps {
  payments: WholesalerPayment[];
  disputes: WholesalerDispute[];
  paymentMetrics: {
    totalPayments: number;
    punctualityRate: number;
    avgDaysToPayment: number;
    latePaments: number;
  } | null;
  profile: any;
}

export function WholesalerFinancialRisk({ 
  payments, 
  disputes, 
  paymentMetrics,
  profile 
}: WholesalerFinancialRiskProps) {
  const openDisputes = disputes.filter(d => d.status === 'open' || d.status === 'investigating');
  const resolvedDisputes = disputes.filter(d => d.status === 'resolved');

  const avgResolutionDays = resolvedDisputes.length > 0
    ? resolvedDisputes.reduce((sum, d) => sum + (d.resolution_days || 0), 0) / resolvedDisputes.length
    : 0;

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'medium': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getDisputeTypeIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'payment': return DollarSign;
      case 'quality': return FileWarning;
      case 'delivery': return Clock;
      default: return AlertTriangle;
    }
  };

  // Calculate payment trend
  const paymentTrend = React.useMemo(() => {
    if (payments.length < 4) return null;
    
    const recent = payments.slice(0, Math.floor(payments.length / 2));
    const older = payments.slice(Math.floor(payments.length / 2));
    
    const recentOnTimeRate = recent.filter(p => p.on_time).length / recent.length;
    const olderOnTimeRate = older.filter(p => p.on_time).length / older.length;
    
    if (recentOnTimeRate > olderOnTimeRate + 0.1) return 'improving';
    if (recentOnTimeRate < olderOnTimeRate - 0.1) return 'declining';
    return 'stable';
  }, [payments]);

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-500" />
            Financial Behavior & Risk
          </CardTitle>
          {openDisputes.length > 0 && (
            <Badge variant="destructive" className="animate-pulse">
              {openDisputes.length} Open Disputes
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Payment Metrics */}
        {paymentMetrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <CheckCircle className="h-5 w-5 mx-auto text-green-500 mb-1" />
              <p className="text-2xl font-bold">{paymentMetrics.punctualityRate.toFixed(0)}%</p>
              <p className="text-xs text-muted-foreground">On-Time Rate</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <Clock className="h-5 w-5 mx-auto text-blue-500 mb-1" />
              <p className="text-2xl font-bold">{paymentMetrics.avgDaysToPayment.toFixed(0)}</p>
              <p className="text-xs text-muted-foreground">Avg Days to Pay</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <DollarSign className="h-5 w-5 mx-auto text-purple-500 mb-1" />
              <p className="text-2xl font-bold">{paymentMetrics.totalPayments}</p>
              <p className="text-xs text-muted-foreground">Total Payments</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <AlertTriangle className="h-5 w-5 mx-auto text-amber-500 mb-1" />
              <p className="text-2xl font-bold">{paymentMetrics.latePaments}</p>
              <p className="text-xs text-muted-foreground">Late Payments</p>
            </div>
          </div>
        )}

        {/* Payment Trend Warning */}
        {paymentTrend === 'declining' && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
            <TrendingDown className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-sm font-medium text-red-400">Payment Pattern Declining</p>
              <p className="text-xs text-muted-foreground">
                On-time payment rate has decreased recently — monitor closely
              </p>
            </div>
          </div>
        )}

        {/* Payment Terms vs Reality */}
        {profile?.payment_terms && paymentMetrics && (
          <div className="p-4 rounded-lg bg-muted/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm">Payment Terms Adherence</span>
              <span className="text-sm font-medium uppercase">{profile.payment_terms}</span>
            </div>
            <Progress 
              value={paymentMetrics.punctualityRate} 
              className="h-2"
            />
            <p className="text-xs text-muted-foreground mt-2">
              {paymentMetrics.avgDaysToPayment.toFixed(0)} days average vs {
                profile.payment_terms === 'cod' ? '0' :
                profile.payment_terms === 'net15' ? '15' :
                profile.payment_terms === 'net30' ? '30' :
                profile.payment_terms === 'net45' ? '45' :
                '60'
              } days terms
            </p>
          </div>
        )}

        {/* Active Disputes */}
        {openDisputes.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Active Disputes</p>
            <div className="space-y-2">
              {openDisputes.map((dispute) => {
                const Icon = getDisputeTypeIcon(dispute.dispute_type);
                const daysOpen = differenceInDays(new Date(), new Date(dispute.opened_at));
                
                return (
                  <div 
                    key={dispute.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/20"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 text-red-400" />
                      <div>
                        <p className="text-sm font-medium capitalize">{dispute.dispute_type} Issue</p>
                        <p className="text-xs text-muted-foreground">{dispute.description?.slice(0, 50)}...</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getSeverityColor(dispute.severity)}>
                        {dispute.severity}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{daysOpen}d open</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Dispute History Summary */}
        {disputes.length > 0 && (
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border/50">
            <div className="text-center">
              <p className="text-2xl font-bold">{disputes.length}</p>
              <p className="text-xs text-muted-foreground">Total Disputes</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{resolvedDisputes.length}</p>
              <p className="text-xs text-muted-foreground">Resolved</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{avgResolutionDays.toFixed(0)}</p>
              <p className="text-xs text-muted-foreground">Avg Resolution Days</p>
            </div>
          </div>
        )}

        {/* Recent Payments */}
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Recent Payments</p>
          <ScrollArea className="h-32">
            <div className="space-y-2">
              {payments.slice(0, 5).map((payment) => (
                <div 
                  key={payment.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                >
                  <div className="flex items-center gap-2">
                    {payment.on_time ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium">${payment.amount.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(payment.payment_date), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="text-xs capitalize">
                      {payment.payment_method || 'Unknown'}
                    </Badge>
                    {payment.days_from_invoice !== null && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {payment.days_from_invoice} days
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {payments.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No payment history</p>
              )}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
