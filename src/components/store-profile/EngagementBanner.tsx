import { useNavigate } from 'react-router-dom';
import { Phone, MessageSquare, Package, Bot, CheckCircle2, ClipboardList, Footprints } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePriorCustomerSegmentMap, FLOW_STATUS_META, type FlowStatus } from '@/hooks/usePriorCustomerSegmentMap';
import { useStoreTubeSummary } from '@/hooks/useStoreTubeSummary';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Props { storeId: string }

const fmt = (n: number | null | undefined) => Number(n || 0).toLocaleString();

const STYLES: Record<FlowStatus, { wrap: string; header: string; titleEmoji: string; title: string }> = {
  active_flow:    { wrap: 'border-emerald-500/40 bg-emerald-500/5', header: 'text-emerald-700', titleEmoji: '🟢', title: 'ACTIVE CUSTOMER' },
  recently_quiet: { wrap: 'border-amber-500/40 bg-amber-500/5',     header: 'text-amber-700',  titleEmoji: '🟡', title: 'RECENTLY QUIET — INTERVENTION WINDOW' },
  cold:           { wrap: 'border-red-500/40 bg-red-500/5',         header: 'text-red-700',     titleEmoji: '🔴', title: 'REACTIVATION TARGET' },
  long_dormant:   { wrap: 'border-zinc-500/40 bg-zinc-500/5',       header: 'text-zinc-700',    titleEmoji: '⚫', title: 'LONG DORMANT — REVIVAL OPPORTUNITY' },
};

export function EngagementBanner({ storeId }: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { map: segMap, isLoading } = usePriorCustomerSegmentMap();
  const tubeSummary = useStoreTubeSummary(storeId);

  // Fetch store phone for tel: links (banner is conditional on prior customer)
  const phoneQuery = useQuery({
    queryKey: ['store-phone', storeId],
    enabled: !!storeId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('stores').select('phone, name').eq('id', storeId).maybeSingle();
      if (error) throw error;
      return data as { phone: string | null; name: string | null } | null;
    },
  });

  if (isLoading) return null;

  const seg = segMap.get(storeId);
  if (!seg || !seg.flow_status) return null;

  const flow = seg.flow_status as FlowStatus;
  const style = STYLES[flow];
  const meta = FLOW_STATUS_META[flow];
  const days = seg.days_since_last_order ?? 0;
  const tubes = seg.lifetime_tubes ?? 0;
  const topBrand = tubeSummary.data?.top_brand || null;
  const phone = phoneQuery.data?.phone || (seg as any).phone || null;
  const storeName = phoneQuery.data?.name || seg.store_name || 'this customer';

  const body = flow === 'active_flow'
    ? `Last delivery: ${days}d ago • Lifetime: ${fmt(tubes)} tubes`
    : flow === 'recently_quiet'
      ? `${days}d since last order. Lifetime: ${fmt(tubes)}. Light touch may prevent going cold.`
      : flow === 'cold'
        ? `${days}d cold • ${fmt(tubes)} lifetime${topBrand ? ` • Top brand: ${topBrand}` : ''}`
        : `${days}d dormant • ${fmt(tubes)} lifetime tubes from prior relationship • Worth reigniting?`;

  const handleSms = () => {
    navigate(`/communication/messaging?storeId=${storeId}&intent=${flow}`);
  };
  const handleSchedule = () => {
    navigate(`/communication/follow-ups?storeId=${storeId}&intent=schedule`);
  };
  const handleAddCampaign = async () => {
    try {
      const { error } = await supabase.from('campaign_queue_items' as any).insert({
        store_id: storeId,
        flow_status: flow,
        intent: 'reactivation',
        queued_at: new Date().toISOString(),
      });
      if (error) throw error;
      toast({ title: 'Added to AI Campaign', description: `${storeName} queued for reactivation.` });
    } catch (e: any) {
      toast({ title: 'Could not queue', description: e?.message || 'Failed to add to campaign', variant: 'destructive' });
    }
  };
  const handleMarkReactivated = async () => {
    try {
      const { error } = await supabase.from('stores').update({
        status: 'active',
        reactivated_at: new Date().toISOString(),
      }).eq('id', storeId);
      if (error) throw error;
      toast({ title: 'Marked reactivated', description: storeName });
      qc.invalidateQueries({ queryKey: ['prior-customer-segments'] });
      qc.invalidateQueries({ queryKey: ['store-tube-summary', storeId] });
    } catch (e: any) {
      toast({ title: 'Update failed', description: e?.message, variant: 'destructive' });
    }
  };
  const handleMarkDefunct = async () => {
    if (!confirm(`Mark ${storeName} as defunct?`)) return;
    try {
      const { error } = await supabase.from('stores').update({ status: 'dead' }).eq('id', storeId);
      if (error) throw error;
      toast({ title: 'Marked defunct', description: storeName });
      qc.invalidateQueries({ queryKey: ['prior-customer-segments'] });
    } catch (e: any) {
      toast({ title: 'Update failed', description: e?.message, variant: 'destructive' });
    }
  };

  return (
    <Card className={cn('border-2', style.wrap)}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className={cn('text-sm font-bold uppercase tracking-wide flex items-center gap-2', style.header)}>
            <span>{style.titleEmoji}</span>
            <span>{style.title}</span>
          </div>
          <Badge variant="outline" className={meta.color}>{meta.emoji} {meta.label}</Badge>
        </div>
        <p className="text-sm text-foreground/80">{body}</p>
        <div className="flex flex-wrap gap-2">
          {phone && (
            <Button size="sm" asChild>
              <a href={`tel:${phone}`}>
                <Phone className="h-4 w-4" />
                {flow === 'active_flow' ? 'Check-In Call' : flow === 'cold' ? 'Reactivation Call' : flow === 'long_dormant' ? 'Revival Call' : 'Call to Reorder'}
              </a>
            </Button>
          )}
          {phone && (
            <Button size="sm" variant="secondary" onClick={handleSms}>
              <MessageSquare className="h-4 w-4" /> SMS
            </Button>
          )}
          {(flow === 'active_flow' || flow === 'recently_quiet') && (
            <Button size="sm" variant="outline" onClick={handleSchedule}>
              <Package className="h-4 w-4" /> Schedule Delivery
            </Button>
          )}
          {flow === 'cold' && (
            <>
              <Button size="sm" variant="outline" onClick={handleAddCampaign}>
                <Bot className="h-4 w-4" /> Add to AI Campaign
              </Button>
              <Button size="sm" variant="outline" onClick={handleMarkReactivated}>
                <CheckCircle2 className="h-4 w-4" /> Mark Reactivated
              </Button>
            </>
          )}
          {flow === 'long_dormant' && (
            <>
              <Button size="sm" variant="outline" onClick={handleSchedule}>
                <Footprints className="h-4 w-4" /> Schedule Field Visit
              </Button>
              <Button size="sm" variant="outline" onClick={handleMarkDefunct}>
                <ClipboardList className="h-4 w-4" /> Mark Defunct
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default EngagementBanner;
