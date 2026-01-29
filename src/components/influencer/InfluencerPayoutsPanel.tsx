import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  useInfluencerPayouts, 
  useInfluencerTrackingLinks, 
  useInfluencerPromoCodes 
} from "@/hooks/useInfluencerAnalytics";
import { DollarSign, Link2, Tag, Clock, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";

interface InfluencerPayoutsPanelProps {
  influencerId: string;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-600',
  approved: 'bg-blue-500/20 text-blue-600',
  paid: 'bg-green-500/20 text-green-600',
  cancelled: 'bg-red-500/20 text-red-600',
  active: 'bg-green-500/20 text-green-600',
  paused: 'bg-yellow-500/20 text-yellow-600',
  expired: 'bg-gray-500/20 text-gray-600',
};

export function InfluencerPayoutsPanel({ influencerId }: InfluencerPayoutsPanelProps) {
  const { data: payouts, isLoading: loadingPayouts } = useInfluencerPayouts(influencerId);
  const { data: trackingLinks, isLoading: loadingLinks } = useInfluencerTrackingLinks(influencerId);
  const { data: promoCodes, isLoading: loadingCodes } = useInfluencerPromoCodes(influencerId);

  const isLoading = loadingPayouts || loadingLinks || loadingCodes;

  // Calculate totals
  const totalPaid = payouts?.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0) || 0;
  const totalPending = payouts?.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0) || 0;
  const totalClicks = trackingLinks?.reduce((sum, l) => sum + l.clicks, 0) || 0;
  const totalPromoRevenue = promoCodes?.reduce((sum, c) => sum + c.total_revenue, 0) || 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="animate-pulse h-32 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm">Total Paid</span>
            </div>
            <p className="text-2xl font-bold text-green-600">${totalPaid.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4 text-yellow-500" />
              <span className="text-sm">Pending</span>
            </div>
            <p className="text-2xl font-bold text-yellow-600">${totalPending.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Link2 className="h-4 w-4 text-blue-500" />
              <span className="text-sm">Link Clicks</span>
            </div>
            <p className="text-2xl font-bold">{totalClicks.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Tag className="h-4 w-4 text-purple-500" />
              <span className="text-sm">Promo Revenue</span>
            </div>
            <p className="text-2xl font-bold">${totalPromoRevenue.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Payout History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Payout History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!payouts || payouts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No payouts recorded
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell className="text-sm">
                      {format(new Date(payout.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>{payout.campaign?.name || 'General'}</TableCell>
                    <TableCell className="capitalize">{payout.payout_type}</TableCell>
                    <TableCell className="text-right font-medium">
                      ${payout.amount.toLocaleString()} {payout.currency}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[payout.status]}>
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

      {/* Tracking Links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Tracking Links
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!trackingLinks || trackingLinks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No tracking links created
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead className="text-right">Conversions</TableHead>
                  <TableHead className="text-right">Conv. Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trackingLinks.map((link) => (
                  <TableRow key={link.id}>
                    <TableCell className="font-medium">{link.link_name}</TableCell>
                    <TableCell>{link.campaign?.name || 'General'}</TableCell>
                    <TableCell className="text-right">{link.clicks.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{link.conversions.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      {link.clicks > 0 
                        ? ((link.conversions / link.clicks) * 100).toFixed(1)
                        : '0'
                      }%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Promo Codes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Promo Codes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!promoCodes || promoCodes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No promo codes assigned
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead className="text-right">Uses</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promoCodes.map((code) => (
                  <TableRow key={code.id}>
                    <TableCell className="font-mono font-bold">{code.code}</TableCell>
                    <TableCell>
                      {code.discount_type === 'percentage' 
                        ? `${code.discount_value}%`
                        : `$${code.discount_value}`
                      }
                    </TableCell>
                    <TableCell>{code.campaign?.name || 'General'}</TableCell>
                    <TableCell className="text-right">{code.current_uses}</TableCell>
                    <TableCell className="text-right font-medium">
                      ${code.total_revenue.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[code.status]}>
                        {code.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
