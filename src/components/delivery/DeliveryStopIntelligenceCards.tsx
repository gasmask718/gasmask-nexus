import { useDeliveryStopIntelligence } from '@/hooks/useDeliveryStopIntelligence';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Activity,
  PackageCheck,
  MessageSquare,
  StickyNote,
  Phone,
  Bot,
  Mail,
  Pin,
  Clock,
} from 'lucide-react';

interface Props {
  storeId: string;
  routeStopId?: string;
}

function relativeDate(iso: string): string {
  const d = new Date(iso).getTime();
  const diffH = (Date.now() - d) / 3_600_000;
  if (diffH < 1) return 'just now';
  if (diffH < 24) return `${Math.floor(diffH)}h ago`;
  const days = Math.floor(diffH / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function flowBadgeVariant(status: string | null): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (!status) return 'outline';
  if (status === 'active_flow') return 'default';
  if (status === 'recently_quiet') return 'secondary';
  return 'destructive';
}

function confidenceVariant(c: 'high' | 'medium' | 'low' | null) {
  if (c === 'high') return 'default';
  if (c === 'medium') return 'secondary';
  return 'destructive';
}

function ChannelIcon({ channel }: { channel: string }) {
  if (channel === 'bland_ai' || channel === 'ai_call') return <Bot className="h-3 w-3" />;
  if (channel === 'sms' || channel === 'text') return <MessageSquare className="h-3 w-3" />;
  if (channel === 'email') return <Mail className="h-3 w-3" />;
  return <Phone className="h-3 w-3" />;
}

export function DeliveryStopIntelligenceCards({ storeId, routeStopId }: Props) {
  const { data, isLoading } = useDeliveryStopIntelligence(storeId, routeStopId);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-44 w-full" />
        ))}
      </div>
    );
  }
  if (!data) return null;

  const { intelligence, recommendation, recent_comms, special_notes } = data;

  return (
    <TooltipProvider>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* CARD A — Store Intelligence */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Store Intelligence
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Lifetime tubes</span>
              <span className="font-semibold">{intelligence.lifetime_tubes.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Lifetime revenue</span>
              <span className="font-semibold">${intelligence.lifetime_revenue.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Top brand</span>
              <span className="font-medium">{intelligence.top_brand ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last order</span>
              <span>
                {intelligence.days_since_last != null ? `${intelligence.days_since_last} days ago` : '—'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Flow status</span>
              <Badge variant={flowBadgeVariant(intelligence.flow_status)} className="capitalize">
                {intelligence.flow_status?.replace(/_/g, ' ') ?? 'unknown'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* CARD B — Recommended Delivery */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <PackageCheck className="h-4 w-4" />
              Recommended Delivery
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {recommendation.recommended_boxes != null ? (
              <>
                <div className="text-2xl font-bold">
                  {recommendation.recommended_boxes} box{recommendation.recommended_boxes === 1 ? '' : 'es'}
                </div>
                <div className="text-muted-foreground">{recommendation.recommended_brand ?? '—'}</div>
                {recommendation.estimated_revenue != null && (
                  <div className="font-medium">
                    ${Number(recommendation.estimated_revenue).toLocaleString()} est. revenue
                  </div>
                )}
                {recommendation.confidence_level && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant={confidenceVariant(recommendation.confidence_level)} className="uppercase">
                        {recommendation.confidence_level} confidence
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      Based on price-cluster verification of historical invoices.
                    </TooltipContent>
                  </Tooltip>
                )}
                {recommendation.reason && (
                  <p className="text-xs text-muted-foreground pt-1">{recommendation.reason}</p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No recommendation available.</p>
            )}
          </CardContent>
        </Card>

        {/* CARD C — Recent Communications */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Recent Communications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recent_comms.length === 0 && (
              <p className="text-sm text-muted-foreground">No recent contact</p>
            )}
            {recent_comms.map((c) => (
              <div key={c.id} className="text-sm border-l-2 border-muted pl-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <Badge variant="outline" className="gap-1 text-xs">
                    <ChannelIcon channel={c.channel} />
                    <span className="capitalize">{c.channel.replace(/_/g, ' ')}</span>
                    <span className="text-muted-foreground">· {c.direction}</span>
                  </Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {relativeDate(c.created_at)}
                  </span>
                </div>
                <p className="text-sm line-clamp-2">{c.summary || '(no summary)'}</p>
                {c.outcome && (
                  <p className="text-xs text-muted-foreground mt-1">→ {c.outcome}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* CARD D — Special Notes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <StickyNote className="h-4 w-4" />
              Special Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {special_notes.length === 0 && (
              <p className="text-sm text-muted-foreground">No special notes</p>
            )}
            {special_notes.map((n, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <Pin className="h-3 w-3 mt-1 shrink-0 text-muted-foreground" />
                <p className="line-clamp-3">{n.content}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
