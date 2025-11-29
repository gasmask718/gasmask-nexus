import { Link } from "react-router-dom";
import { useWholesalerPayouts } from "@/services/wholesaler/useWholesalerPayouts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HudCard } from "@/components/portal/HudCard";
import { HudMetric } from "@/components/portal/HudMetric";
import { 
  ArrowLeft, DollarSign, TrendingUp, Wallet, Receipt, 
  Download, CreditCard, Clock, CheckCircle
} from "lucide-react";

export default function WholesalerFinance() {
  const { payouts, financialSummary, isLoading, requestPayout, isRequesting } = useWholesalerPayouts();

  const canRequestPayout = (financialSummary?.pendingPayout || 0) >= 50;

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/portal/wholesaler">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Finance & Payouts</h1>
            <p className="text-muted-foreground">Track your earnings and request payouts</p>
          </div>
        </div>
        <Button 
          onClick={() => requestPayout()} 
          disabled={!canRequestPayout || isRequesting}
        >
          <Wallet className="h-4 w-4 mr-2" />
          Request Payout
        </Button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <HudCard variant="green" glow>
          <HudMetric
            label="Total Earnings"
            value={`$${(financialSummary?.totalEarnings || 0).toFixed(2)}`}
            icon={<DollarSign className="h-4 w-4" />}
            variant="green"
          />
        </HudCard>

        <HudCard variant="cyan">
          <HudMetric
            label="Pending Payout"
            value={`$${(financialSummary?.pendingPayout || 0).toFixed(2)}`}
            icon={<Clock className="h-4 w-4" />}
            variant="cyan"
          />
        </HudCard>

        <HudCard variant="purple">
          <HudMetric
            label="Total Orders"
            value={financialSummary?.totalOrders || 0}
            icon={<Receipt className="h-4 w-4" />}
            variant="purple"
          />
        </HudCard>

        <HudCard variant="amber">
          <HudMetric
            label="Avg Order Value"
            value={`$${(financialSummary?.averageOrderValue || 0).toFixed(2)}`}
            icon={<TrendingUp className="h-4 w-4" />}
            variant="amber"
          />
        </HudCard>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Payouts */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Payout History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : payouts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Wallet className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No payouts yet</p>
                <p className="text-sm">Your payouts will appear here</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Fee</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.map((payout) => (
                    <TableRow key={payout.id}>
                      <TableCell>
                        {new Date(payout.created_at || '').toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {payout.period_start && payout.period_end ? (
                          `${new Date(payout.period_start).toLocaleDateString()} - ${new Date(payout.period_end).toLocaleDateString()}`
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        ${Number(payout.amount || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        -${Number(payout.platform_fee || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${Number(payout.net_amount || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={
                          payout.status === 'paid' ? 'default' :
                          payout.status === 'pending' ? 'secondary' :
                          'outline'
                        }>
                          {payout.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Payout Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payout Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Platform Fee</span>
                <span>10%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Minimum Payout</span>
                <span>$50.00</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Payout Schedule</span>
                <span>On Request</span>
              </div>
              <hr />
              <div className="flex items-center justify-between">
                <span className="font-medium">Available for Payout</span>
                <span className="text-lg font-bold text-green-600">
                  ${(financialSummary?.pendingPayout || 0).toFixed(2)}
                </span>
              </div>
              {!canRequestPayout && (
                <p className="text-xs text-muted-foreground">
                  Minimum $50 required to request payout
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Payout Method
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-3 bg-muted rounded-lg text-sm">
                <p className="font-medium">Bank Transfer</p>
                <p className="text-muted-foreground">Configure in settings</p>
              </div>
              <Button variant="outline" size="sm" className="w-full mt-3" asChild>
                <Link to="/portal/wholesaler/settings">Update Payment Info</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
