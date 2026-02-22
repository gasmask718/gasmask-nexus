import { useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Shield, TrendingUp, AlertTriangle, Clock, DollarSign,
  Eye, MessageSquare, Ban, Loader2, Activity, Zap,
  Package, Scale, FileText, Send, RefreshCw, Power,
  Search, Download, Snowflake, Lock, Unlock, RotateCcw,
  ShieldAlert, Gauge, Timer, TriangleAlert
} from 'lucide-react';

const UI_VERSION = "Marketplace Command Center v2.0";
console.log("Loaded:", UI_VERSION);
import {
  useMarketplaceKPIs,
  useOrderLifecycle,
  useOverdueFulfillments,
  useActiveDisputes,
  useSettlementPipeline,
  useHeldPayouts,
  useVendorPerformance,
  useIntegrityAnomalies,
  useOrderDeepDive,
  useAdminAction,
  useAdminActionLog,
  useMessageOversight,
  useMarketplaceKillSwitch,
  useRefreshVendorPerformance,
} from '@/hooks/useMarketplaceControlTower';
import { exportData } from '@/utils/exportUtils';

function riskBadge(score: number) {
  if (score >= 50) return <Badge className="bg-destructive/15 text-destructive border-destructive/30">High Risk</Badge>;
  if (score >= 20) return <Badge className="bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30">Medium</Badge>;
  return <Badge className="bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border-[hsl(var(--success))]/30">Low</Badge>;
}

function severityBadge(severity: string) {
  if (severity === 'critical') return <Badge className="bg-destructive/15 text-destructive border-destructive/30">Critical</Badge>;
  return <Badge className="bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30">Warning</Badge>;
}

function riskHeatIndicator(heat: string) {
  const colors: Record<string, string> = {
    green: 'bg-[hsl(var(--success))]',
    yellow: 'bg-[hsl(var(--warning))]',
    red: 'bg-destructive',
  };
  return <span className={`inline-block h-3 w-3 rounded-full ${colors[heat] || colors.green} animate-pulse`} />;
}

