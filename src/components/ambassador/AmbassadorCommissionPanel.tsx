import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Wallet, Clock, CheckCircle2, DollarSign, 
  AlertTriangle, Calendar, ArrowRight
} from "lucide-react";
import { format } from "date-fns";
import type { AmbassadorMetrics } from "@/hooks/useAmbassadorIntelligence";

interface AmbassadorCommissionPanelProps {
  metrics: AmbassadorMetrics;
  commissions: any[];
  onViewCommissionDetails?: (commissionId: string) => void;
  onRequestPayout?: () => void;
}

export function AmbassadorCommissionPanel({ 
  metrics, 
  commissions,
  onViewCommissionDetails,
  onRequestPayout,
}: AmbassadorCommissionPanelProps) {
  const pendingCommissions = commissions.filter(c => c.status === 'pending');
  const paidCommissions = commissions.filter(c => c.status === 'paid');
  const disputedCommissions = commissions.filter(c => c.status === 'disputed');

  return (
    <div className="space-y-6">
      {/* Commission Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-900/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-green-400">
              <DollarSign className="h-5 w-5" />
              <span className="text-sm">Total Earned</span>
            </div>
            <div className="text-2xl font-bold text-foreground mt-2">
              ${metrics.totalEarnings.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">Lifetime earnings</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-900/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-amber-400">
              <Clock className="h-5 w-5" />
              <span className="text-sm">Pending</span>
            </div>
            <div className="text-2xl font-bold text-foreground mt-2">
              ${metrics.pendingEarnings.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">
              {pendingCommissions.length} transactions
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-900/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-blue-400">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm">Paid Out</span>
            </div>
            <div className="text-2xl font-bold text-foreground mt-2">
              ${metrics.paidEarnings.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">
              {paidCommissions.length} payouts
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-900/5 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-purple-400">
              <Wallet className="h-5 w-5" />
              <span className="text-sm">Online Commission</span>
            </div>
            <div className="text-2xl font-bold text-foreground mt-2">
              ${metrics.onlineCommission.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">From tracking code</div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Payout Action */}
      {metrics.pendingEarnings > 0 && (
        <Card className="bg-gradient-to-r from-amber-500/10 to-green-500/10 border-amber-500/30">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-amber-500/20">
                <Wallet className="h-6 w-6 text-amber-400" />
              </div>
              <div>
                <div className="font-semibold">Ready for Payout</div>
                <div className="text-sm text-muted-foreground">
                  ${metrics.pendingEarnings.toLocaleString()} pending from {pendingCommissions.length} transactions
                </div>
              </div>
            </div>
            <Button onClick={onRequestPayout} className="gap-2">
              Request Payout <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Commission History */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-amber-400" />
            Commission History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {commissions.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">
              No commissions recorded yet
            </p>
          ) : (
            <div className="space-y-3">
              {commissions.slice(0, 10).map((commission: any) => (
                <div
                  key={commission.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => onViewCommissionDetails?.(commission.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      commission.status === 'paid' 
                        ? 'bg-green-500/10' 
                        : commission.status === 'pending'
                        ? 'bg-amber-500/10'
                        : 'bg-red-500/10'
                    }`}>
                      {commission.status === 'paid' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-400" />
                      ) : commission.status === 'pending' ? (
                        <Clock className="h-4 w-4 text-amber-400" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-400" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium capitalize">
                        {commission.entity_type?.replace('_', ' ') || 'Commission'}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(commission.created_at), 'MMM d, yyyy')}
                        {commission.notes && (
                          <span className="text-muted-foreground">• {commission.notes}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold ${
                      commission.status === 'paid' ? 'text-green-400' : 'text-foreground'
                    }`}>
                      ${Number(commission.amount || 0).toLocaleString()}
                    </div>
                    <Badge 
                      variant={
                        commission.status === 'paid' ? 'default' : 
                        commission.status === 'pending' ? 'secondary' : 
                        'destructive'
                      }
                    >
                      {commission.status}
                    </Badge>
                  </div>
                </div>
              ))}

              {commissions.length > 10 && (
                <div className="text-center text-sm text-muted-foreground pt-2">
                  Showing 10 of {commissions.length} transactions
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
