import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Sparkles, PartyPopper, Users, MapPin, Calendar, DollarSign, Package,
  ShoppingCart, Star, TrendingUp, ArrowRight, Plus, Eye, CheckCircle, Loader2,
  CreditCard, RefreshCw
} from 'lucide-react';
import { useUTEventRequests, useUTCustomerMutations, useUTOrders } from '@/hooks/useUTCustomerEngine';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

const EVENT_TYPES = [
  'birthday', 'wedding', 'corporate', 'baby_shower', 'graduation',
  'anniversary', 'holiday_party', 'quinceañera', 'fundraiser', 'other'
];

const BUDGET_RANGES = [
  { label: 'Under $500', value: 'under_500', min: 0, max: 500 },
  { label: '$500 – $1,500', value: '500_1500', min: 500, max: 1500 },
  { label: '$1,500 – $5,000', value: '1500_5000', min: 1500, max: 5000 },
  { label: '$5,000 – $15,000', value: '5000_15000', min: 5000, max: 15000 },
  { label: '$15,000+', value: '15000_plus', min: 15000, max: 100000 },
];

export default function UTEventBuilder() {
  const { data: events = [], isLoading } = useUTEventRequests();
  const { data: orders = [] } = useUTOrders();
  const { createEventRequest, generateRecommendations, createOrder, updateEventStatus, saveGeneratedPackage, initiateCheckout, verifyPayment } = useUTCustomerMutations();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState('intake');
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Handle payment return
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    const orderId = searchParams.get('order_id');
    if (paymentStatus === 'success' && orderId) {
      setActiveTab('orders');
      toast.success('Processing payment verification...');
      verifyPayment.mutate(orderId);
      setSearchParams({});
    } else if (paymentStatus === 'cancelled') {
      toast.info('Payment was cancelled');
      setSearchParams({});
    }
  }, [searchParams]);

  // Intake form state
  const [form, setForm] = useState({
    customer_name: '', customer_email: '', customer_phone: '',
    event_type: '', event_date: '', location_city: '', location_state: '',
    budget_range: '', guest_count: '', venue_preference: '', special_requests: '',
  });

  const handleSubmitEvent = async () => {
    if (!form.customer_name || !form.event_type) return;
    const budget = BUDGET_RANGES.find(b => b.value === form.budget_range);
    const result = await createEventRequest.mutateAsync({
      customer_name: form.customer_name,
      customer_email: form.customer_email || null,
      customer_phone: form.customer_phone || null,
      event_type: form.event_type,
      event_date: form.event_date || null,
      location_city: form.location_city || null,
      location_state: form.location_state || null,
      budget_range: form.budget_range || null,
      budget_min: budget?.min || null,
      budget_max: budget?.max || null,
      guest_count: form.guest_count ? parseInt(form.guest_count) : null,
      venue_preference: form.venue_preference || null,
      special_requests: form.special_requests || null,
    });
    if (result?.id) {
      generateRecommendations.mutate(result.id);
      setForm({ customer_name: '', customer_email: '', customer_phone: '', event_type: '', event_date: '', location_city: '', location_state: '', budget_range: '', guest_count: '', venue_preference: '', special_requests: '' });
      setActiveTab('pipeline');
    }
  };

  const handleGenerateRecs = (eventId: string) => {
    generateRecommendations.mutate(eventId);
  };

  const handleCreateOrder = async (event: any) => {
    await createOrder.mutateAsync({
      customer_id: event.customer_id || null,
      event_request_id: event.id,
      total_price: event.budget_max || 0,
      order_status: 'draft',
    });
    updateEventStatus.mutate({ id: event.id, status: 'order_created' });
  };

  const openDetail = (event: any) => {
    setSelectedEvent(event);
    setDetailOpen(true);
  };

  const recs = selectedEvent?.ai_recommendations || {};

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <PartyPopper className="h-6 w-6 text-primary" />
            Smart Event Builder
          </h1>
          <p className="text-sm text-muted-foreground">Customer → Event → AI Plan → Package → Order</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="text-xs">{events.length} Events</Badge>
          <Badge variant="outline" className="text-xs">{orders.length} Orders</Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="intake">New Event</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline ({events.length})</TabsTrigger>
          <TabsTrigger value="orders">Orders ({orders.length})</TabsTrigger>
        </TabsList>

        {/* ── INTAKE TAB ── */}
        <TabsContent value="intake" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Plus className="h-4 w-4" /> Event Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Customer Name *</Label>
                    <Input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="John Smith" /></div>
                  <div><Label className="text-xs">Email</Label>
                    <Input type="email" value={form.customer_email} onChange={e => setForm(f => ({ ...f, customer_email: e.target.value }))} placeholder="john@email.com" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Phone</Label>
                    <Input value={form.customer_phone} onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))} placeholder="(555) 123-4567" /></div>
                  <div><Label className="text-xs">Event Type *</Label>
                    <Select value={form.event_type} onValueChange={v => setForm(f => ({ ...f, event_type: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>{EVENT_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>)}</SelectContent>
                    </Select></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Event Date</Label>
                    <Input type="date" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} /></div>
                  <div><Label className="text-xs">Guest Count</Label>
                    <Input type="number" value={form.guest_count} onChange={e => setForm(f => ({ ...f, guest_count: e.target.value }))} placeholder="50" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">City</Label>
                    <Input value={form.location_city} onChange={e => setForm(f => ({ ...f, location_city: e.target.value }))} placeholder="Brooklyn" /></div>
                  <div><Label className="text-xs">State</Label>
                    <Input value={form.location_state} onChange={e => setForm(f => ({ ...f, location_state: e.target.value }))} placeholder="NY" /></div>
                </div>
                <div><Label className="text-xs">Budget</Label>
                  <Select value={form.budget_range} onValueChange={v => setForm(f => ({ ...f, budget_range: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select budget" /></SelectTrigger>
                    <SelectContent>{BUDGET_RANGES.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div><Label className="text-xs">Special Requests</Label>
                  <Textarea value={form.special_requests} onChange={e => setForm(f => ({ ...f, special_requests: e.target.value }))} placeholder="Describe any special requirements..." rows={3} /></div>
                <Button onClick={handleSubmitEvent} disabled={!form.customer_name || !form.event_type || createEventRequest.isPending} className="w-full">
                  {createEventRequest.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  Create Event & Get AI Recommendations
                </Button>
              </CardContent>
            </Card>

            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" /> How It Works
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { icon: Users, label: 'Customer describes their event', desc: 'Type, date, location, budget, guest count' },
                  { icon: Sparkles, label: 'AI generates recommendations', desc: 'Best vendors, products, and packages by score' },
                  { icon: Package, label: 'Smart package is built', desc: 'Venue + staff + products + upgrades' },
                  { icon: ShoppingCart, label: 'Order is created', desc: 'Ready for checkout and payment' },
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <step.icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{step.label}</p>
                      <p className="text-xs text-muted-foreground">{step.desc}</p>
                    </div>
                    {i < 3 && <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto self-center" />}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── PIPELINE TAB ── */}
        <TabsContent value="pipeline" className="mt-4">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : events.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No event requests yet. Create one to get started.</CardContent></Card>
          ) : (
            <div className="grid gap-3">
              {events.map((ev: any) => (
                <Card key={ev.id} className="hover:border-primary/30 transition-colors cursor-pointer" onClick={() => openDetail(ev)}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <PartyPopper className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{ev.customer_name}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-2">
                            <span className="capitalize">{ev.event_type?.replace(/_/g, ' ')}</span>
                            {ev.location_city && <><MapPin className="h-3 w-3" />{ev.location_city}, {ev.location_state}</>}
                            {ev.event_date && <><Calendar className="h-3 w-3" />{ev.event_date}</>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {ev.guest_count && <Badge variant="outline" className="text-xs"><Users className="h-3 w-3 mr-1" />{ev.guest_count}</Badge>}
                        {ev.budget_range && <Badge variant="outline" className="text-xs"><DollarSign className="h-3 w-3 mr-1" />{ev.budget_range.replace(/_/g, ' ')}</Badge>}
                        <Badge className={cn('text-xs', ev.status === 'new' ? 'bg-blue-500/20 text-blue-400' : ev.status === 'order_created' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400')}>
                          {ev.status}
                        </Badge>
                        <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); handleGenerateRecs(ev.id); }}>
                          <Sparkles className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── ORDERS TAB ── */}
        <TabsContent value="orders" className="mt-4">
          {orders.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No orders yet. Build a package from an event request first.</CardContent></Card>
          ) : (
            <div className="grid gap-3">
              {orders.map((ord: any) => (
                <Card key={ord.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{ord.order_number}</p>
                      <p className="text-xs text-muted-foreground">${ord.total_price?.toLocaleString()} • {ord.payment_status} • {ord.order_status}</p>
                    </div>
                    <Badge className={cn('text-xs', ord.payment_status === 'paid' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400')}>
                      {ord.order_status}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── DETAIL / RECOMMENDATIONS MODAL ── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PartyPopper className="h-5 w-5 text-primary" />
              {selectedEvent?.customer_name} — {selectedEvent?.event_type?.replace(/_/g, ' ')}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            {selectedEvent && (
              <div className="space-y-6">
                {/* Event Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { icon: Calendar, label: 'Date', val: selectedEvent.event_date || 'TBD' },
                    { icon: MapPin, label: 'Location', val: `${selectedEvent.location_city || '?'}, ${selectedEvent.location_state || '?'}` },
                    { icon: Users, label: 'Guests', val: selectedEvent.guest_count || 'TBD' },
                    { icon: DollarSign, label: 'Budget', val: selectedEvent.budget_range?.replace(/_/g, ' ') || 'TBD' },
                  ].map((item, i) => (
                    <Card key={i} className="bg-muted/30">
                      <CardContent className="p-3 text-center">
                        <item.icon className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                        <p className="text-xs text-muted-foreground">{item.label}</p>
                        <p className="text-sm font-medium capitalize">{item.val}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* AI Recommendations */}
                {recs.vendors && (
                  <>
                    <h3 className="text-sm font-semibold flex items-center gap-2"><Star className="h-4 w-4 text-primary" /> Recommended Vendors ({(recs.vendors as any[])?.length || 0})</h3>
                    <div className="grid gap-2">
                      {(recs.vendors as any[])?.slice(0, 8).map((v: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/20 border border-border/50">
                          <div>
                            <p className="text-sm font-medium">{v.business_name}</p>
                            <p className="text-xs text-muted-foreground">{v.category} • {v.city}, {v.state}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {v.ai_score && <Badge variant="outline" className="text-xs"><TrendingUp className="h-3 w-3 mr-1" />{Math.round(v.ai_score)}</Badge>}
                            <Badge className="text-xs bg-primary/20 text-primary">{v.status}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {recs.products && (
                  <>
                    <h3 className="text-sm font-semibold flex items-center gap-2"><Package className="h-4 w-4 text-primary" /> Recommended Products ({(recs.products as any[])?.length || 0})</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {(recs.products as any[])?.slice(0, 8).map((p: any, i: number) => (
                        <div key={i} className="p-2 rounded-lg bg-muted/20 border border-border/50">
                          <p className="text-sm font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.category} • ${p.sell_price}</p>
                          <div className="flex gap-1 mt-1">
                            {p.is_trending && <Badge className="text-[10px] bg-orange-500/20 text-orange-400">Trending</Badge>}
                            {p.recommendation_level && <Badge variant="outline" className="text-[10px]">{p.recommendation_level}</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {recs.packages && (recs.packages as any[])?.length > 0 && (
                  <>
                    <h3 className="text-sm font-semibold flex items-center gap-2"><Package className="h-4 w-4 text-primary" /> Existing Packages</h3>
                    <div className="grid gap-2">
                      {(recs.packages as any[])?.map((pkg: any, i: number) => (
                        <div key={i} className="p-2 rounded-lg bg-muted/20 border border-border/50 flex justify-between">
                          <div>
                            <p className="text-sm font-medium">{pkg.name}</p>
                            <p className="text-xs text-muted-foreground">{pkg.category} • ${pkg.base_price}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button size="sm" onClick={() => handleGenerateRecs(selectedEvent.id)} disabled={generateRecommendations.isPending}>
                    {generateRecommendations.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                    Regenerate AI Recommendations
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleCreateOrder(selectedEvent)} disabled={createOrder.isPending || selectedEvent.status === 'order_created'}>
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    {selectedEvent.status === 'order_created' ? 'Order Created' : 'Create Order'}
                  </Button>
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
