import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Inbox, Send, Mail, MessageSquare, Globe, Search, PaperclipIcon, Star, User, Bot, AlertTriangle, Tag, Shield, Zap, DollarSign, Package } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { errText } from "@/lib/errText";

type AIAction = 'first_message' | 'counter_offer' | 'shipping_negotiation' | 'close_deal' | 'suggested_reply';

export default function UTSupplierInbox() {
  const queryClient = useQueryClient();
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [filterChannel, setFilterChannel] = useState('all');
  const [search, setSearch] = useState('');
  const [replyText, setReplyText] = useState('');
  const [replyChannel, setReplyChannel] = useState('email');
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [filterUrgent, setFilterUrgent] = useState(false);

  const { data: suppliers = [] } = useQuery({
    queryKey: ['ut-suppliers-inbox'],
    queryFn: async () => {
      const { data } = await supabase.from('ut_suppliers' as any).select('*').order('name');
      return (data || []) as any[];
    },
  });

  const { data: conversations = [] } = useQuery({
    queryKey: ['ut-supplier-conversations', selectedSupplierId, filterChannel],
    queryFn: async () => {
      let q = supabase.from('ut_supplier_conversations' as any).select('*').order('created_at', { ascending: true });
      if (selectedSupplierId) q = q.eq('supplier_id', selectedSupplierId);
      if (filterChannel !== 'all') q = q.eq('channel', filterChannel);
      const { data } = await q;
      return (data || []) as any[];
    },
  });

  const { data: allConversations = [] } = useQuery({
    queryKey: ['ut-supplier-conversations-all'],
    queryFn: async () => {
      const { data } = await supabase.from('ut_supplier_conversations' as any).select('*').order('created_at', { ascending: false });
      return (data || []) as any[];
    },
  });

  const { data: negotiations = [] } = useQuery({
    queryKey: ['ut-negotiations-inbox'],
    queryFn: async () => {
      const { data } = await supabase.from('ut_supplier_negotiations' as any).select('*');
      return (data || []) as any[];
    },
  });

  const { data: rfqs = [] } = useQuery({
    queryKey: ['ut-rfqs-inbox'],
    queryFn: async () => {
      const { data } = await supabase.from('ut_rfq_requests' as any).select('*');
      return (data || []) as any[];
    },
  });

  const { data: rfqResponses = [] } = useQuery({
    queryKey: ['ut-rfq-responses-inbox'],
    queryFn: async () => {
      const { data } = await supabase.from('ut_rfq_supplier_responses' as any).select('*');
      return (data || []) as any[];
    },
  });

  // Group conversations by supplier for sidebar
  const supplierThreads = suppliers.map((s: any) => {
    const msgs = allConversations.filter((c: any) => c.supplier_id === s.id);
    const unread = msgs.filter((c: any) => !c.read_status && c.direction === 'received').length;
    const lastMsg = msgs[0];
    const isUrgent = s.is_urgent || unread > 3;
    return { ...s, unread, lastMsg, msgCount: msgs.length, isUrgent };
  }).filter((s: any) => s.msgCount > 0 || selectedSupplierId === s.id)
    .sort((a: any, b: any) => {
      if (a.isUrgent !== b.isUrgent) return b.isUrgent ? 1 : -1;
      if (a.unread !== b.unread) return b.unread - a.unread;
      const aTime = a.lastMsg?.created_at || '';
      const bTime = b.lastMsg?.created_at || '';
      return bTime.localeCompare(aTime);
    });

  const filteredThreads = supplierThreads.filter((s: any) => {
    if (search && !s.name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterUrgent && !s.isUrgent) return false;
    return true;
  });

  const sendReply = useMutation({
    mutationFn: async () => {
      if (!selectedSupplierId || !replyText.trim()) return;
      const { error } = await supabase.from('ut_supplier_conversations' as any).insert({
        supplier_id: selectedSupplierId,
        channel: replyChannel,
        message: replyText,
        direction: 'sent',
        read_status: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ut-supplier-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['ut-supplier-conversations-all'] });
      setReplyText('');
      toast.success('Message sent');
    },
    onError: () => toast.error('Failed to send'),
  });

  const markAsRead = async (id: string) => {
    await supabase.from('ut_supplier_conversations' as any).update({ read_status: true }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['ut-supplier-conversations'] });
    queryClient.invalidateQueries({ queryKey: ['ut-supplier-conversations-all'] });
  };

  const markUrgent = async (supplierId: string) => {
    await supabase.from('ut_suppliers' as any).update({ is_urgent: true }).eq('id', supplierId);
    queryClient.invalidateQueries({ queryKey: ['ut-suppliers-inbox'] });
    toast.success('Marked as urgent');
  };

  const flagRisk = async (supplierId: string) => {
    await supabase.from('ut_supplier_risk_profiles' as any).upsert({
      supplier_id: supplierId,
      risk_level: 'high',
      risk_score: 80,
      flagged_issues_count: 1,
      last_updated: new Date().toISOString(),
    }, { onConflict: 'supplier_id' } as any);
    await supabase.from('ut_suppliers' as any).update({ risk_score: 80 }).eq('id', supplierId);
    toast.warning('Supplier flagged as high risk');
  };

  const generateAIMessage = async (action: AIAction) => {
    setAiGenerating(true);
    try {
      const supplier = suppliers.find((s: any) => s.id === selectedSupplierId);
      const supplierNeg = negotiations.find((n: any) => n.supplier_id === selectedSupplierId);
      const supplierRFQResponses = rfqResponses.filter((r: any) => r.supplier_id === selectedSupplierId);
      const recentConvos = conversations.slice(-5).map((c: any) => `${c.direction}: ${c.message}`).join('\n');

      const context = {
        supplier_name: supplier?.name,
        action,
        negotiation: supplierNeg ? {
          round: supplierNeg.negotiation_round,
          current_price: supplierNeg.current_offer_price,
          target_price: supplierNeg.target_price,
          current_moq: supplierNeg.current_moq,
          shipping_cost: supplierNeg.current_shipping_cost,
          best_offer: supplierNeg.best_offer_price,
        } : null,
        rfq_responses: supplierRFQResponses.map((r: any) => ({
          unit_price: r.unit_price,
          moq: r.moq,
          shipping_cost: r.shipping_cost,
          production_days: r.production_days,
        })),
        recent_conversation: recentConvos,
        competitor_prices: rfqResponses
          .filter((r: any) => r.supplier_id !== selectedSupplierId)
          .slice(0, 3)
          .map((r: any) => ({ supplier: r.supplier_name, price: r.unit_price, moq: r.moq })),
      };

      const { data, error } = await supabase.functions.invoke('ut-ai-negotiation', {
        body: { context },
      });

      if (error) throw error;
      setReplyText(data?.message || 'AI message generation failed.');

      // Update negotiation round
      if (supplierNeg && (action === 'counter_offer' || action === 'close_deal')) {
        await supabase.from('ut_supplier_negotiations' as any).update({
          negotiation_round: (supplierNeg.negotiation_round || 0) + 1,
          last_message: data?.message,
          updated_at: new Date().toISOString(),
        }).eq('id', supplierNeg.id);
      }

      toast.success(`AI ${action.replace('_', ' ')} generated`);
    } catch (err) {
      console.error(errText(err));
      // Fallback templates
      const supplier = suppliers.find((s: any) => s.id === selectedSupplierId);
      const templates: Record<AIAction, string> = {
        first_message: `Hi ${supplier?.name || 'there'},\n\nWe're interested in sourcing products from your catalog. Could you share your latest pricing, MOQ requirements, and shipping options to the United States?\n\nWe're looking for competitive pricing on bulk orders with potential for long-term partnership.\n\nBest regards`,
        counter_offer: `Thank you for your quote. We appreciate your responsiveness.\n\nAfter reviewing competitive offers, we'd like to propose the following:\n- Unit price: We need to be closer to our target\n- MOQ: Can you be more flexible?\n- Shipping: Can you offer better rates for bulk?\n\nWe're committed to a long-term relationship if we can align on pricing.\n\nLooking forward to your response.`,
        shipping_negotiation: `Hi ${supplier?.name || 'there'},\n\nWe'd like to discuss shipping options:\n\n1. What are your rates for sea freight vs air freight?\n2. Can you offer FOB pricing?\n3. Do you work with any freight forwarders you'd recommend?\n4. What's the typical transit time?\n\nWe need to optimize our landed cost per unit.\n\nThank you.`,
        close_deal: `Hi ${supplier?.name || 'there'},\n\nBased on our discussions, we're ready to proceed with the order.\n\nPlease confirm the following terms:\n- Final unit price\n- MOQ and total quantity\n- Payment terms\n- Production timeline\n- Shipping method and cost\n\nOnce confirmed, we'll process the order.\n\nBest regards`,
        suggested_reply: `Thank you for your message. We'll review the details and get back to you shortly.`,
      };
      setReplyText(templates[action]);
      toast.info('Using template (AI unavailable)');
    } finally {
      setAiGenerating(false);
    }
  };

  const channelIcon = (ch: string) => {
    switch (ch) {
      case 'email': return <Mail className="h-3 w-3" />;
      case 'whatsapp': return <MessageSquare className="h-3 w-3" />;
      case 'alibaba': return <Globe className="h-3 w-3" />;
      default: return <MessageSquare className="h-3 w-3" />;
    }
  };

  const channelColor = (ch: string) => {
    switch (ch) {
      case 'email': return 'bg-blue-500/20 text-blue-400';
      case 'whatsapp': return 'bg-green-500/20 text-green-400';
      case 'alibaba': return 'bg-orange-500/20 text-orange-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const selectedSupplier = suppliers.find((s: any) => s.id === selectedSupplierId);
  const selectedNeg = negotiations.find((n: any) => n.supplier_id === selectedSupplierId);
  const totalUnread = supplierThreads.reduce((acc: number, s: any) => acc + s.unread, 0);

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Inbox className="h-8 w-8" /> Supplier Inbox
          </h1>
          <p className="text-muted-foreground">AI-powered supplier conversations & negotiation</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={filterUrgent ? 'destructive' : 'outline'} size="sm" onClick={() => setFilterUrgent(!filterUrgent)}>
            <AlertTriangle className="h-4 w-4 mr-1" /> Urgent Only
          </Button>
          {totalUnread > 0 && (
            <Badge variant="destructive" className="text-lg px-3 py-1">{totalUnread} unread</Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 h-[calc(100vh-200px)]">
        {/* Sidebar - Supplier threads */}
        <div className="col-span-3 border rounded-lg flex flex-col">
          <div className="p-3 border-b space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search suppliers..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="flex gap-1 flex-wrap">
              {['all', 'email', 'whatsapp', 'alibaba'].map(ch => (
                <Button key={ch} size="sm" variant={filterChannel === ch ? 'default' : 'outline'} onClick={() => setFilterChannel(ch)} className="text-xs capitalize">
                  {ch}
                </Button>
              ))}
            </div>
          </div>
          <ScrollArea className="flex-1">
            {filteredThreads.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Inbox className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No conversations yet</p>
              </div>
            ) : (
              filteredThreads.map((s: any) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSupplierId(s.id)}
                  className={cn(
                    "w-full p-3 text-left border-b hover:bg-accent/50 transition-colors",
                    selectedSupplierId === s.id && "bg-accent",
                    s.isUrgent && "border-l-2 border-l-destructive"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate text-sm">{s.name}</span>
                        {s.unread > 0 && <Badge variant="destructive" className="text-[10px] h-5">{s.unread}</Badge>}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        {s.isUrgent && <Badge variant="destructive" className="text-[9px] h-4">🔥 URGENT</Badge>}
                        {s.risk_score > 60 && <Badge className="bg-red-500/20 text-red-400 text-[9px] h-4">⚠️ Risk</Badge>}
                      </div>
                      {s.lastMsg && (
                        <p className="text-xs text-muted-foreground truncate mt-1">
                          {s.lastMsg.direction === 'sent' ? 'You: ' : ''}{s.lastMsg.message}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </ScrollArea>
        </div>

        {/* Main conversation area */}
        <div className={cn("border rounded-lg flex flex-col", showAIPanel ? "col-span-6" : "col-span-9")}>
          {!selectedSupplierId ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg">Select a supplier to view conversation</p>
              </div>
            </div>
          ) : (
            <>
              <div className="p-3 border-b flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{selectedSupplier?.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {selectedSupplier?.source_platform && <span>{selectedSupplier.source_platform}</span>}
                    {selectedSupplier?.email && <span>· {selectedSupplier.email}</span>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => markUrgent(selectedSupplierId!)}>
                    <AlertTriangle className="h-3 w-3 mr-1" /> Urgent
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => flagRisk(selectedSupplierId!)}>
                    <Shield className="h-3 w-3 mr-1" /> Flag Risk
                  </Button>
                  <Button size="sm" variant={showAIPanel ? 'default' : 'outline'} onClick={() => setShowAIPanel(!showAIPanel)}>
                    <Bot className="h-3 w-3 mr-1" /> AI Agent
                  </Button>
                </div>
              </div>

              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                  {conversations.map((msg: any) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "max-w-[80%] p-3 rounded-lg",
                        msg.direction === 'sent'
                          ? "ml-auto bg-primary/10 border border-primary/20"
                          : "bg-muted"
                      )}
                      onClick={() => { if (!msg.read_status && msg.direction === 'received') markAsRead(msg.id); }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn("text-xs px-1.5 py-0.5 rounded flex items-center gap-1", channelColor(msg.channel))}>
                          {channelIcon(msg.channel)} {msg.channel}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {msg.direction === 'sent' ? 'You' : selectedSupplier?.name}
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {new Date(msg.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                      {msg.attachment_url && (
                        <a href={msg.attachment_url} target="_blank" rel="noreferrer" className="text-xs text-primary flex items-center gap-1 mt-1">
                          <PaperclipIcon className="h-3 w-3" /> Attachment
                        </a>
                      )}
                      {!msg.read_status && msg.direction === 'received' && (
                        <Badge variant="destructive" className="text-[10px] mt-1">New</Badge>
                      )}
                    </div>
                  ))}
                  {conversations.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <p>No messages yet</p>
                      <p className="text-xs mt-1">Send the first message or use AI to generate one</p>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="p-3 border-t space-y-2">
                {/* Quick AI buttons */}
                <div className="flex gap-1 flex-wrap">
                  <Button size="sm" variant="ghost" className="text-xs" onClick={() => generateAIMessage('suggested_reply')} disabled={aiGenerating}>
                    <Bot className="h-3 w-3 mr-1" /> AI Reply
                  </Button>
                  <Button size="sm" variant="ghost" className="text-xs" onClick={() => generateAIMessage('counter_offer')} disabled={aiGenerating}>
                    <DollarSign className="h-3 w-3 mr-1" /> Counter Offer
                  </Button>
                  <Button size="sm" variant="ghost" className="text-xs" onClick={() => generateAIMessage('close_deal')} disabled={aiGenerating}>
                    <Zap className="h-3 w-3 mr-1" /> Close Deal
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Select value={replyChannel} onValueChange={setReplyChannel}>
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="alibaba">Alibaba</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                  <Textarea
                    placeholder="Type your message..."
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    className="flex-1 min-h-[50px] max-h-[120px]"
                    onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) sendReply.mutate(); }}
                  />
                  <Button onClick={() => sendReply.mutate()} disabled={!replyText.trim()} className="self-end">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* AI Negotiation Panel */}
        {showAIPanel && selectedSupplierId && (
          <div className="col-span-3 border rounded-lg flex flex-col">
            <div className="p-3 border-b">
              <h3 className="font-semibold flex items-center gap-2 text-sm">
                <Bot className="h-4 w-4" /> AI Negotiation Assistant
              </h3>
            </div>
            <ScrollArea className="flex-1 p-3 space-y-3">
              <div className="space-y-3">
                {/* Negotiation status */}
                {selectedNeg && (
                  <Card>
                    <CardContent className="p-3 space-y-2">
                      <p className="text-xs font-semibold">Active Negotiation</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-muted-foreground">Round</p>
                          <p className="font-bold">{selectedNeg.negotiation_round || 1}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Status</p>
                          <Badge variant="outline" className="text-[10px]">{selectedNeg.status}</Badge>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Current Price</p>
                          <p className="font-bold">${selectedNeg.current_offer_price || '—'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Target</p>
                          <p className="font-bold text-green-400">${selectedNeg.target_price || '—'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Best Offer</p>
                          <p className="font-bold">${selectedNeg.best_offer_price || '—'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Savings</p>
                          <p className="font-bold text-green-400">{selectedNeg.price_reduction_pct ? `${selectedNeg.price_reduction_pct}%` : '—'}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Risk info */}
                <Card>
                  <CardContent className="p-3 space-y-1">
                    <p className="text-xs font-semibold">Supplier Risk</p>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-3 h-3 rounded-full",
                        (selectedSupplier?.risk_score || 50) > 70 ? "bg-red-500" :
                        (selectedSupplier?.risk_score || 50) > 40 ? "bg-yellow-500" : "bg-green-500"
                      )} />
                      <span className="text-sm font-bold">{selectedSupplier?.risk_score || 50}/100</span>
                      <span className="text-xs text-muted-foreground">
                        {(selectedSupplier?.risk_score || 50) > 70 ? 'High Risk' :
                         (selectedSupplier?.risk_score || 50) > 40 ? 'Medium' : 'Low Risk'}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* AI Action Buttons */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold">Generate Message</p>
                  <Button size="sm" className="w-full justify-start text-xs" variant="outline"
                    onClick={() => generateAIMessage('first_message')} disabled={aiGenerating}>
                    <Send className="h-3 w-3 mr-2" /> Generate First Message
                  </Button>
                  <Button size="sm" className="w-full justify-start text-xs" variant="outline"
                    onClick={() => generateAIMessage('counter_offer')} disabled={aiGenerating}>
                    <DollarSign className="h-3 w-3 mr-2" /> Generate Counter Offer
                  </Button>
                  <Button size="sm" className="w-full justify-start text-xs" variant="outline"
                    onClick={() => generateAIMessage('shipping_negotiation')} disabled={aiGenerating}>
                    <Package className="h-3 w-3 mr-2" /> Negotiate Shipping
                  </Button>
                  <Button size="sm" className="w-full justify-start text-xs" variant="outline"
                    onClick={() => generateAIMessage('close_deal')} disabled={aiGenerating}>
                    <Zap className="h-3 w-3 mr-2" /> Generate Close Deal
                  </Button>
                </div>

                {/* Competitor context */}
                {rfqResponses.filter((r: any) => r.supplier_id !== selectedSupplierId).length > 0 && (
                  <Card>
                    <CardContent className="p-3 space-y-1">
                      <p className="text-xs font-semibold">Competitor Quotes</p>
                      {rfqResponses.filter((r: any) => r.supplier_id !== selectedSupplierId).slice(0, 3).map((r: any, i: number) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{r.supplier_name}</span>
                          <span className="font-mono">${r.unit_price}/unit</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {aiGenerating && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground p-3">
                    <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                    Generating AI message...
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}
