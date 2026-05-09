// ═══════════════════════════════════════════════════════════════════════════════
// AUTO DIALER → PRIOR CUSTOMERS TAB
// Lists prior customers from v_prior_customer_segments with bucket chip filters.
// Shares usePriorCustomerSegmentMap with Follow-Up Manager / Campaign Dial / Manual Calls.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Sparkles } from 'lucide-react';
import {
  usePriorCustomerSegmentMap,
  FLOW_STATUS_META,
  FLOW_STATUS_ORDER,
  type FlowStatus,
} from '@/hooks/usePriorCustomerSegmentMap';

export default function DialerPriorCustomersTab() {
  const { segments, counts, isLoading } = usePriorCustomerSegmentMap();
  const [bucket, setBucket] = useState<FlowStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    return segments
      .filter(s => bucket === 'all' || s.flow_status === bucket)
      .filter(s => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (s.store_name?.toLowerCase().includes(q)) || (s as any).phone?.includes(search);
      })
      .sort((a, b) => (b.lifetime_tubes || 0) - (a.lifetime_tubes || 0));
  }, [segments, bucket, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Prior Customers</h2>
        <Badge variant="secondary">{counts.total} total</Badge>
      </div>

      {/* Bucket chips */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={bucket === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setBucket('all')}
        >
          All <Badge variant="secondary" className="ml-2">{counts.total}</Badge>
        </Button>
        {FLOW_STATUS_ORDER.map(s => {
          const meta = FLOW_STATUS_META[s];
          const active = bucket === s;
          return (
            <Button
              key={s}
              variant={active ? 'default' : 'outline'}
              size="sm"
              onClick={() => setBucket(s)}
              className={active ? '' : meta.color}
            >
              {meta.emoji} {meta.label}
              <Badge variant="secondary" className="ml-2">{counts[s]}</Badge>
            </Button>
          );
        })}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 max-w-md">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search store name or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading prior customers...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No prior customers match.</div>
      ) : (
        <div className="grid gap-2">
          {filtered.map(seg => {
            const meta = FLOW_STATUS_META[seg.flow_status];
            const phone = (seg as any).phone as string | null;
            return (
              <Card key={seg.store_id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{seg.store_name || '—'}</span>
                      <Badge variant="outline" className={meta.color}>
                        {meta.emoji} {meta.label}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-3">
                      {phone && <span>📞 {phone}</span>}
                      <span>{seg.lifetime_tubes || 0} lifetime tubes</span>
                      <span>{seg.invoice_count || 0} orders</span>
                      {seg.days_since_last_order != null && (
                        <span>{seg.days_since_last_order}d since last order</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
