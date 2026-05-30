/**
 * StoreContextSidebar — slide-out panel revealing full context for a store.
 * Used inside AmbassadorCommunications (Messages + Call Log tabs).
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import {
  X, ChevronRight, Phone, MapPin, Calendar, Package, History, MessageSquare,
  StickyNote, AlertTriangle, AlertCircle, PhoneCall, Moon, ShoppingCart,
  ArrowRight, Globe, Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  useStoreContext, useUpdateStoreNotes, useUpdateStoreStatus, useScheduleVisit,
} from '@/hooks/useStoreContext';
import { toast } from 'sonner';

interface Props {
  storeId: string | null;
  open: boolean;
  onClose: () => void;
  onCall?: () => void;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  active: { label: 'Active', cls: 'bg-green-500/15 text-green-700 border-green-500/30' },
  dormant: { label: 'Dormant', cls: 'bg-gray-500/15 text-gray-700 border-gray-500/30' },
  blacklisted: { label: 'Blacklisted', cls: 'bg-red-500/15 text-red-700 border-red-500/30' },
};

function formatCurrency(n: number | null | undefined) {
  return `$${Math.round(Number(n || 0)).toLocaleString()}`;
}

export function StoreContextSidebar({ storeId, open, onClose, onCall }: Props) {
  const navigate = useNavigate();
  const { data: ctx, isLoading } = useStoreContext(storeId);
  const updateNotes = useUpdateStoreNotes();
  const updateStatus = useUpdateStoreStatus();
  const scheduleVisit = useScheduleVisit();

  const [notesDraft, setNotesDraft] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);
  const [confirmDormant, setConfirmDormant] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(undefined);
  const [scheduleNotes, setScheduleNotes] = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setNotesDraft(ctx?.store?.notes || '');
    setNotesDirty(false);
  }, [ctx?.store?.id, ctx?.store?.notes]);

  const debouncedSave = useCallback((value: string) => {
    if (!storeId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      updateNotes.mutate({ storeId, notes: value }, {
        onSuccess: () => setNotesDirty(false),
      });
    }, 800);
  }, [storeId, updateNotes]);

  const onNotesChange = (v: string) => {
    setNotesDraft(v);
    setNotesDirty(true);
    debouncedSave(v);
  };

  if (!open) return null;

  const store = ctx?.store;
  const stats = ctx?.stats;
  const daysSinceVisit = store?.last_visit_at
    ? Math.floor((Date.now() - new Date(store.last_visit_at).getTime()) / (24 * 3600 * 1000))
    : null;

  const visitBanner = (() => {
    if (daysSinceVisit == null) return null;
    if (daysSinceVisit > 30) return { tone: 'red', icon: AlertCircle, msg: `🚨 Overdue visit — ${daysSinceVisit} days. Store may go dormant.` };
    if (daysSinceVisit > 14) return { tone: 'orange', icon: AlertTriangle, msg: `⚠️ Last visit ${daysSinceVisit} days ago — schedule visit?` };
    return null;
  })();

  const statusInfo = STATUS_BADGE[(store?.status || 'active').toLowerCase()] || STATUS_BADGE.active;

  const handleSchedule = async () => {
    if (!storeId || !scheduleDate) return;
    await scheduleVisit.mutateAsync({ storeId, scheduledFor: scheduleDate, notes: scheduleNotes });
    setScheduleOpen(false);
    setScheduleDate(undefined);
    setScheduleNotes('');
  };

  const handleMarkDormant = async () => {
    if (!storeId) return;
    await updateStatus.mutateAsync({ storeId, status: 'dormant' });
    setConfirmDormant(false);
  };

  return (
    <>
      <aside
        className={cn(
          'flex-shrink-0 bg-card border-l border-border h-full flex flex-col overflow-hidden',
          'transition-all duration-300 ease-in-out',
          'w-full md:w-[420px]',
        )}
        aria-label="Store context"
      >
        <div className="flex items-center justify-between p-3 border-b">
          <span className="text-sm font-medium text-muted-foreground">Store Context</span>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close sidebar">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {isLoading || !store ? (
              <SidebarSkeleton />
            ) : (
              <>
                {/* Header */}
                <div className="flex items-start gap-3">
                  <Avatar className="h-16 w-16">
                    {store.photo_url && <AvatarImage src={store.photo_url} alt={store.store_name || 'Store'} />}
                    <AvatarFallback className="text-lg">
                      {(store.store_name || 'ST').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg leading-tight truncate">{store.store_name || 'Unnamed Store'}</h3>
                    {store.owner_name_arabic && (
                      <p dir="rtl" className="text-sm text-muted-foreground">{store.owner_name_arabic}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className={cn('text-xs', statusInfo.cls)}>
                        {statusInfo.label}
                      </Badge>
                      {store.language_preference && (
                        <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {store.language_preference.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Contact row */}
                <div className="space-y-1.5 text-sm">
                  {store.owner_name && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Owner:</span>
                      <span className="font-medium">{store.owner_name}</span>
                      {store.phone && (
                        <button
                          onClick={onCall}
                          className="ml-auto text-primary hover:underline inline-flex items-center gap-1 text-xs"
                        >
                          <Phone className="h-3 w-3" />
                          {store.phone}
                        </button>
                      )}
                    </div>
                  )}
                  {(store.address || store.city) && (
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                      <span className="text-xs">
                        {[store.address, store.city, store.state, store.zip].filter(Boolean).join(', ')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Quick stats 2x2 */}
                <div className="grid grid-cols-2 gap-2">
                  <StatTile label="Total Orders" value={stats?.total_orders ?? 0} sub="lifetime" />
                  <StatTile label="Avg Order" value={formatCurrency(stats?.avg_order_value)} sub="per order" />
                  <StatTile
                    label="Last Order"
                    value={stats?.last_order_date
                      ? formatDistanceToNow(new Date(stats.last_order_date), { addSuffix: true })
                      : '—'}
                    sub={stats?.last_order_amount ? formatCurrency(stats.last_order_amount) : ''}
                  />
                  <StatTile
                    label="Balance"
                    value={(stats?.outstanding_balance || 0) > 0
                      ? formatCurrency(stats?.outstanding_balance)
                      : 'Paid'}
                    sub=""
                    tone={(stats?.outstanding_balance || 0) > 0 ? 'danger' : 'success'}
                  />
                </div>

                {/* Visit banner */}
                {visitBanner && (
                  <button
                    onClick={() => setScheduleOpen(true)}
                    className={cn(
                      'w-full text-left rounded-md border p-3 text-sm font-medium transition-colors',
                      visitBanner.tone === 'red'
                        ? 'border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15'
                        : 'border-orange-500/40 bg-orange-500/10 text-orange-700 hover:bg-orange-500/15',
                    )}
                  >
                    {visitBanner.msg}
                  </button>
                )}

                {/* Accordion sections */}
                <Accordion type="multiple" defaultValue={['orders']} className="w-full">
                  <AccordionItem value="orders">
                    <AccordionTrigger className="text-sm">
                      <span className="flex items-center gap-2">
                        <Package className="h-4 w-4" /> Recent Orders
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      {ctx!.recent_orders.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">No orders yet.</p>
                      ) : (
                        <div className="space-y-1">
                          {ctx!.recent_orders.map((o) => (
                            <button
                              key={o.id}
                              onClick={() => navigate(`/orders/${o.id}`)}
                              className="w-full flex items-center justify-between gap-2 p-2 rounded hover:bg-muted text-left text-xs"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="font-medium">
                                  {o.placed_at ? format(new Date(o.placed_at), 'MMM d, yyyy') : 'Pending'}
                                </div>
                                <div className="text-muted-foreground">{o.item_count} items</div>
                              </div>
                              <div className="text-right">
                                <div className="font-semibold">{formatCurrency(o.total_amount)}</div>
                                <Badge variant="outline" className="text-[10px] h-4">
                                  {o.payment_status || o.order_status}
                                </Badge>
                              </div>
                            </button>
                          ))}
                          <button
                            onClick={() => navigate(`/ambassador/stores/${storeId}`)}
                            className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
                          >
                            View all orders <ArrowRight className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="products">
                    <AccordionTrigger className="text-sm">
                      <span className="flex items-center gap-2">
                        <ShoppingCart className="h-4 w-4" /> Preferred Products
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      {ctx!.preferred_products.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">No purchase pattern yet.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {ctx!.preferred_products.map((p) => (
                            <div key={p.product_id} className="flex items-center justify-between gap-2 p-2 rounded border text-xs">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{p.product_name}</div>
                                <div className="text-muted-foreground">
                                  Ordered {p.times_ordered}× · last {p.last_ordered_at ? formatDistanceToNow(new Date(p.last_ordered_at), { addSuffix: true }) : '—'}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="visits">
                    <AccordionTrigger className="text-sm">
                      <span className="flex items-center gap-2">
                        <History className="h-4 w-4" /> Visit History
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      {ctx!.visits.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">No visits logged.</p>
                      ) : (
                        <div className="relative pl-4 space-y-3 before:absolute before:left-1 before:top-1 before:bottom-1 before:w-px before:bg-border">
                          {ctx!.visits.map((v) => (
                            <div key={v.id} className="relative">
                              <div className="absolute -left-3.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
                              <div className="text-xs font-medium">
                                {format(new Date(v.started_at), 'MMM d, yyyy')}
                              </div>
                              <div className="text-[11px] text-muted-foreground capitalize">
                                {v.outcome || v.visit_type || 'visit'}
                                {v.amount_collected ? ` · ${formatCurrency(v.amount_collected)} collected` : ''}
                              </div>
                              {v.notes && <p className="text-xs mt-0.5 line-clamp-2">{v.notes}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="comm">
                    <AccordionTrigger className="text-sm">
                      <span className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" /> Communication Summary
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <MiniStat label="Messages" value={ctx!.comm_summary.messages_count} />
                        <MiniStat label="Calls" value={ctx!.comm_summary.calls_count} />
                        <MiniStat
                          label="Response %"
                          value={`${ctx!.comm_summary.outbound_30d
                            ? Math.round((ctx!.comm_summary.inbound_30d / ctx!.comm_summary.outbound_30d) * 100)
                            : 0}%`}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="notes">
                    <AccordionTrigger className="text-sm">
                      <span className="flex items-center gap-2">
                        <StickyNote className="h-4 w-4" /> Notes
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <Textarea
                        value={notesDraft}
                        onChange={(e) => onNotesChange(e.target.value)}
                        placeholder="Add notes about this store…"
                        rows={4}
                        className="text-xs"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {notesDirty
                          ? (updateNotes.isPending ? 'Saving…' : 'Unsaved')
                          : 'Saved · autosaves on idle'}
                      </p>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </>
            )}
          </div>
        </ScrollArea>

        {/* Sticky footer quick actions */}
        <div className="border-t p-2 grid grid-cols-4 gap-1">
          <Button variant="ghost" size="sm" className="flex-col h-auto py-2 gap-0.5" onClick={() => setScheduleOpen(true)} disabled={!storeId}>
            <Calendar className="h-4 w-4" />
            <span className="text-[10px]">Schedule</span>
          </Button>
          <Button variant="ghost" size="sm" className="flex-col h-auto py-2 gap-0.5" onClick={() => storeId && navigate(`/orders/new?store=${storeId}`)} disabled={!storeId}>
            <ShoppingCart className="h-4 w-4" />
            <span className="text-[10px]">New Order</span>
          </Button>
          <Button variant="ghost" size="sm" className="flex-col h-auto py-2 gap-0.5" onClick={() => setConfirmDormant(true)} disabled={!storeId}>
            <Moon className="h-4 w-4" />
            <span className="text-[10px]">Dormant</span>
          </Button>
          <Button variant="ghost" size="sm" className="flex-col h-auto py-2 gap-0.5" onClick={onCall} disabled={!storeId || !store?.phone}>
            <PhoneCall className="h-4 w-4 text-green-600" />
            <span className="text-[10px]">Call</span>
          </Button>
        </div>
      </aside>

      {/* Mark dormant confirm */}
      <Dialog open={confirmDormant} onOpenChange={setConfirmDormant}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark store dormant?</DialogTitle>
            <DialogDescription>
              The store will be flagged inactive and deprioritized in outreach. You can reactivate it later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDormant(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleMarkDormant} disabled={updateStatus.isPending}>
              {updateStatus.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Mark Dormant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule visit dialog */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule a visit</DialogTitle>
            <DialogDescription>Pick a date and add optional notes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <Calendar className="h-4 w-4 mr-2" />
                  {scheduleDate ? format(scheduleDate, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarPicker
                  mode="single"
                  selected={scheduleDate}
                  onSelect={setScheduleDate}
                  disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>
            <Input
              placeholder="Notes (optional)"
              value={scheduleNotes}
              onChange={(e) => setScheduleNotes(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleOpen(false)}>Cancel</Button>
            <Button onClick={handleSchedule} disabled={!scheduleDate || scheduleVisit.isPending}>
              {scheduleVisit.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatTile({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: 'success' | 'danger' }) {
  return (
    <Card className="p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn('text-base font-bold leading-tight',
        tone === 'danger' && 'text-destructive',
        tone === 'success' && 'text-green-600')}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded border p-2">
      <div className="text-base font-bold">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function SidebarSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16" />)}
      </div>
      <Skeleton className="h-32" />
    </div>
  );
}

/** Tab handle: small chevron pinned to the right edge of the message area
 *  for toggling the sidebar when closed. */
export function StoreContextToggle({ onClick, hidden }: { onClick: () => void; hidden?: boolean }) {
  if (hidden) return null;
  return (
    <button
      onClick={onClick}
      aria-label="Open store context"
      className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-card border border-border border-r-0 rounded-l-md p-2 shadow-sm hover:bg-muted transition-colors"
    >
      <ChevronRight className="h-4 w-4 rotate-180" />
    </button>
  );
}
