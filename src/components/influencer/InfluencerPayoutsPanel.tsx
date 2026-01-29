import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  useInfluencerPayouts, 
  useInfluencerTrackingLinks, 
  useInfluencerPromoCodes,
  Payout,
  TrackingLink,
  PromoCode
} from "@/hooks/useInfluencerAnalytics";
import { DollarSign, Link2, Tag, Clock, CheckCircle2, Eye, Plus, Copy, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ComingSoonButton } from "@/components/ui/ComingSoonBadge";
import { useToast } from "@/hooks/use-toast";

interface InfluencerPayoutsPanelProps {
  influencerId: string;
  isEditable?: boolean;
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

type DrilldownType = 'payouts' | 'clicks' | 'promo';

export function InfluencerPayoutsPanel({ influencerId, isEditable = true }: InfluencerPayoutsPanelProps) {
  const { data: payouts, isLoading: loadingPayouts, error: payoutsError, refetch: refetchPayouts } = useInfluencerPayouts(influencerId);
  const { data: trackingLinks, isLoading: loadingLinks, error: linksError, refetch: refetchLinks } = useInfluencerTrackingLinks(influencerId);
  const { data: promoCodes, isLoading: loadingCodes, error: codesError, refetch: refetchCodes } = useInfluencerPromoCodes(influencerId);
  
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownType, setDrilldownType] = useState<DrilldownType>('payouts');
  const { toast } = useToast();

  const isLoading = loadingPayouts || loadingLinks || loadingCodes;
  const hasError = payoutsError || linksError || codesError;

  // Calculate totals
  const totalPaid = payouts?.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0) || 0;
  const totalPending = payouts?.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0) || 0;
  const totalClicks = trackingLinks?.reduce((sum, l) => sum + l.clicks, 0) || 0;
  const totalPromoRevenue = promoCodes?.reduce((sum, c) => sum + c.total_revenue, 0) || 0;

  const openDrilldown = (type: DrilldownType) => {
    setDrilldownType(type);
    setDrilldownOpen(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: "Copied to clipboard." });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton variant="kpi-grid" count={4} />
        <LoadingSkeleton variant="table" count={3} />
      </div>
    );
  }

  if (hasError) {
    return (
      <EmptyState
        title="Failed to load payout data"
        description="We couldn't load the payout information. Please try again."
        actionLabel="Retry"
        onAction={() => {
          refetchPayouts();
          refetchLinks();
          refetchCodes();
        }}
      />
    );
  }

  const hasNoData = !payouts?.length && !trackingLinks?.length && !promoCodes?.length;

  if (hasNoData) {
    return (
      <EmptyState
        icon={DollarSign}
        title="No payout data yet"
        description="Payouts, tracking links, and promo codes will appear here once configured."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards - Clickable */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card 
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => openDrilldown('payouts')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm">Total Paid</span>
            </div>
            <p className="text-2xl font-bold text-green-600">${totalPaid.toLocaleString()}</p>
            <p className="text-xs text-primary mt-1">View history →</p>
          </CardContent>
        </Card>
        <Card 
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => openDrilldown('payouts')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4 text-yellow-500" />
              <span className="text-sm">Pending</span>
            </div>
            <p className="text-2xl font-bold text-yellow-600">${totalPending.toLocaleString()}</p>
            <p className="text-xs text-primary mt-1">View pending →</p>
          </CardContent>
        </Card>
        <Card 
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => openDrilldown('clicks')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Link2 className="h-4 w-4 text-blue-500" />
              <span className="text-sm">Link Clicks</span>
            </div>
            <p className="text-2xl font-bold">{totalClicks.toLocaleString()}</p>
            <p className="text-xs text-primary mt-1">View links →</p>
          </CardContent>
        </Card>
        <Card 
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => openDrilldown('promo')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Tag className="h-4 w-4 text-purple-500" />
              <span className="text-sm">Promo Revenue</span>
            </div>
            <p className="text-2xl font-bold">${totalPromoRevenue.toLocaleString()}</p>
            <p className="text-xs text-primary mt-1">View codes →</p>
          </CardContent>
        </Card>
      </div>

      {/* Payout History Preview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Recent Payouts
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => openDrilldown('payouts')}>
              <Eye className="h-4 w-4 mr-2" />
              View All
            </Button>
            {isEditable && (
              <ComingSoonButton icon={Plus} size="sm">
                Record Payout
              </ComingSoonButton>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!payouts || payouts.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              No payouts recorded yet
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
                {payouts.slice(0, 5).map((payout) => (
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

      {/* Tracking Links Preview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Tracking Links
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => openDrilldown('clicks')}>
              <Eye className="h-4 w-4 mr-2" />
              View All
            </Button>
            {isEditable && (
              <ComingSoonButton icon={Plus} size="sm">
                Create Link
              </ComingSoonButton>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!trackingLinks || trackingLinks.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              No tracking links created yet
            </div>
          ) : (
            <div className="space-y-2">
              {trackingLinks.slice(0, 3).map((link) => (
                <div 
                  key={link.id} 
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div>
                    <p className="font-medium">{link.link_name}</p>
                    <p className="text-xs text-muted-foreground">{link.campaign?.name || 'General'}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-medium">{link.clicks.toLocaleString()} clicks</p>
                      <p className="text-xs text-muted-foreground">
                        {link.conversions} conversions ({link.clicks > 0 ? ((link.conversions / link.clicks) * 100).toFixed(1) : 0}%)
                      </p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => copyToClipboard(link.tracking_url)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drilldown Dialog */}
      <Dialog open={drilldownOpen} onOpenChange={setDrilldownOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {drilldownType === 'payouts' && 'Payout History'}
              {drilldownType === 'clicks' && 'Tracking Links'}
              {drilldownType === 'promo' && 'Promo Codes'}
            </DialogTitle>
          </DialogHeader>

          {drilldownType === 'payouts' && payouts && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Paid At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell>{format(new Date(payout.created_at), 'MMM d, yyyy')}</TableCell>
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
                    <TableCell>
                      {payout.paid_at 
                        ? format(new Date(payout.paid_at), 'MMM d, yyyy')
                        : '—'
                      }
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {drilldownType === 'clicks' && trackingLinks && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead className="text-right">Conversions</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trackingLinks.map((link) => (
                  <TableRow key={link.id}>
                    <TableCell className="font-medium">{link.link_name}</TableCell>
                    <TableCell>{link.campaign?.name || 'General'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded max-w-[200px] truncate">
                          {link.tracking_url}
                        </code>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(link.tracking_url)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{link.clicks.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{link.conversions.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      {link.clicks > 0 ? ((link.conversions / link.clicks) * 100).toFixed(1) : 0}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {drilldownType === 'promo' && promoCodes && (
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
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="font-mono font-bold">{code.code}</code>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(code.code)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
