import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Mail, MessageSquare, Search, Send, Plus, Circle, Paperclip, FileText, CheckCircle, AlertTriangle, Settings } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { errText } from "@/lib/errText";

const MESSAGE_TEMPLATES = [
  { label: 'Initial Outreach', body: 'Hi [Supplier Name],\n\nI\'m reaching out from Unforgettable Times USA. We are an event rental and party supply company looking for a reliable supplier for [Product].\n\nCould you please send us:\n- Product catalog\n- MOQ and pricing\n- Branding/private label options\n- Shipping rates to USA\n\nThank you,\nUnforgettable Times Sourcing Team' },
  { label: 'Quote Request', body: 'Hi [Supplier Name],\n\nWe\'re interested in ordering [Product]. Could you provide:\n- Unit price for [Quantity] units\n- MOQ\n- Production time\n- Shipping options to USA\n- Branding cost for our logo\n\nPlease send your best offer.\n\nThank you' },
  { label: 'Sample Request', body: 'Hi [Supplier Name],\n\nWe\'d like to order samples before placing a bulk order.\n\nPlease provide:\n- Sample cost\n- Shipping cost to USA\n- Timeline\n\nWe\'ll cover sample + shipping costs.\n\nThank you' },
  { label: 'Sample Approval', body: 'Hi [Supplier Name],\n\nWe received and approved the sample. Great quality!\n\nWe\'re ready to proceed with a bulk order. Please confirm:\n- Final unit price\n- Production timeline\n- Payment terms\n- Shipping method\n\nLooking forward to working together.' },
  { label: 'Bulk Order Confirmation', body: 'Hi [Supplier Name],\n\nWe\'d like to place the following order:\n\nProduct: [Product]\nQuantity: [Qty]\nUnit Price: $[Price]\nBranding: [Yes/No]\nShipping: [Method]\n\nPlease confirm and send payment details for deposit.\n\nThank you' },
  { label: 'Shipping Confirmation', body: 'Hi [Supplier Name],\n\nCould you please provide:\n- Tracking number\n- Estimated delivery date\n- Shipping method used\n- Packing list\n\nThank you' },
  { label: 'Payment Confirmation', body: 'Hi [Supplier Name],\n\nPayment of $[Amount] has been sent via [Method].\n\nPlease confirm receipt and provide production timeline.\n\nThank you' },
];

