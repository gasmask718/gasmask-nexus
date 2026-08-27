import { Link } from "react-router-dom";
import { useWholesalerLedger } from "@/services/wholesaler/useWholesalerLedger";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HudCard } from "@/components/portal/HudCard";
import { HudMetric } from "@/components/portal/HudMetric";
import { WholesalerStripeConnectCard } from "@/components/portal/wholesaler/WholesalerStripeConnectCard";
import {
  ArrowLeft, DollarSign, Wallet, Receipt, Clock, CreditCard, Info, AlertTriangle, Lock,
} from "lucide-react";

const money = (n: number) => `$${n.toFixed(2)}`;

/**
 * Reads dd_split_ledger — the system that actually moves the money — not the
 * empty wholesaler_payouts table. Every figure on this page is derived from a
 * per-order row the supplier can see broken out: sale → platform fee →
 * processing → net. There is no "Request Payout": transfers are pushed
 * automatically on approval through Stripe Connect.
 */
export default function WholesalerFinance() {
  const { entries, summary, isLoading, error } = useWholesalerLedger();

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/portal/wholesaler">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Finance & Payouts</h1>
          <p className="text-muted-foreground">Every settled order, broken down line by line</p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Could not load your ledger</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      <div className="mb-6">
        <WholesalerStripeConnectCard />
      </div>

      {!isLoading && !summary.hasSettledOrders ? (
        <Card className="mb-8">
          <CardContent className="py-12 text-center space-y-2">
            <Receipt className="h-12 w-12 mx-auto opacity-40" />
            <p className="text-lg font-semibold">No settled orders yet</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Nothing has settled to your account, so there is no earnings figure to show.
              As soon as an order is paid and fulfilled, the full breakdown appears here —
              sale price, platform fee, processing, and what lands in your bank.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <HudCard variant="green" glow>
            <HudMetric
              label="Net Earned (settled)"
              value={money(summary.netTotal)}
              icon={<DollarSign className="h-4 w-4" />}
              variant="green"
            />
          </HudCard>
          <HudCard variant="cyan">
            <HudMetric
              label="Paid Out"
              value={money(summary.paidOutTotal)}
              icon={<Wallet className="h-4 w-4" />}
              variant="cyan"
            />
          </HudCard>
          <HudCard variant="amber">
            <HudMetric
              label="Awaiting Transfer"
              value={money(summary.awaitingTransferTotal)}
              icon={<Clock className="h-4 w-4" />}
              variant="amber"
            />
          </HudCard>
          <HudCard variant="purple">
            <HudMetric
              label="Reserve Held"
              value={money(summary.reserveHeldTotal)}
              icon={<Lock className="h-4 w-4" />}
              variant="purple"
            />
          </HudCard>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Per-order breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading…</div>
            ) : entries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No settled orders yet</p>
                <p className="text-sm">Each settled order will show its full split here.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead className="text-right">Sale</TableHead>
                    <TableHead className="text-right">Platform fee</TableHead>
                    <TableHead className="text-right">Processing</TableHead>
                    <TableHead className="text-right">Reserve</TableHead>
                    <TableHead className="text-right">Net to you</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{e.created_at ? new Date(e.created_at).toLocaleDateString() : '—'}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {e.order_id ? e.order_id.slice(0, 8) : '—'}
                        {e.entry_type && e.entry_type !== 'sale' && (
                          <Badge variant="outline" className="ml-2 text-[10px]">{e.entry_type}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{money(e.gross)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        -{money(e.platformFee)}
                        {e.marginPct != null && <span className="ml-1 text-[10px]">({e.marginPct}%)</span>}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">-{money(e.processingFee)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {e.reserveHeld - e.reserveReleased > 0 ? (
                          <span title={e.reserveReleaseAt ? `Releases ${new Date(e.reserveReleaseAt).toLocaleDateString()}` : undefined}>
                            -{money(e.reserveHeld - e.reserveReleased)}
                          </span>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-medium">{money(e.net)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={e.stripe_transfer_id ? 'default' : 'secondary'}>
                          {e.stripe_transfer_id ? 'transferred' : (e.status || 'pending')}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="h-4 w-4" /> Reserve
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {summary.rollingReserveEnabled ? (
                <>
                  <p className="text-muted-foreground">
                    A rolling reserve is held on each settled order to cover returns, chargebacks
                    and delivery disputes. It releases automatically — you do not request it.
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Hold period</span>
                    <span>{summary.reserveHoldDays != null ? `${summary.reserveHoldDays} days` : 'set by admin'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Currently held</span>
                    <span className="font-semibold">{money(summary.reserveHeldTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Released to date</span>
                    <span>{money(summary.reserveReleasedTotal)}</span>
                  </div>
                  {entries.filter(e => e.reserveReleaseAt).slice(0, 5).map(e => (
                    <div key={e.id} className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Order {e.order_id?.slice(0, 8)}</span>
                      <span>releases {new Date(e.reserveReleaseAt as string).toLocaleDateString()}</span>
                    </div>
                  ))}
                </>
              ) : (
                <p className="text-muted-foreground">No reserve is being held on your orders.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> How you get paid
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Automatic transfer — nothing to request</AlertTitle>
                <AlertDescription className="text-xs">
                  Once an order is approved for payout, the net amount is transferred to your
                  connected Stripe account on its own. There is no payout request and no minimum.
                </AlertDescription>
              </Alert>
              <Button variant="outline" size="sm" className="w-full" asChild>
                <Link to="/portal/wholesaler/settings">Update payment details</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
