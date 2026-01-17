import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { 
  DollarSign, CheckCircle, AlertTriangle, Clock, 
  TrendingUp, TrendingDown, ArrowRight, FileWarning
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import type { WholesalerPayment, WholesalerDispute } from '@/hooks/useWholesalerIntelligence';

interface FinancialDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'punctuality' | 'avg_days' | 'total_payments' | 'late_payments' | 'dispute';
  payments: WholesalerPayment[];
  disputes: WholesalerDispute[];
  metrics: {
    totalPayments: number;
    punctualityRate: number;
    avgDaysToPayment: number;
    latePaments: number;
  } | null;
  profile: any;
  onResolveDispute?: (disputeId: string) => void;
  onFlagFinanceReview?: () => void;
}

export function FinancialDetailDrawer({
  open,
  onOpenChange,
  type,
  payments,
  disputes,
  metrics,
  profile,
  onResolveDispute,
  onFlagFinanceReview,
}: FinancialDetailDrawerProps) {
  const getTitle = () => {
    switch (type) {
      case 'punctuality': return 'On-Time Payment Rate';
      case 'avg_days': return 'Average Days to Payment';
      case 'total_payments': return 'Payment History';
      case 'late_payments': return 'Late Payments';
      case 'dispute': return 'Active Disputes';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'punctuality': return CheckCircle;
      case 'avg_days': return Clock;
      case 'total_payments': return DollarSign;
      case 'late_payments': return AlertTriangle;
      case 'dispute': return FileWarning;
    }
  };

  const Icon = getIcon();
  
  const latePayments = payments.filter(p => !p.on_time);
  const onTimePayments = payments.filter(p => p.on_time);

  const getPaymentTermsDays = () => {
    switch (profile?.payment_terms) {
      case 'cod': return 0;
      case 'net15': return 15;
      case 'net30': return 30;
      case 'net45': return 45;
      case 'net60': return 60;
      default: return 30;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'medium': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const renderContent = () => {
    switch (type) {
      case 'punctuality':
        return (
          <>
            {/* Summary */}
            <div className="p-6 rounded-xl bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20">
              <div className="text-center">
                <p className="text-4xl font-bold">{metrics?.punctualityRate.toFixed(0)}%</p>
                <p className="text-sm text-muted-foreground mt-1">On-Time Rate</p>
                <Progress value={metrics?.punctualityRate || 0} className="h-2 mt-4" />
                <p className="text-xs text-muted-foreground mt-2">
                  {onTimePayments.length} of {payments.length} payments on time
                </p>
              </div>
            </div>

            {/* Breakdown */}
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-green-400" />
                    <span className="text-sm font-medium text-green-400">On Time</span>
                  </div>
                  <p className="text-2xl font-bold">{onTimePayments.length}</p>
                </div>
                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    <span className="text-sm font-medium text-amber-400">Late</span>
                  </div>
                  <p className="text-2xl font-bold">{latePayments.length}</p>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-muted/30">
                <p className="text-sm font-medium mb-2">Payment Terms</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Current terms</span>
                  <Badge variant="outline">{profile?.payment_terms || 'net30'}</Badge>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted-foreground">Expected within</span>
                  <span className="text-sm font-medium">{getPaymentTermsDays()} days</span>
                </div>
              </div>
            </div>
          </>
        );

      case 'avg_days':
        return (
          <>
            <div className="p-6 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20">
              <div className="text-center">
                <p className="text-4xl font-bold">{metrics?.avgDaysToPayment.toFixed(0)}</p>
                <p className="text-sm text-muted-foreground mt-1">Average Days to Pay</p>
                <div className="flex items-center justify-center gap-2 mt-3">
                  {metrics && metrics.avgDaysToPayment > getPaymentTermsDays() ? (
                    <>
                      <TrendingDown className="h-4 w-4 text-red-400" />
                      <span className="text-xs text-red-400">
                        {(metrics.avgDaysToPayment - getPaymentTermsDays()).toFixed(0)} days over terms
                      </span>
                    </>
                  ) : (
                    <>
                      <TrendingUp className="h-4 w-4 text-green-400" />
                      <span className="text-xs text-green-400">Within terms</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Recent Payments with Days */}
            <div className="mt-6">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
                Recent Payment Speed
              </p>
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {payments.slice(0, 10).map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
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
                        <p className={`text-sm font-medium ${payment.on_time ? 'text-green-400' : 'text-amber-400'}`}>
                          {payment.days_from_invoice ?? '?'} days
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {payment.payment_method || 'Unknown'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </>
        );

      case 'late_payments':
        return (
          <>
            <div className="p-6 rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20">
              <div className="text-center">
                <p className="text-4xl font-bold">{latePayments.length}</p>
                <p className="text-sm text-muted-foreground mt-1">Late Payments</p>
                {latePayments.length > 0 && (
                  <p className="text-xs text-amber-400 mt-2">
                    Total late: ${latePayments.reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            {/* Late Payment List */}
            <div className="mt-6">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
                Late Payment Details
              </p>
              {latePayments.length > 0 ? (
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {latePayments.map((payment) => (
                      <div
                        key={payment.id}
                        className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">${payment.amount.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">
                              Paid: {format(new Date(payment.payment_date), 'MMM d, yyyy')}
                            </p>
                          </div>
                          <Badge className="bg-amber-500/20 text-amber-400">
                            {(payment.days_from_invoice ?? 0) - getPaymentTermsDays()} days late
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-500/50 mb-2" />
                  <p className="text-sm text-muted-foreground">No late payments!</p>
                </div>
              )}
            </div>

            {latePayments.length > 3 && onFlagFinanceReview && (
              <Button 
                className="w-full mt-4" 
                variant="outline"
                onClick={onFlagFinanceReview}
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Flag for Finance Review
              </Button>
            )}
          </>
        );

      case 'dispute':
        const openDisputes = disputes.filter(d => d.status === 'open' || d.status === 'investigating');
        return (
          <>
            <div className="p-6 rounded-xl bg-gradient-to-br from-red-500/10 to-red-500/5 border border-red-500/20">
              <div className="text-center">
                <p className="text-4xl font-bold">{openDisputes.length}</p>
                <p className="text-sm text-muted-foreground mt-1">Open Disputes</p>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
                Active Disputes
              </p>
              {openDisputes.length > 0 ? (
                <ScrollArea className="h-64">
                  <div className="space-y-3">
                    {openDisputes.map((dispute) => {
                      const daysOpen = differenceInDays(new Date(), new Date(dispute.opened_at));
                      return (
                        <div
                          key={dispute.id}
                          className="p-4 rounded-lg bg-red-500/5 border border-red-500/20"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge className={getSeverityColor(dispute.severity)}>
                                {dispute.severity}
                              </Badge>
                              <span className="text-sm font-medium capitalize">
                                {dispute.dispute_type} Issue
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">{daysOpen}d open</span>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">
                            {dispute.description}
                          </p>
                          {onResolveDispute && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => onResolveDispute(dispute.id)}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Resolve
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-500/50 mb-2" />
                  <p className="text-sm text-muted-foreground">No open disputes</p>
                </div>
              )}
            </div>
          </>
        );

      default:
        return (
          <ScrollArea className="h-80">
            <div className="space-y-2">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
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
                  <Badge variant="outline" className="capitalize">
                    {payment.payment_method || 'Unknown'}
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        );
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-muted/50">
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <SheetTitle className="text-xl">{getTitle()}</SheetTitle>
              <p className="text-sm text-muted-foreground">
                Financial behavior analysis
              </p>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6">
          {renderContent()}
        </div>
      </SheetContent>
    </Sheet>
  );
}