export default function MarketplaceControlTowerPage() {
  const [activeTab, setActiveTab] = useState('orders');
  const [deepDiveOrderId, setDeepDiveOrderId] = useState<string | null>(null);
  const [actionDialog, setActionDialog] = useState<{ type: string; orderId?: string; vendorId?: string } | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [messageFilters, setMessageFilters] = useState<{ type?: string; orderId?: string; vendorId?: string }>({});
  const [auditFilters, setAuditFilters] = useState<{ actionType?: string; orderId?: string; vendorId?: string }>({});
  const [orderSearch, setOrderSearch] = useState('');

  const { data: kpis, isLoading: kpisLoading } = useMarketplaceKPIs();
  const { data: orders } = useOrderLifecycle();
  const { data: overdue } = useOverdueFulfillments();
  const { data: disputes } = useActiveDisputes();
  const { data: settlement } = useSettlementPipeline();
  const { data: heldPayouts } = useHeldPayouts();
  const { data: vendors } = useVendorPerformance();
  const { data: anomalies } = useIntegrityAnomalies();
  const { data: deepDive } = useOrderDeepDive(deepDiveOrderId);
  const { data: actionLog } = useAdminActionLog(auditFilters);
  const { data: messages } = useMessageOversight(messageFilters);
  const { data: killSwitch } = useMarketplaceKillSwitch();
  const adminAction = useAdminAction();
  const refreshVendor = useRefreshVendorPerformance();

  const isMarketplaceFrozen = killSwitch?.active === true;

  const handleAdminAction = async () => {
    if (!actionDialog || !actionReason.trim()) return;
    await adminAction.mutateAsync({
      action_type: actionDialog.type,
      related_order_id: actionDialog.orderId,
      related_vendor_id: actionDialog.vendorId,
      reason: actionReason,
    });
    setActionDialog(null);
    setActionReason('');
  };

  const filteredOrders = (orders || []).filter(o => {
    if (!orderSearch) return true;
    const s = orderSearch.toLowerCase();
    return o.id.toLowerCase().includes(s) || o.payment_status?.toLowerCase().includes(s) || o.dispute_status?.toLowerCase().includes(s);
  });

  const kpiCards = [
    { label: 'GMV (7d)', value: `$${(kpis?.gmv7d || 0).toLocaleString()}`, icon: DollarSign, accent: 'text-[hsl(var(--success))]' },
    { label: 'GMV (30d)', value: `$${(kpis?.gmv30d || 0).toLocaleString()}`, icon: TrendingUp, accent: 'text-primary' },
    { label: 'Pending Ship', value: kpis?.pendingShipment || 0, icon: Package, accent: 'text-[hsl(var(--warning))]' },
    { label: 'Overdue (>48h)', value: kpis?.overdueShipment || 0, icon: AlertTriangle, accent: 'text-destructive' },
    { label: 'In Settlement', value: kpis?.inSettlement || 0, icon: Clock, accent: 'text-[hsl(var(--hud-cyan))]' },
    { label: 'Held Payouts', value: `$${(kpis?.heldTotal || 0).toLocaleString()}`, icon: Ban, accent: 'text-destructive' },
    { label: 'Disputes', value: kpis?.activeDisputes || 0, icon: Scale, accent: 'text-[hsl(var(--hud-amber))]' },
    { label: 'Refund Rate', value: `${(kpis?.refundRate || 0).toFixed(1)}%`, icon: Activity, accent: 'text-muted-foreground' },
    { label: 'Vendors Frozen', value: kpis?.frozenVendors || 0, icon: Snowflake, accent: 'text-[hsl(var(--hud-cyan))]' },
    { label: 'Avg Ship (h)', value: (kpis?.avgFulfillmentTime || 0).toFixed(1), icon: Timer, accent: 'text-muted-foreground' },
  ];

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-[1800px] mx-auto space-y-4">
        {/* ─── Header + Kill Switch ─── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Marketplace Command Center — <span className="text-primary">v2.0</span></h1>
              <p className="text-xs text-muted-foreground">Full operational control — risk, settlement, vendors, disputes</p>
            </div>
            {kpis?.riskHeat && <div className="flex items-center gap-1.5 ml-4">{riskHeatIndicator(kpis.riskHeat)} <span className="text-xs text-muted-foreground uppercase font-mono">{kpis.riskHeat}</span></div>}
          </div>
          <div className="flex items-center gap-2">
            {isMarketplaceFrozen && (
              <Badge className="bg-destructive/20 text-destructive border-destructive/40 text-xs animate-pulse gap-1">
                <Power className="h-3 w-3" /> MARKETPLACE FROZEN
              </Badge>
            )}
            <Button
              size="sm"
              variant={isMarketplaceFrozen ? 'default' : 'destructive'}
              className="text-xs gap-1"
              onClick={() => setActionDialog({ type: isMarketplaceFrozen ? 'marketplace_unfreeze' : 'marketplace_freeze' })}
            >
              {isMarketplaceFrozen ? <><Unlock className="h-3 w-3" /> Unfreeze</> : <><Lock className="h-3 w-3" /> Emergency Freeze</>}
            </Button>
          </div>
        </div>

        {/* ─── Fixed KPI Bar ─── */}
        {kpisLoading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2">
            {kpiCards.map(k => (
              <Card key={k.label} className="border-border/50">
                <CardContent className="p-3">
                  <div className="flex items-center gap-1 mb-1">
                    <k.icon className={`h-3 w-3 ${k.accent}`} />
                    <span className="text-[10px] text-muted-foreground font-medium">{k.label}</span>
                  </div>
                  <p className={`text-lg font-bold ${k.accent}`}>{k.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ─── Tabs ─── */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="orders" className="text-xs">Orders</TabsTrigger>
            <TabsTrigger value="alerts" className="text-xs">Alerts {overdue && overdue.length > 0 && <Badge variant="destructive" className="ml-1 h-4 text-[9px] px-1">{overdue.length}</Badge>}</TabsTrigger>
            <TabsTrigger value="settlement" className="text-xs">Settlement</TabsTrigger>
            <TabsTrigger value="disputes" className="text-xs">Disputes {disputes && disputes.length > 0 && <Badge variant="destructive" className="ml-1 h-4 text-[9px] px-1">{disputes.length}</Badge>}</TabsTrigger>
            <TabsTrigger value="vendors" className="text-xs">Vendors</TabsTrigger>
            <TabsTrigger value="integrity" className="text-xs">Integrity {anomalies && anomalies.length > 0 && <Badge variant="destructive" className="ml-1 h-4 text-[9px] px-1">{anomalies.length}</Badge>}</TabsTrigger>
            <TabsTrigger value="messages" className="text-xs">Messages</TabsTrigger>
            <TabsTrigger value="audit" className="text-xs">Audit Log</TabsTrigger>
          </TabsList>

          {/* ═══════ Orders Tab ═══════ */}
          <TabsContent value="orders">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base"><Package className="h-4 w-4" /> Order Lifecycle</CardTitle>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground" />
                      <Input className="pl-7 h-8 w-48 text-xs" placeholder="Search orders..." value={orderSearch} onChange={e => setOrderSearch(e.target.value)} />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Order ID</TableHead>
                        <TableHead className="text-xs">Type</TableHead>
                        <TableHead className="text-xs">Payment</TableHead>
                        <TableHead className="text-xs">Fulfillment</TableHead>
                        <TableHead className="text-xs">Dispute</TableHead>
                        <TableHead className="text-xs text-right">Total</TableHead>
                        <TableHead className="text-xs text-center">Vendors</TableHead>
                        <TableHead className="text-xs">Created</TableHead>
                        <TableHead className="text-xs text-center">Risk</TableHead>
                        <TableHead className="text-xs text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.map(o => (
                        <TableRow key={o.id} className={o.riskFlag ? 'bg-destructive/5' : ''}>
                          <TableCell>
                            <Button variant="link" className="p-0 h-auto text-xs font-mono" onClick={() => setDeepDiveOrderId(o.id)}>
                              {o.id.slice(0, 8)}
                            </Button>
                          </TableCell>
                          <TableCell className="text-xs">{o.order_type || '—'}</TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px]">{o.payment_status}</Badge></TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px]">{o.fulfillment_status || 'pending'}</Badge></TableCell>
                          <TableCell>
                            {o.dispute_status && o.dispute_status !== 'none'
                              ? <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-[10px]">{o.dispute_status}</Badge>
                              : <span className="text-[10px] text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">${(o.total || 0).toFixed(2)}</TableCell>
                          <TableCell className="text-center text-xs">{o.vendorCount}</TableCell>
                          <TableCell className="text-xs">{o.created_at ? format(new Date(o.created_at), 'MMM d') : '—'}</TableCell>
                          <TableCell className="text-center">{o.riskFlag ? <TriangleAlert className="h-3 w-3 text-destructive inline" /> : <span className="text-[10px] text-muted-foreground">—</span>}</TableCell>
                          <TableCell className="text-right">
                            <Select onValueChange={val => setActionDialog({ type: val, orderId: o.id, vendorId: o.wholesaler_id || undefined })}>
                              <SelectTrigger className="h-7 w-24 text-[10px]"><SelectValue placeholder="Actions" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="hold_payout">Hold Payout</SelectItem>
                                <SelectItem value="release_payout">Release Payout</SelectItem>
                                <SelectItem value="escalate_fulfillment">Escalate Vendor</SelectItem>
                                <SelectItem value="send_system_message">System Message</SelectItem>
                                <SelectItem value="convert_to_liability">Add Liability</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════ Alerts Tab ═══════ */}
          <TabsContent value="alerts">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4 text-destructive" /> Overdue Fulfillments
                  {overdue && overdue.length > 0 && <Badge variant="destructive">{overdue.length}</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!overdue || overdue.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground text-sm">All clear — no overdue fulfillments</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Order</TableHead>
                        <TableHead className="text-xs">Vendor</TableHead>
                        <TableHead className="text-xs">Hours Elapsed</TableHead>
                        <TableHead className="text-xs">Severity</TableHead>
                        <TableHead className="text-xs text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {overdue.map(f => (
                        <TableRow key={f.id}>
                          <TableCell><Button variant="link" className="p-0 h-auto text-xs font-mono" onClick={() => setDeepDiveOrderId(f.order_id)}>{f.order_id?.slice(0, 8)}</Button></TableCell>
                          <TableCell className="text-xs font-mono">{f.wholesaler_id?.slice(0, 8)}</TableCell>
                          <TableCell className="font-mono text-xs">{Math.round(f.hoursElapsed)}h</TableCell>
                          <TableCell>{severityBadge(f.severity)}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => setActionDialog({ type: 'escalate_fulfillment', orderId: f.order_id, vendorId: f.wholesaler_id })}>
                              <Zap className="h-3 w-3" /> Escalate
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════ Settlement Tab ═══════ */}
          <TabsContent value="settlement">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4 text-[hsl(var(--hud-cyan))]" /> Settlement Pipeline</CardTitle>
              </CardHeader>
              <CardContent>
                {!settlement || settlement.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground text-sm">No active settlements</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Order</TableHead>
                        <TableHead className="text-xs">Vendor</TableHead>
                        <TableHead className="text-xs text-right">Net Amount</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Settlement Start</TableHead>
                        <TableHead className="text-xs">Release Date</TableHead>
                        <TableHead className="text-xs">Countdown</TableHead>
                        <TableHead className="text-xs">Dispute</TableHead>
                        <TableHead className="text-xs text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {settlement.map(s => {
                        const releaseAt = s.settlement_release_at ? new Date(s.settlement_release_at) : null;
                        const hoursLeft = releaseAt ? Math.max(0, (releaseAt.getTime() - Date.now()) / 3600000) : null;
                        return (
                          <TableRow key={s.id}>
                            <TableCell><Button variant="link" className="p-0 h-auto text-xs font-mono" onClick={() => setDeepDiveOrderId(s.order_id)}>{s.order_id?.slice(0, 8)}</Button></TableCell>
                            <TableCell className="text-xs font-mono">{s.wholesaler_id?.slice(0, 8)}</TableCell>
                            <TableCell className="text-right font-mono font-bold text-xs">${(s.net_amount || 0).toFixed(2)}</TableCell>
                            <TableCell><Badge variant="outline" className="text-[10px]">{s.status}</Badge></TableCell>
                            <TableCell className="text-xs">{s.settlement_start_at ? format(new Date(s.settlement_start_at), 'MMM d, h:mm a') : '—'}</TableCell>
                            <TableCell className="text-xs">{releaseAt ? format(releaseAt, 'MMM d, h:mm a') : '—'}</TableCell>
                            <TableCell className="text-xs font-mono">
                              {hoursLeft !== null ? (
                                <span className={hoursLeft < 12 ? 'text-[hsl(var(--success))]' : ''}>{hoursLeft.toFixed(1)}h</span>
                              ) : '—'}
                            </TableCell>
                            <TableCell>{s.dispute_flag ? <Badge className="bg-destructive/15 text-destructive text-[10px]">Flagged</Badge> : <span className="text-[10px] text-muted-foreground">—</span>}</TableCell>
                            <TableCell className="text-right">
                              <Select onValueChange={val => setActionDialog({ type: val, orderId: s.order_id || undefined, vendorId: s.wholesaler_id || undefined })}>
                                <SelectTrigger className="h-7 w-28 text-[10px]"><SelectValue placeholder="Override" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="release_payout">Release Now</SelectItem>
                                  <SelectItem value="hold_payout">Extend Hold</SelectItem>
                                  <SelectItem value="reverse_payout">Reverse Payout</SelectItem>
                                  <SelectItem value="convert_to_liability">Convert to Liability</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════ Disputes Tab ═══════ */}
          <TabsContent value="disputes">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldAlert className="h-4 w-4 text-destructive" /> Dispute War Room
                  {disputes && disputes.length > 0 && <Badge variant="destructive">{disputes.length}</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!disputes || disputes.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground text-sm">No active disputes</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Order</TableHead>
                        <TableHead className="text-xs">Vendor</TableHead>
                        <TableHead className="text-xs">Reason</TableHead>
                        <TableHead className="text-xs">Opened</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs text-right">Amount</TableHead>
                        <TableHead className="text-xs text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {disputes.map(d => (
                        <TableRow key={d.id}>
                          <TableCell><Button variant="link" className="p-0 h-auto text-xs font-mono" onClick={() => setDeepDiveOrderId(d.id)}>{d.id.slice(0, 8)}</Button></TableCell>
                          <TableCell className="text-xs font-mono">{d.wholesaler_id?.slice(0, 8) || '—'}</TableCell>
                          <TableCell className="text-xs max-w-[150px] truncate">{d.dispute_reason || '—'}</TableCell>
                          <TableCell className="text-xs">{d.dispute_opened_at ? format(new Date(d.dispute_opened_at), 'MMM d, h:mm a') : '—'}</TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px]">{d.dispute_status}</Badge></TableCell>
                          <TableCell className="text-right font-mono text-xs">${(d.total || 0).toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            <Select onValueChange={val => setActionDialog({ type: val, orderId: d.id, vendorId: d.wholesaler_id || undefined })}>
                              <SelectTrigger className="h-7 w-28 text-[10px]"><SelectValue placeholder="Actions" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="resolve_dispute">Mark Resolved</SelectItem>
                                <SelectItem value="convert_to_liability">Convert to Liability</SelectItem>
                                <SelectItem value="reverse_payout">Reverse Payout</SelectItem>
                                <SelectItem value="escalate_dispute">Escalate</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════ Vendors Tab ═══════ */}
          <TabsContent value="vendors">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base"><Gauge className="h-4 w-4 text-primary" /> Vendor Risk Intelligence</CardTitle>
                  <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => refreshVendor.mutate()} disabled={refreshVendor.isPending}>
                    <RefreshCw className={`h-3 w-3 ${refreshVendor.isPending ? 'animate-spin' : ''}`} /> Refresh Data
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {!vendors || vendors.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground text-sm">No vendor data yet</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Vendor</TableHead>
                        <TableHead className="text-xs">Risk</TableHead>
                        <TableHead className="text-xs text-right">GMV (30d)</TableHead>
                        <TableHead className="text-xs text-right">Avg Ship (h)</TableHead>
                        <TableHead className="text-xs text-right">On-Time %</TableHead>
                        <TableHead className="text-xs text-right">Dispute %</TableHead>
                        <TableHead className="text-xs text-right">Refund %</TableHead>
                        <TableHead className="text-xs text-right">Liability</TableHead>
                        <TableHead className="text-xs text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vendors.map((v: any) => (
                        <TableRow key={v.vendor_id}>
                          <TableCell className="font-medium text-xs">{v.vendor_name || v.vendor_id?.slice(0, 8)}</TableCell>
                          <TableCell>{riskBadge(v.risk_score)}</TableCell>
                          <TableCell className="text-right font-mono text-xs">${Number(v.total_gmv_30d || 0).toLocaleString()}</TableCell>
                          <TableCell className={`text-right font-mono text-xs ${Number(v.avg_ship_time_hours) > 48 ? 'text-destructive' : ''}`}>{Number(v.avg_ship_time_hours || 0).toFixed(1)}</TableCell>
                          <TableCell className={`text-right font-mono text-xs ${Number(v.on_time_percentage) < 90 ? 'text-destructive' : 'text-[hsl(var(--success))]'}`}>{Number(v.on_time_percentage || 0).toFixed(1)}%</TableCell>
                          <TableCell className={`text-right font-mono text-xs ${Number(v.dispute_rate) > 5 ? 'text-destructive' : ''}`}>{Number(v.dispute_rate || 0).toFixed(1)}%</TableCell>
                          <TableCell className="text-right font-mono text-xs">{Number(v.refund_rate || 0).toFixed(1)}%</TableCell>
                          <TableCell className="text-right font-mono text-xs text-destructive">${Number(v.total_liability || 0).toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            <Select onValueChange={val => setActionDialog({ type: val, vendorId: v.vendor_id })}>
                              <SelectTrigger className="h-7 w-28 text-[10px]"><SelectValue placeholder="Actions" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="freeze_vendor">Freeze Vendor</SelectItem>
                                <SelectItem value="unfreeze_vendor">Unfreeze Vendor</SelectItem>
                                <SelectItem value="hold_all_settlements">Hold Settlements</SelectItem>
                                <SelectItem value="flag_for_review">Flag for Review</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════ Integrity Tab ═══════ */}
          <TabsContent value="integrity">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldAlert className="h-4 w-4 text-[hsl(var(--warning))]" /> Integrity & Anomaly Detection
                  {anomalies && anomalies.length > 0 && <Badge variant="destructive">{anomalies.length}</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!anomalies || anomalies.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground text-sm">No anomalies detected — system healthy</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Type</TableHead>
                        <TableHead className="text-xs">Order</TableHead>
                        <TableHead className="text-xs">Detail</TableHead>
                        <TableHead className="text-xs">Severity</TableHead>
                        <TableHead className="text-xs text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {anomalies.map((a, i) => (
                        <TableRow key={`${a.order_id}-${a.type}-${i}`}>
                          <TableCell><Badge variant="outline" className="text-[10px]">{a.type.replace(/_/g, ' ')}</Badge></TableCell>
                          <TableCell><Button variant="link" className="p-0 h-auto text-xs font-mono" onClick={() => setDeepDiveOrderId(a.order_id)}>{a.order_id.slice(0, 8)}</Button></TableCell>
                          <TableCell className="text-xs">{a.detail}</TableCell>
                          <TableCell>{severityBadge(a.severity)}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => setDeepDiveOrderId(a.order_id)}>
                              <Eye className="h-3 w-3" /> Deep Dive
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════ Messages Tab ═══════ */}
          <TabsContent value="messages">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="flex items-center gap-2 text-base"><MessageSquare className="h-4 w-4" /> Message Oversight</CardTitle>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant={!messageFilters.type ? 'default' : 'outline'} onClick={() => setMessageFilters(f => ({ ...f, type: undefined }))} className="text-xs">All</Button>
                    <Button size="sm" variant={messageFilters.type === 'dispute_related' ? 'default' : 'outline'} onClick={() => setMessageFilters(f => ({ ...f, type: 'dispute_related' }))} className="text-xs">Dispute</Button>
                    <Input className="h-8 w-32 text-xs" placeholder="Order ID..." value={messageFilters.orderId || ''} onChange={e => setMessageFilters(f => ({ ...f, orderId: e.target.value || undefined }))} />
                    <Input className="h-8 w-32 text-xs" placeholder="Vendor ID..." value={messageFilters.vendorId || ''} onChange={e => setMessageFilters(f => ({ ...f, vendorId: e.target.value || undefined }))} />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  {!messages || messages.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground text-sm">No messages</p>
                  ) : (
                    <div className="space-y-2">
                      {messages.map((m: any) => (
                        <div key={m.id} className="border rounded-md p-3 flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <Badge variant="outline" className="text-[10px]">{m.sender_role}</Badge>
                              {m.message_type === 'dispute_related' && <Badge className="bg-destructive/15 text-destructive text-[10px]">Dispute</Badge>}
                              <span className="text-[10px] text-muted-foreground">{m.created_at ? format(new Date(m.created_at), 'MMM d, h:mm a') : ''}</span>
                            </div>
                            <p className="text-sm truncate">{m.message_body}</p>
                            <p className="text-[10px] text-muted-foreground font-mono mt-1">Order: {m.order_id?.slice(0, 8)}</p>
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="text-xs h-7 w-7 p-0" onClick={() => setDeepDiveOrderId(m.order_id)}>
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-xs h-7 w-7 p-0" onClick={() => setActionDialog({ type: 'send_system_message', orderId: m.order_id })}>
                              <Send className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════ Audit Log Tab ═══════ */}
          <TabsContent value="audit">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4" /> Admin Action Audit Trail</CardTitle>
                  <div className="flex gap-2 flex-wrap">
                    <Select onValueChange={val => setAuditFilters(f => ({ ...f, actionType: val === 'all' ? undefined : val }))}>
                      <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Action Type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="hold_payout">Hold Payout</SelectItem>
                        <SelectItem value="release_payout">Release Payout</SelectItem>
                        <SelectItem value="freeze_vendor">Freeze Vendor</SelectItem>
                        <SelectItem value="escalate_fulfillment">Escalate</SelectItem>
                        <SelectItem value="reverse_payout">Reverse Payout</SelectItem>
                        <SelectItem value="marketplace_freeze">Marketplace Freeze</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input className="h-8 w-28 text-xs" placeholder="Order ID..." value={auditFilters.orderId || ''} onChange={e => setAuditFilters(f => ({ ...f, orderId: e.target.value || undefined }))} />
                    <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => {
                      if (actionLog && actionLog.length > 0) {
                        exportData({ filename: 'marketplace_audit_log', format: 'csv', data: actionLog as any[] });
                      }
                    }}>
                      <Download className="h-3 w-3" /> Export CSV
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  {!actionLog || actionLog.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground text-sm">No admin actions recorded yet</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Action</TableHead>
                          <TableHead className="text-xs">Order</TableHead>
                          <TableHead className="text-xs">Vendor</TableHead>
                          <TableHead className="text-xs">Reason</TableHead>
                          <TableHead className="text-xs">Admin</TableHead>
                          <TableHead className="text-xs">Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {actionLog.map((a: any) => (
                          <TableRow key={a.id}>
                            <TableCell><Badge variant="outline" className="text-[10px]">{a.action_type}</Badge></TableCell>
                            <TableCell className="font-mono text-xs">{a.related_order_id?.slice(0, 8) || '—'}</TableCell>
                            <TableCell className="font-mono text-xs">{a.related_vendor_id?.slice(0, 8) || '—'}</TableCell>
                            <TableCell className="text-xs max-w-[200px] truncate">{a.reason}</TableCell>
                            <TableCell className="font-mono text-xs">{a.admin_user_id?.slice(0, 8)}</TableCell>
                            <TableCell className="text-xs">{a.created_at ? format(new Date(a.created_at), 'MMM d, h:mm a') : ''}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* ─── Order Deep-Dive Dialog ─── */}
        <Dialog open={!!deepDiveOrderId} onOpenChange={() => setDeepDiveOrderId(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-mono">Order Deep-Dive — {deepDiveOrderId?.slice(0, 8)}</DialogTitle>
            </DialogHeader>
            {deepDive ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Payment:</span> <Badge variant="outline">{deepDive.order?.payment_status}</Badge></div>
                  <div><span className="text-muted-foreground">Total:</span> <span className="font-bold font-mono">${(deepDive.order?.total || 0).toFixed(2)}</span></div>
                  <div><span className="text-muted-foreground">Dispute:</span> <Badge variant="outline">{deepDive.order?.dispute_status || 'none'}</Badge></div>
                  <div><span className="text-muted-foreground">Created:</span> {deepDive.order?.created_at ? format(new Date(deepDive.order.created_at), 'MMM d, yyyy h:mm a') : '—'}</div>
                </div>

                <div>
                  <h4 className="font-semibold text-sm mb-2">Fulfillments ({deepDive.fulfillments.length})</h4>
                  {deepDive.fulfillments.map((f: any) => (
                    <div key={f.id} className="border rounded p-2 mb-1 text-xs flex justify-between">
                      <span className="font-mono">Vendor: {f.wholesaler_id?.slice(0, 8)} | Tracking: {f.tracking_number || 'none'}</span>
                      <Badge variant="outline">{f.status}</Badge>
                    </div>
                  ))}
                </div>

                <div>
                  <h4 className="font-semibold text-sm mb-2">Payouts ({deepDive.payouts.length})</h4>
                  {deepDive.payouts.map((p: any) => (
                    <div key={p.id} className="border rounded p-2 mb-1 text-xs flex justify-between">
                      <span className="font-mono">${(p.net_amount || 0).toFixed(2)} {p.hold_reason ? `— Hold: ${p.hold_reason}` : ''}</span>
                      <Badge variant="outline">{p.status}</Badge>
                    </div>
                  ))}
                </div>

                <div>
                  <h4 className="font-semibold text-sm mb-2">Messages ({deepDive.messages.length})</h4>
                  <ScrollArea className="h-[200px]">
                    {deepDive.messages.map((m: any) => (
                      <div key={m.id} className="border-b py-2 text-xs">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-[10px]">{m.sender_role}</Badge>
                          {m.message_type === 'dispute_related' && <Badge className="bg-destructive/15 text-destructive text-[10px]">Dispute</Badge>}
                          <span className="text-muted-foreground">{m.created_at ? format(new Date(m.created_at), 'h:mm a, MMM d') : ''}</span>
                        </div>
                        <p>{m.message_body}</p>
                      </div>
                    ))}
                  </ScrollArea>
                </div>

                {deepDive.liabilities.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2 text-destructive">Vendor Liabilities ({deepDive.liabilities.length})</h4>
                    {deepDive.liabilities.map((l: any) => (
                      <div key={l.id} className="border border-destructive/20 rounded p-2 mb-1 text-xs flex justify-between">
                        <span>${(l.amount || 0).toFixed(2)} — {l.reason}</span>
                        <Badge variant="outline">{l.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 pt-2 border-t flex-wrap">
                  <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => setActionDialog({ type: 'hold_payout', orderId: deepDiveOrderId || undefined })}>
                    <Ban className="h-3 w-3" /> Hold Payout
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => setActionDialog({ type: 'release_payout', orderId: deepDiveOrderId || undefined })}>
                    <Unlock className="h-3 w-3" /> Release Payout
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => setActionDialog({ type: 'send_system_message', orderId: deepDiveOrderId || undefined })}>
                    <Send className="h-3 w-3" /> System Message
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs gap-1 text-destructive border-destructive/30" onClick={() => setActionDialog({ type: 'escalate_dispute', orderId: deepDiveOrderId || undefined })}>
                    <AlertTriangle className="h-3 w-3" /> Escalate
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs gap-1 text-destructive border-destructive/30" onClick={() => setActionDialog({ type: 'reverse_payout', orderId: deepDiveOrderId || undefined })}>
                    <RotateCcw className="h-3 w-3" /> Reverse Payout
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
            )}
          </DialogContent>
        </Dialog>

        {/* ─── Admin Action Dialog ─── */}
        <Dialog open={!!actionDialog} onOpenChange={() => setActionDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Admin Action: {actionDialog?.type?.replace(/_/g, ' ')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Reason (required)</Label>
                <Textarea value={actionReason} onChange={e => setActionReason(e.target.value)} placeholder="Provide a reason for this action..." />
              </div>
              {actionDialog?.orderId && (
                <p className="text-xs text-muted-foreground">Order: <span className="font-mono">{actionDialog.orderId.slice(0, 8)}</span></p>
              )}
              {actionDialog?.vendorId && (
                <p className="text-xs text-muted-foreground">Vendor: <span className="font-mono">{actionDialog.vendorId.slice(0, 8)}</span></p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
              <Button onClick={handleAdminAction} disabled={!actionReason.trim() || adminAction.isPending}>
                {adminAction.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Confirm Action
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