export default function UTSupplierInboxV2() {
  const [threads, setThreads] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedThread, setSelectedThread] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [replyChannel, setReplyChannel] = useState('email');
  const [replySubject, setReplySubject] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [sending, setSending] = useState(false);
  const [showNewThread, setShowNewThread] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierEmail, setNewSupplierEmail] = useState('');
  const [newSupplierWhatsapp, setNewSupplierWhatsapp] = useState('');
  const [newProductName, setNewProductName] = useState('');
  const [showSetup, setShowSetup] = useState(true);

  useEffect(() => { fetchThreads(); }, []);

  const fetchThreads = async () => {
    const { data } = await supabase.from('ut_supplier_threads' as any).select('*').order('last_message_at', { ascending: false });
    setThreads((data || []) as any[]);
  };

  const fetchMessages = async (threadId: string) => {
    const { data } = await supabase.from('ut_supplier_messages' as any).select('*').eq('thread_id', threadId).order('created_at', { ascending: true });
    setMessages((data || []) as any[]);
    // Mark as read
    await supabase.from('ut_supplier_messages' as any).update({ is_read: true } as any).eq('thread_id', threadId).eq('is_read', false);
    await supabase.from('ut_supplier_threads' as any).update({ unread_count: 0 } as any).eq('id', threadId);
    fetchThreads();
  };

  const selectThread = (thread: any) => {
    setSelectedThread(thread);
    setReplyChannel(thread.supplier_email ? 'email' : 'whatsapp');
    fetchMessages(thread.id);
  };

  const createThread = async () => {
    if (!newSupplierName.trim()) { toast.error('Enter supplier name'); return; }
    const { data, error } = await supabase.from('ut_supplier_threads' as any).insert({
      supplier_name: newSupplierName,
      supplier_email: newSupplierEmail || null,
      supplier_whatsapp: newSupplierWhatsapp || null,
      product_name: newProductName || null,
      subject: `Sourcing: ${newProductName || 'General'}`,
      last_message_at: new Date().toISOString(),
      status: 'active',
    } as any).select().single();
    if (error) { toast.error('Failed to create thread'); return; }
    toast.success('Thread created');
    setShowNewThread(false);
    setNewSupplierName(''); setNewSupplierEmail(''); setNewSupplierWhatsapp(''); setNewProductName('');
    fetchThreads();
    if (data) selectThread(data);
  };

  const sendMessage = async () => {
    if (!replyBody.trim() || !selectedThread) return;
    setSending(true);
    try {
      const to = replyChannel === 'email' ? selectedThread.supplier_email : selectedThread.supplier_whatsapp;
      if (!to) { toast.error(`No ${replyChannel} for this supplier`); setSending(false); return; }

      const { error } = await supabase.functions.invoke('supplier-send', {
        body: {
          channel: replyChannel,
          to,
          subject: replySubject || `RE: ${selectedThread.subject || 'Sourcing Inquiry'}`,
          body: replyBody,
          supplier_id: selectedThread.supplier_id,
          supplier_name: selectedThread.supplier_name,
          rfq_id: selectedThread.rfq_id,
          thread_id: selectedThread.id,
          product_name: selectedThread.product_name,
        }
      });
      if (error) throw error;
      toast.success(`Message sent via ${replyChannel}`);
      setReplyBody('');
      setReplySubject('');
      fetchMessages(selectedThread.id);
    } catch (err) {
      console.error(errText(err));
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const filteredThreads = threads.filter(t => {
    if (searchQuery && !t.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase()) && !t.product_name?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filter === 'unread') return (t.unread_count || 0) > 0;
    if (filter === 'email') return !!t.supplier_email;
    if (filter === 'whatsapp') return !!t.supplier_whatsapp;
    return true;
  });

  return (
    <div className="space-y-4 p-6">
      {showSetup && (
        <Card className="border-amber-500/50 bg-amber-500/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> ⚙️ Supplier Inbox Setup Required</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowSetup(false)}>Dismiss</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="space-y-2">
              <p className="font-medium">Step 1 — SendGrid Inbound Parse:</p>
              <ol className="list-decimal ml-5 space-y-1 text-muted-foreground">
                <li>Go to sendgrid.com → Settings → Inbound Parse</li>
                <li>Add domain: unforgettabletimes.com</li>
                <li>Set webhook URL: <code className="text-xs bg-muted px-1 rounded">{`https://qalaaroashbggynpvqct.supabase.co/functions/v1/supplier-reply-webhook`}</code></li>
                <li>Save</li>
              </ol>
            </div>
            <div className="space-y-2">
              <p className="font-medium">Step 2 — WhatsApp Business via Twilio:</p>
              <ol className="list-decimal ml-5 space-y-1 text-muted-foreground">
                <li>Go to twilio.com → Messaging → Try WhatsApp</li>
                <li>Connect your WhatsApp number</li>
                <li>Add env var: TWILIO_WHATSAPP_NUMBER</li>
              </ol>
            </div>
            <div className="space-y-2">
              <p className="font-medium">Step 3 — Supplier Email:</p>
              <p className="text-muted-foreground">Create suppliers@unforgettabletimes.com and point to SendGrid for parsing</p>
            </div>
            <Button size="sm" onClick={() => setShowSetup(false)}><CheckCircle className="mr-1 h-4 w-4" /> Mark Setup Complete</Button>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">📬 Supplier Inbox</h1>
          <p className="text-muted-foreground">All supplier conversations in one place</p>
        </div>
        <Button onClick={() => setShowNewThread(true)}><Plus className="mr-1 h-4 w-4" /> New Thread</Button>
      </div>

      {showNewThread && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold">Start New Conversation</h3>
            <div className="grid md:grid-cols-2 gap-3">
              <Input placeholder="Supplier Name *" value={newSupplierName} onChange={e => setNewSupplierName(e.target.value)} />
              <Input placeholder="Product Name" value={newProductName} onChange={e => setNewProductName(e.target.value)} />
              <Input placeholder="Email Address" value={newSupplierEmail} onChange={e => setNewSupplierEmail(e.target.value)} />
              <Input placeholder="WhatsApp Number (+1...)" value={newSupplierWhatsapp} onChange={e => setNewSupplierWhatsapp(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button onClick={createThread}>Create Thread</Button>
              <Button variant="ghost" onClick={() => setShowNewThread(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-4 h-[calc(100vh-280px)] min-h-[500px]">
        {/* LEFT PANEL - Thread List */}
        <div className="w-80 flex-shrink-0 border rounded-lg overflow-hidden flex flex-col bg-card">
          <div className="p-3 border-b space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search suppliers, products..." className="pl-8 h-9" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <Tabs value={filter} onValueChange={setFilter}>
              <TabsList className="w-full grid grid-cols-4 h-8">
                <TabsTrigger value="all" className="text-xs px-1">All</TabsTrigger>
                <TabsTrigger value="unread" className="text-xs px-1">Unread</TabsTrigger>
                <TabsTrigger value="email" className="text-xs px-1">📧</TabsTrigger>
                <TabsTrigger value="whatsapp" className="text-xs px-1">💬</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <ScrollArea className="flex-1">
            {filteredThreads.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm p-4">No threads yet</p>
            ) : filteredThreads.map(thread => (
              <div
                key={thread.id}
                onClick={() => selectThread(thread)}
                className={cn(
                  "p-3 border-b cursor-pointer hover:bg-accent/50 transition-colors",
                  selectedThread?.id === thread.id && "bg-accent"
                )}
              >
                <div className="flex items-start justify-between">
                  <span className={cn("font-medium text-sm", thread.unread_count > 0 && "font-bold")}>
                    🏭 {thread.supplier_name}
                  </span>
                  {thread.unread_count > 0 && (
                    <span className="bg-blue-500 text-white text-[10px] rounded-full h-5 min-w-5 flex items-center justify-center px-1">{thread.unread_count}</span>
                  )}
                </div>
                {thread.product_name && <p className="text-xs text-muted-foreground mt-0.5">📦 {thread.product_name}</p>}
                {thread.last_message_preview && (
                  <p className={cn("text-xs mt-1 line-clamp-1", thread.unread_count > 0 ? "text-foreground" : "text-muted-foreground")}>
                    {thread.last_message_preview}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  {thread.supplier_email && <Mail className="h-3 w-3 text-blue-400" />}
                  {thread.supplier_whatsapp && <MessageSquare className="h-3 w-3 text-green-400" />}
                  {thread.last_message_at && <span className="text-[10px] text-muted-foreground">{format(new Date(thread.last_message_at), 'MMM d, yyyy, h:mm a')}</span>}
                </div>
              </div>
            ))}
          </ScrollArea>
        </div>

        {/* RIGHT PANEL - Conversation */}
        <div className="flex-1 border rounded-lg overflow-hidden flex flex-col bg-card">
          {!selectedThread ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Mail className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p>Select a thread to view conversation</p>
              </div>
            </div>
          ) : (
            <>
              {/* Thread Header */}
              <div className="p-4 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{selectedThread.supplier_name}</h3>
                    {selectedThread.product_name && <p className="text-sm text-muted-foreground">📦 {selectedThread.product_name}</p>}
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {selectedThread.supplier_email && <span>📧 {selectedThread.supplier_email}</span>}
                      {selectedThread.supplier_whatsapp && <span>💬 {selectedThread.supplier_whatsapp}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {selectedThread.supplier_email && <Badge variant="outline" className="text-blue-400 border-blue-400/50"><Mail className="h-3 w-3 mr-1" />Email</Badge>}
                    {selectedThread.supplier_whatsapp && <Badge variant="outline" className="text-green-400 border-green-400/50"><MessageSquare className="h-3 w-3 mr-1" />WhatsApp</Badge>}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                  {messages.length === 0 ? (
                    <p className="text-center text-muted-foreground text-sm py-8">No messages yet. Start the conversation!</p>
                  ) : messages.map(msg => (
                    <div key={msg.id} className={cn("flex", msg.direction === 'outbound' ? "justify-end" : "justify-start")}>
                      <div className={cn(
                        "max-w-[70%] rounded-lg p-3",
                        msg.direction === 'outbound' ? "bg-primary/20 text-foreground" : "bg-muted"
                      )}>
                        {msg.subject && <p className="text-xs font-medium mb-1">{msg.subject}</p>}
                        <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {msg.channel === 'email' ? <Mail className="h-3 w-3 text-blue-400" /> : <MessageSquare className="h-3 w-3 text-green-400" />}
                          <span className="text-[10px] text-muted-foreground">{format(new Date(msg.created_at), 'MMM d, yyyy, h:mm a')}</span>
                          {msg.direction === 'outbound' && msg.is_read && <CheckCircle className="h-3 w-3 text-green-400" />}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Reply Box */}
              <div className="p-4 border-t space-y-2">
                <div className="flex items-center gap-2">
                  <Tabs value={replyChannel} onValueChange={setReplyChannel}>
                    <TabsList className="h-8">
                      <TabsTrigger value="email" className="text-xs px-3" disabled={!selectedThread.supplier_email}>📧 Email</TabsTrigger>
                      <TabsTrigger value="whatsapp" className="text-xs px-3" disabled={!selectedThread.supplier_whatsapp}>💬 WhatsApp</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <Select onValueChange={(val) => { const t = MESSAGE_TEMPLATES.find(t => t.label === val); if (t) setReplyBody(t.body.replace(/\[Supplier Name\]/g, selectedThread.supplier_name)); }}>
                    <SelectTrigger className="w-40 h-8"><SelectValue placeholder="Template..." /></SelectTrigger>
                    <SelectContent>
                      {MESSAGE_TEMPLATES.map(t => <SelectItem key={t.label} value={t.label}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {replyChannel === 'email' && (
                  <Input placeholder="Subject" value={replySubject} onChange={e => setReplySubject(e.target.value)} className="h-8" />
                )}
                <Textarea placeholder="Type your message..." value={replyBody} onChange={e => setReplyBody(e.target.value)} rows={4} />
                <div className="flex justify-between">
                  <Button variant="ghost" size="sm"><Paperclip className="h-4 w-4 mr-1" /> Attach</Button>
                  <Button onClick={sendMessage} disabled={sending || !replyBody.trim()}>
                    <Send className="h-4 w-4 mr-1" /> {sending ? 'Sending...' : 'Send'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
