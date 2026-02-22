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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Shield, TrendingUp, AlertTriangle, Clock, DollarSign,
  Eye, MessageSquare, Ban, Loader2, Activity, Zap,
  Package, Scale, FileText, Send
} from 'lucide-react';
import {
  useMarketplaceKPIs,
  useOverdueFulfillments,
  useActiveDisputes,
  useHeldPayouts,
  useVendorPerformance,
  useOrderDeepDive,
  useAdminAction,
  useAdminActionLog,
  useMessageOversight,
} from '@/hooks/useMarketplaceControlTower';

function riskColor(score: number) {
  if (score >= 50) return 'text-red-400';
  if (score >= 20) return 'text-amber-400';
  return 'text-emerald-400';
}

function riskBadge(score: number) {
  if (score >= 50) return <Badge className="bg-red-500/15 text-red-400 border-red-500/30">High Risk</Badge>;
  if (score >= 20) return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30">Medium</Badge>;
  return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Low</Badge>;
}

function severityBadge(severity: string) {
  if (severity === 'critical') return <Badge className="bg-red-500/15 text-red-400 border-red-500/30">Critical</Badge>;
  return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30">Warning</Badge>;
}

export default function MarketplaceControlTowerPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [deepDiveOrderId, setDeepDiveOrderId] = useState<string | null>(null);
  const [actionDialog, setActionDialog] = useState<{ type: string; orderId?: string; vendorId?: string } | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [messageFilter, setMessageFilter] = useState<string | undefined>();

  const { data: kpis, isLoading: kpisLoading } = useMarketplaceKPIs();
  const { data: overdue } = useOverdueFulfillments();
  const { data: disputes } = useActiveDisputes();
  const { data: heldPayouts } = useHeldPayouts();
  const { data: vendors } = useVendorPerformance();
  const { data: deepDive } = useOrderDeepDive(deepDiveOrderId);
  const { data: actionLog } = useAdminActionLog();
  const { data: messages } = useMessageOversight(messageFilter);
  const adminAction = useAdminAction();

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

  const kpiCards = [
    { label: 'GMV (7d)', value: `$${(kpis?.gmv7d || 0).toLocaleString()}`, icon: DollarSign, color: 'text-emerald-400' },
    { label: 'GMV (30d)', value: `$${(kpis?.gmv30d || 0).toLocaleString()}`, icon: TrendingUp, color: 'text-primary' },
    { label: 'Pending Shipment', value: kpis?.pendingShipment || 0, icon: Package, color: 'text-amber-400' },
    { label: 'Overdue (>48h)', value: kpis?.overdueShipment || 0, icon: AlertTriangle, color: 'text-red-400' },
    { label: 'In Settlement', value: kpis?.inSettlement || 0, icon: Clock, color: 'text-cyan-400' },
    { label: 'Held Payouts', value: `$${(kpis?.heldTotal || 0).toLocaleString()}`, icon: Ban, color: 'text-red-400' },
    { label: 'Active Disputes', value: kpis?.activeDisputes || 0, icon: Scale, color: 'text-orange-400' },
    { label: 'Refund Rate', value: `${(kpis?.refundRate || 0).toFixed(1)}%`, icon: Activity, color: 'text-muted-foreground' },
  ];

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Marketplace Control Tower</h1>
            <p className="text-muted-foreground">Risk monitoring, vendor oversight, and operational intelligence</p>
          </div>
        </div>

        {/* KPI Cards */}
        {kpisLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {kpiCards.map(k => (
              <Card key={k.label}>
                <CardHeader className="pb-1 pt-3 px-3">
                  <CardTitle className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                    <k.icon className="h-3 w-3" /> {k.label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <p className={`text-lg font-bold ${k.color}`}>{k.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-6 w-full max-w-3xl">
            <TabsTrigger value="overview" className="text-xs">Alerts</TabsTrigger>
            <TabsTrigger value="disputes" className="text-xs">Disputes</TabsTrigger>
            <TabsTrigger value="payouts" className="text-xs">Held Payouts</TabsTrigger>
            <TabsTrigger value="vendors" className="text-xs">Vendors</TabsTrigger>
            <TabsTrigger value="messages" className="text-xs">Messages</TabsTrigger>
            <TabsTrigger value="audit" className="text-xs">Audit Log</TabsTrigger>
          </TabsList>

          {/* ─── Overdue Fulfillments ─── */}
          <TabsContent value="overview">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                  Overdue Fulfillments
                  {overdue && overdue.length > 0 && <Badge variant="destructive">{overdue.length}</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!overdue || overdue.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No overdue fulfillments — all clear</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Time Since Paid</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {overdue.map(f => (
                        <TableRow key={f.id}>
                          <TableCell>
                            <Button variant="link" className="p-0 h-auto text-xs font-mono" onClick={() => setDeepDiveOrderId(f.order_id)}>
                              {f.order_id?.slice(0, 8)}
                            </Button>
                          </TableCell>
                          <TableCell className="text-xs">{f.wholesaler_id?.slice(0, 8)}</TableCell>
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

          {/* ─── Active Disputes ─── */}
          <TabsContent value="disputes">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="h-5 w-5 text-orange-400" /> Active Disputes
                  {disputes && disputes.length > 0 && <Badge variant="destructive">{disputes.length}</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!disputes || disputes.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No active disputes</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Opened</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {disputes.map(d => (
                        <TableRow key={d.id}>
                          <TableCell>
                            <Button variant="link" className="p-0 h-auto text-xs font-mono" onClick={() => setDeepDiveOrderId(d.id)}>
                              {d.id.slice(0, 8)}
                            </Button>
                          </TableCell>
                          <TableCell className="text-xs">{d.wholesaler_id?.slice(0, 8) || '—'}</TableCell>
                          <TableCell className="text-xs">{d.dispute_reason || '—'}</TableCell>
                          <TableCell className="text-xs">{d.dispute_opened_at ? format(new Date(d.dispute_opened_at), 'MMM d, h:mm a') : '—'}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{d.dispute_status}</Badge></TableCell>
                          <TableCell className="font-mono text-xs">${(d.total || 0).toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => setDeepDiveOrderId(d.id)}>
                              <Eye className="h-3 w-3" /> View
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

          {/* ─── Held Payouts ─── */}
          <TabsContent value="payouts">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Ban className="h-5 w-5 text-red-400" /> Held / At-Risk Payouts
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!heldPayouts || heldPayouts.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No held payouts</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Order</TableHead>
                        <TableHead className="text-right">Net Amount</TableHead>
                        <TableHead>Hold Reason</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {heldPayouts.map(p => (
                        <TableRow key={p.id}>
                          <TableCell className="text-xs">{p.wholesaler_id?.slice(0, 8)}</TableCell>
                          <TableCell>
                            <Button variant="link" className="p-0 h-auto text-xs font-mono" onClick={() => setDeepDiveOrderId(p.order_id)}>
                              {p.order_id?.slice(0, 8)}
                            </Button>
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold">${(p.net_amount || 0).toFixed(2)}</TableCell>
                          <TableCell className="text-xs text-red-400">{p.hold_reason || '—'}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{p.status}</Badge></TableCell>
                          <TableCell className="text-right">
                            {p.status === 'held' && (
                              <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => setActionDialog({ type: 'release_payout', orderId: p.order_id || undefined, vendorId: p.wholesaler_id || undefined })}>
                                Release
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Vendor Performance ─── */}
          <TabsContent value="vendors">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" /> Vendor Performance & Risk
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!vendors || vendors.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No vendor data yet</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Risk</TableHead>
                        <TableHead className="text-right">GMV (30d)</TableHead>
                        <TableHead className="text-right">Avg Ship (h)</TableHead>
                        <TableHead className="text-right">On-Time %</TableHead>
                        <TableHead className="text-right">Dispute %</TableHead>
                        <TableHead className="text-right">Refund %</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vendors.map((v: any) => (
                        <TableRow key={v.vendor_id}>
                          <TableCell className="font-medium text-sm">{v.vendor_name}</TableCell>
                          <TableCell>{riskBadge(v.risk_score)}</TableCell>
                          <TableCell className="text-right font-mono">${Number(v.total_gmv_30d || 0).toLocaleString()}</TableCell>
                          <TableCell className={`text-right font-mono ${Number(v.avg_ship_time_hours) > 48 ? 'text-red-400' : ''}`}>
                            {Number(v.avg_ship_time_hours || 0).toFixed(1)}
                          </TableCell>
                          <TableCell className={`text-right font-mono ${Number(v.on_time_percentage) < 90 ? 'text-red-400' : 'text-emerald-400'}`}>
                            {Number(v.on_time_percentage || 0).toFixed(1)}%
                          </TableCell>
                          <TableCell className={`text-right font-mono ${Number(v.dispute_rate) > 5 ? 'text-red-400' : ''}`}>
                            {Number(v.dispute_rate || 0).toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-right font-mono">{Number(v.refund_rate || 0).toFixed(1)}%</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => setActionDialog({ type: 'freeze_vendor', vendorId: v.vendor_id })}>
                              <Ban className="h-3 w-3" /> Freeze
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

          {/* ─── Message Oversight ─── */}
          <TabsContent value="messages">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" /> Message Oversight
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button size="sm" variant={!messageFilter ? 'default' : 'outline'} onClick={() => setMessageFilter(undefined)} className="text-xs">All</Button>
                    <Button size="sm" variant={messageFilter === 'dispute_related' ? 'default' : 'outline'} onClick={() => setMessageFilter('dispute_related')} className="text-xs">Dispute</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  {!messages || messages.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">No messages</p>
                  ) : (
                    <div className="space-y-2">
                      {messages.map((m: any) => (
                        <div key={m.id} className="border rounded-md p-3 flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-[10px]">{m.sender_role}</Badge>
                              {m.message_type === 'dispute_related' && <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-[10px]">Dispute</Badge>}
                              <span className="text-[10px] text-muted-foreground">
                                {m.created_at ? format(new Date(m.created_at), 'MMM d, h:mm a') : ''}
                              </span>
                            </div>
                            <p className="text-sm truncate">{m.message_body}</p>
                            <p className="text-[10px] text-muted-foreground font-mono mt-1">Order: {m.order_id?.slice(0, 8)}</p>
                          </div>
                          <Button size="sm" variant="ghost" className="text-xs" onClick={() => setDeepDiveOrderId(m.order_id)}>
                            <Eye className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Audit Log ─── */}
          <TabsContent value="audit">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" /> Admin Action Log
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!actionLog || actionLog.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No admin actions recorded yet</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Action</TableHead>
                        <TableHead>Order</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Admin</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {actionLog.map((a: any) => (
                        <TableRow key={a.id}>
                          <TableCell><Badge variant="outline" className="text-xs">{a.action_type}</Badge></TableCell>
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
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* ─── Order Deep-Dive Dialog ─── */}
        <Dialog open={!!deepDiveOrderId} onOpenChange={() => setDeepDiveOrderId(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Order Deep-Dive — {deepDiveOrderId?.slice(0, 8)}</DialogTitle>
            </DialogHeader>
            {deepDive ? (
              <div className="space-y-4">
                {/* Order Summary */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Status:</span> <Badge variant="outline">{deepDive.order?.payment_status}</Badge></div>
                  <div><span className="text-muted-foreground">Total:</span> <span className="font-bold">${(deepDive.order?.total || 0).toFixed(2)}</span></div>
                  <div><span className="text-muted-foreground">Dispute:</span> <Badge variant="outline">{deepDive.order?.dispute_status || 'none'}</Badge></div>
                  <div><span className="text-muted-foreground">Created:</span> {deepDive.order?.created_at ? format(new Date(deepDive.order.created_at), 'MMM d, yyyy') : '—'}</div>
                </div>

                {/* Fulfillments */}
                <div>
                  <h4 className="font-semibold text-sm mb-2">Fulfillments ({deepDive.fulfillments.length})</h4>
                  {deepDive.fulfillments.map((f: any) => (
                    <div key={f.id} className="border rounded p-2 mb-1 text-xs flex justify-between">
                      <span>Vendor: {f.wholesaler_id?.slice(0, 8)}</span>
                      <Badge variant="outline">{f.status}</Badge>
                    </div>
                  ))}
                </div>

                {/* Payouts */}
                <div>
                  <h4 className="font-semibold text-sm mb-2">Payouts ({deepDive.payouts.length})</h4>
                  {deepDive.payouts.map((p: any) => (
                    <div key={p.id} className="border rounded p-2 mb-1 text-xs flex justify-between">
                      <span>${(p.net_amount || 0).toFixed(2)}</span>
                      <Badge variant="outline">{p.status}</Badge>
                    </div>
                  ))}
                </div>

                {/* Messages */}
                <div>
                  <h4 className="font-semibold text-sm mb-2">Message Thread ({deepDive.messages.length})</h4>
                  <ScrollArea className="h-[200px]">
                    {deepDive.messages.map((m: any) => (
                      <div key={m.id} className="border-b py-2 text-xs">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-[10px]">{m.sender_role}</Badge>
                          <span className="text-muted-foreground">{m.created_at ? format(new Date(m.created_at), 'h:mm a, MMM d') : ''}</span>
                        </div>
                        <p>{m.message_body}</p>
                      </div>
                    ))}
                  </ScrollArea>
                </div>

                {/* Liabilities */}
                {deepDive.liabilities.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2 text-red-400">Vendor Liabilities ({deepDive.liabilities.length})</h4>
                    {deepDive.liabilities.map((l: any) => (
                      <div key={l.id} className="border border-red-500/20 rounded p-2 mb-1 text-xs flex justify-between">
                        <span>${(l.amount || 0).toFixed(2)} — {l.reason}</span>
                        <Badge variant="outline">{l.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}

                {/* Admin actions for this order */}
                <div className="flex gap-2 pt-2 border-t">
                  <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => setActionDialog({ type: 'send_system_message', orderId: deepDiveOrderId || undefined })}>
                    <Send className="h-3 w-3" /> System Message
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs gap-1 text-red-400 border-red-500/30" onClick={() => setActionDialog({ type: 'escalate_dispute', orderId: deepDiveOrderId || undefined })}>
                    <AlertTriangle className="h-3 w-3" /> Escalate
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
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
              <Button onClick={handleAdminAction} disabled={!actionReason.trim() || adminAction.isPending}>
                {adminAction.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
