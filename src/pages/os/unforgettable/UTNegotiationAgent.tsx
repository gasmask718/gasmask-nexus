import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Bot, Send, Shield, Zap, Heart, MessageSquare, TrendingDown, Check, AlertTriangle, Copy } from 'lucide-react';

const STRATEGY_MODES = [
  { value: 'aggressive', label: '🔹 Aggressive', icon: Zap, desc: 'Push price hard, demand lower MOQ, compare competitors' },
  { value: 'balanced', label: '🔹 Balanced', icon: Shield, desc: 'Moderate negotiation, focus on relationship + price' },
  { value: 'relationship', label: '🔹 Relationship Builder', icon: Heart, desc: 'Build long-term trust, softer negotiation' },
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  initiated: { label: 'Initiated', color: 'bg-blue-100 text-blue-800' },
  awaiting_supplier_response: { label: 'Awaiting Response', color: 'bg-yellow-100 text-yellow-800' },
  counter_sent: { label: 'Counter Sent', color: 'bg-orange-100 text-orange-800' },
  negotiating: { label: 'Negotiating', color: 'bg-purple-100 text-purple-800' },
  optimized_offer_received: { label: 'Optimized Offer', color: 'bg-green-100 text-green-800' },
  finalized: { label: 'Finalized', color: 'bg-emerald-100 text-emerald-800' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800' },
};

function generateMessage(type: string, negotiation: any, strategy: string) {
  const name = negotiation.supplier_name || 'Supplier';
  const price = negotiation.current_offer_price;
  const moq = negotiation.current_moq;
  const targetPrice = negotiation.target_price;

  if (type === 'initial') {
    return `Hi ${name},

Thank you for your quote${price ? ` of $${price}/unit` : ''}.

We are reviewing multiple suppliers for this product and looking to build a long-term relationship.

Before proceeding, I wanted to see if there is flexibility on:

- Unit pricing${targetPrice ? ` (our target is around $${targetPrice}/unit)` : ' at our target quantity'}
- MOQ reduction for initial order
- Branding cost optimization
- Best possible shipping rate to USA

${strategy === 'aggressive' ? 'We have competitive offers from other manufacturers and need your best pricing to proceed.' : 'If we can align on pricing, we are ready to move forward quickly and scale volume.'}

Looking forward to your best offer.`;
  }

  if (type === 'counter') {
    const low = targetPrice ? (targetPrice * 0.9).toFixed(2) : '—';
    const high = targetPrice ? (targetPrice * 1.05).toFixed(2) : '—';
    return `Thanks for your response.

${strategy === 'aggressive'
  ? `We've received other quotes in the range of $${low}–$${high} per unit.\n\nIf you can match or beat this range and reduce MOQ${moq ? ` from ${moq}` : ''}, we will prioritize your company for this order and future volume.`
  : `We appreciate your pricing. However, to move forward we'd need to see improvement on:\n\n- Unit price closer to $${targetPrice || '—'}\n- ${moq ? `MOQ below ${moq}` : 'Lower MOQ for trial order'}\n- Any bundled shipping discounts`}

Please let me know your best possible offer.`;
  }

  if (type === 'shipping') {
    return `Can you check if there are more cost-efficient shipping options available (air vs sea)?

We are looking to optimize total landed cost. If sea freight with a reliable forwarder is available, we'd prefer that route for bulk orders.

Please share your best shipping rates for both methods.`;
  }

  if (type === 'close') {
    return `This looks good.

If you can confirm:
- Final unit price: $${price || '___'}
- MOQ: ${moq || '___'}
- Shipping: $___
- Production timeline: ___ days

We are ready to proceed immediately.

Please confirm and send next steps.`;
  }

  return '';
}

export default function UTNegotiationAgent() {
  const queryClient = useQueryClient();
  const [selectedNeg, setSelectedNeg] = useState<any>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [messageType, setMessageType] = useState('initial');
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [newNeg, setNewNeg] = useState({
    supplier_name: '', rfq_id: '', original_price: '', original_moq: '',
    target_price: '', target_moq: '', ai_strategy_mode: 'balanced',
  });

  const { data: negotiations = [] } = useQuery({
    queryKey: ['ut-negotiations'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ut_supplier_negotiations').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: rfqs = [] } = useQuery({
    queryKey: ['ut-rfqs-for-neg'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ut_rfq_requests').select('id, product_name, status');
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (neg: any) => {
      const { error } = await supabase.from('ut_supplier_negotiations').insert({
        supplier_name: neg.supplier_name,
        rfq_id: neg.rfq_id || null,
        original_price: parseFloat(neg.original_price) || null,
        original_moq: parseInt(neg.original_moq) || null,
        current_offer_price: parseFloat(neg.original_price) || null,
        current_moq: parseInt(neg.original_moq) || null,
        target_price: parseFloat(neg.target_price) || null,
        target_moq: parseInt(neg.target_moq) || null,
        ai_strategy_mode: neg.ai_strategy_mode,
        status: 'initiated',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ut-negotiations'] });
      toast.success('Negotiation started');
      setShowNewDialog(false);
      setNewNeg({ supplier_name: '', rfq_id: '', original_price: '', original_moq: '', target_price: '', target_moq: '', ai_strategy_mode: 'balanced' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await supabase.from('ut_supplier_negotiations').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ut-negotiations'] });
      toast.success('Negotiation updated');
    },
  });

  const handleGenerateMessage = () => {
    if (!selectedNeg) return;
    const msg = generateMessage(messageType, selectedNeg, selectedNeg.ai_strategy_mode || 'balanced');
    setGeneratedMessage(msg);
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(generatedMessage);
    toast.success('Message copied to clipboard');
  };

  const handleMarkSent = () => {
    if (!selectedNeg) return;
    const round = (selectedNeg.negotiation_round || 0) + 1;
    updateMutation.mutate({
      id: selectedNeg.id,
      updates: {
        last_message: generatedMessage,
        negotiation_round: round,
        status: messageType === 'close' ? 'optimized_offer_received' : 'awaiting_supplier_response',
        updated_at: new Date().toISOString(),
      },
    });
    setSelectedNeg({ ...selectedNeg, negotiation_round: round, status: 'awaiting_supplier_response' });
  };

  const handleRecordResponse = (data: any) => {
    if (!selectedNeg) return;
    const origPrice = selectedNeg.original_price || selectedNeg.current_offer_price || 0;
    const newPrice = parseFloat(data.unit_price) || origPrice;
    const priceReduction = origPrice > 0 ? ((origPrice - newPrice) / origPrice * 100) : 0;
    const origMoq = selectedNeg.original_moq || selectedNeg.current_moq || 0;
    const newMoq = parseInt(data.moq) || origMoq;
    const moqReduction = origMoq > 0 ? ((origMoq - newMoq) / origMoq * 100) : 0;

    const isBestPrice = !selectedNeg.best_offer_price || newPrice < selectedNeg.best_offer_price;

    updateMutation.mutate({
      id: selectedNeg.id,
      updates: {
        current_offer_price: newPrice,
        current_moq: newMoq,
        current_shipping_cost: parseFloat(data.shipping_cost) || null,
        current_branding_cost: parseFloat(data.branding_cost) || null,
        last_supplier_response: data.notes || null,
        price_reduction_pct: priceReduction,
        moq_reduction_pct: moqReduction,
        status: 'negotiating',
        ...(isBestPrice ? {
          best_offer_price: newPrice,
          best_offer_moq: newMoq,
          best_offer_shipping: parseFloat(data.shipping_cost) || null,
          best_offer_branding: parseFloat(data.branding_cost) || null,
        } : {}),
        updated_at: new Date().toISOString(),
      },
    });
  };

  const handleApprove = () => {
    if (!selectedNeg) return;
    const origPrice = selectedNeg.original_price || 0;
    const bestPrice = selectedNeg.best_offer_price || selectedNeg.current_offer_price || 0;
    const savings = origPrice > 0 ? (origPrice - bestPrice) * (selectedNeg.best_offer_moq || selectedNeg.current_moq || 100) : 0;

    updateMutation.mutate({
      id: selectedNeg.id,
      updates: { status: 'finalized', total_savings: savings, updated_at: new Date().toISOString() },
    });
    toast.success('🏆 Deal approved! Supplier locked.');
  };

  const [responseForm, setResponseForm] = useState({ unit_price: '', moq: '', shipping_cost: '', branding_cost: '', notes: '' });

  const activeNegs = negotiations.filter(n => !['finalized', 'rejected'].includes(n.status || ''));
  const completedNegs = negotiations.filter(n => ['finalized', 'rejected'].includes(n.status || ''));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bot className="h-8 w-8 text-primary" /> AI Negotiation Agent
          </h1>
          <p className="text-muted-foreground">Auto-negotiate pricing, MOQ, and shipping with suppliers</p>
        </div>
        <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Zap className="h-4 w-4" /> Start Negotiation</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Start New Negotiation</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Supplier Name</label>
                <Input value={newNeg.supplier_name} onChange={e => setNewNeg({ ...newNeg, supplier_name: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Link to RFQ (optional)</label>
                <Select value={newNeg.rfq_id} onValueChange={v => setNewNeg({ ...newNeg, rfq_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select RFQ" /></SelectTrigger>
                  <SelectContent>
                    {rfqs.map(r => (
                      <SelectItem key={r.id} value={r.id}>{r.product_name} ({r.status})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Their Price ($/unit)</label>
                  <Input type="number" value={newNeg.original_price} onChange={e => setNewNeg({ ...newNeg, original_price: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Their MOQ</label>
                  <Input type="number" value={newNeg.original_moq} onChange={e => setNewNeg({ ...newNeg, original_moq: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Your Target Price</label>
                  <Input type="number" value={newNeg.target_price} onChange={e => setNewNeg({ ...newNeg, target_price: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Your Target MOQ</label>
                  <Input type="number" value={newNeg.target_moq} onChange={e => setNewNeg({ ...newNeg, target_moq: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">AI Strategy Mode</label>
                <Select value={newNeg.ai_strategy_mode} onValueChange={v => setNewNeg({ ...newNeg, ai_strategy_mode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STRATEGY_MODES.map(m => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label} — {m.desc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={() => createMutation.mutate(newNeg)} disabled={!newNeg.supplier_name}>
                🚀 Launch Negotiation
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Strategy Mode Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {STRATEGY_MODES.map(m => {
          const Icon = m.icon;
          const count = negotiations.filter(n => n.ai_strategy_mode === m.value).length;
          return (
            <Card key={m.value} className="border-l-4 border-l-primary/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Icon className="h-6 w-6 text-primary" />
                  <div>
                    <p className="font-semibold">{m.label}</p>
                    <p className="text-xs text-muted-foreground">{m.desc}</p>
                    <p className="text-sm font-medium mt-1">{count} negotiations</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Negotiation List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Active Negotiations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              {activeNegs.length === 0 && (
                <p className="p-4 text-center text-muted-foreground">No active negotiations</p>
              )}
              {activeNegs.map(neg => {
                const st = STATUS_LABELS[neg.status || 'initiated'];
                return (
                  <button
                    key={neg.id}
                    onClick={() => { setSelectedNeg(neg); setGeneratedMessage(''); }}
                    className={`w-full p-4 text-left border-b hover:bg-accent/50 transition ${selectedNeg?.id === neg.id ? 'bg-accent' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{neg.supplier_name}</span>
                      <Badge className={st?.color || ''}>{st?.label || neg.status}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Round {neg.negotiation_round || 0} • {neg.ai_strategy_mode}
                    </div>
                    {neg.current_offer_price && (
                      <div className="text-sm mt-1">
                        ${Number(neg.current_offer_price).toFixed(2)}/unit
                        {neg.price_reduction_pct && Number(neg.price_reduction_pct) > 0 && (
                          <span className="text-green-600 ml-2">↓{Number(neg.price_reduction_pct).toFixed(1)}%</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
              {completedNegs.length > 0 && (
                <>
                  <div className="px-4 py-2 bg-muted text-xs font-medium">Completed</div>
                  {completedNegs.map(neg => {
                    const st = STATUS_LABELS[neg.status || 'finalized'];
                    return (
                      <button
                        key={neg.id}
                        onClick={() => { setSelectedNeg(neg); setGeneratedMessage(''); }}
                        className={`w-full p-4 text-left border-b hover:bg-accent/50 transition opacity-70 ${selectedNeg?.id === neg.id ? 'bg-accent' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{neg.supplier_name}</span>
                          <Badge className={st?.color || ''}>{st?.label}</Badge>
                        </div>
                        {neg.total_savings && Number(neg.total_savings) > 0 && (
                          <p className="text-xs text-green-600 mt-1">Saved ${Number(neg.total_savings).toFixed(2)}</p>
                        )}
                      </button>
                    );
                  })}
                </>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right: Conversation Panel */}
        <Card className="lg:col-span-2">
          {!selectedNeg ? (
            <CardContent className="flex items-center justify-center h-[560px] text-muted-foreground">
              <div className="text-center">
                <Bot className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p>Select a negotiation to begin</p>
              </div>
            </CardContent>
          ) : (
            <>
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selectedNeg.supplier_name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Round {selectedNeg.negotiation_round || 0}/{selectedNeg.max_rounds || 5} •
                      Strategy: {selectedNeg.ai_strategy_mode}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {selectedNeg.status !== 'finalized' && selectedNeg.status !== 'rejected' && (
                      <>
                        <Button variant="destructive" size="sm" onClick={() => updateMutation.mutate({ id: selectedNeg.id, updates: { status: 'rejected' } })}>
                          Reject
                        </Button>
                        <Button size="sm" className="gap-1 bg-green-600 hover:bg-green-700" onClick={handleApprove}>
                          <Check className="h-4 w-4" /> Approve Deal
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Current Offer Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                  <div className="bg-muted rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground">Current Price</p>
                    <p className="text-lg font-bold">${Number(selectedNeg.current_offer_price || 0).toFixed(2)}</p>
                  </div>
                  <div className="bg-muted rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground">Current MOQ</p>
                    <p className="text-lg font-bold">{selectedNeg.current_moq || '—'}</p>
                  </div>
                  <div className="bg-muted rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground">Price Reduction</p>
                    <p className="text-lg font-bold text-green-600">
                      {Number(selectedNeg.price_reduction_pct || 0).toFixed(1)}%
                    </p>
                  </div>
                  <div className="bg-muted rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground">Best Price</p>
                    <p className="text-lg font-bold text-primary">
                      ${Number(selectedNeg.best_offer_price || selectedNeg.current_offer_price || 0).toFixed(2)}
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-4">
                <Tabs defaultValue="generate">
                  <TabsList className="mb-4">
                    <TabsTrigger value="generate">🤖 Generate Message</TabsTrigger>
                    <TabsTrigger value="record">📝 Record Response</TabsTrigger>
                  </TabsList>

                  <TabsContent value="generate" className="space-y-4">
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { value: 'initial', label: '📨 Initial RFQ Follow-up' },
                        { value: 'counter', label: '💰 Counter Offer' },
                        { value: 'shipping', label: '🚢 Shipping Negotiation' },
                        { value: 'close', label: '✅ Final Close' },
                      ].map(t => (
                        <Button
                          key={t.value}
                          variant={messageType === t.value ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setMessageType(t.value)}
                        >
                          {t.label}
                        </Button>
                      ))}
                    </div>
                    <Button onClick={handleGenerateMessage} className="gap-2">
                      <Bot className="h-4 w-4" /> Generate AI Message
                    </Button>

                    {generatedMessage && (
                      <div className="space-y-3">
                        <Textarea
                          value={generatedMessage}
                          onChange={e => setGeneratedMessage(e.target.value)}
                          rows={12}
                          className="font-mono text-sm"
                        />
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={handleCopyMessage} className="gap-2">
                            <Copy className="h-4 w-4" /> Copy Message
                          </Button>
                          <Button onClick={handleMarkSent} className="gap-2">
                            <Send className="h-4 w-4" /> Mark as Sent
                          </Button>
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="record" className="space-y-4">
                    <p className="text-sm text-muted-foreground">Record the supplier's response to update negotiation data:</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-medium">Unit Price ($)</label>
                        <Input type="number" value={responseForm.unit_price} onChange={e => setResponseForm({ ...responseForm, unit_price: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-sm font-medium">MOQ</label>
                        <Input type="number" value={responseForm.moq} onChange={e => setResponseForm({ ...responseForm, moq: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Shipping Cost ($)</label>
                        <Input type="number" value={responseForm.shipping_cost} onChange={e => setResponseForm({ ...responseForm, shipping_cost: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Branding Cost ($/unit)</label>
                        <Input type="number" value={responseForm.branding_cost} onChange={e => setResponseForm({ ...responseForm, branding_cost: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Notes</label>
                      <Textarea value={responseForm.notes} onChange={e => setResponseForm({ ...responseForm, notes: e.target.value })} rows={3} />
                    </div>
                    <Button onClick={() => {
                      handleRecordResponse(responseForm);
                      setResponseForm({ unit_price: '', moq: '', shipping_cost: '', branding_cost: '', notes: '' });
                    }}>
                      📊 Record & Analyze Response
                    </Button>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
