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
import { Inbox, Send, Filter, Mail, MessageSquare, Globe, Search, PaperclipIcon, Star, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

export default function UTSupplierInbox() {
  const queryClient = useQueryClient();
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [filterChannel, setFilterChannel] = useState('all');
  const [filterRead, setFilterRead] = useState('all');
  const [search, setSearch] = useState('');
  const [replyText, setReplyText] = useState('');
  const [replyChannel, setReplyChannel] = useState('email');

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

  // Group conversations by supplier for sidebar
  const supplierThreads = suppliers.map((s: any) => {
    const msgs = allConversations.filter((c: any) => c.supplier_id === s.id);
    const unread = msgs.filter((c: any) => !c.read_status && c.direction === 'received').length;
    const lastMsg = msgs[0];
    return { ...s, unread, lastMsg, msgCount: msgs.length };
  }).filter((s: any) => s.msgCount > 0 || selectedSupplierId === s.id)
    .sort((a: any, b: any) => {
      if (a.unread !== b.unread) return b.unread - a.unread;
      const aTime = a.lastMsg?.created_at || '';
      const bTime = b.lastMsg?.created_at || '';
      return bTime.localeCompare(aTime);
    });

  const filteredThreads = supplierThreads.filter((s: any) =>
    !search || s.name?.toLowerCase().includes(search.toLowerCase())
  );

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
  const totalUnread = supplierThreads.reduce((acc: number, s: any) => acc + s.unread, 0);

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Inbox className="h-8 w-8" /> Supplier Inbox
          </h1>
          <p className="text-muted-foreground">All supplier conversations in one place</p>
        </div>
        {totalUnread > 0 && (
          <Badge variant="destructive" className="text-lg px-3 py-1">{totalUnread} unread</Badge>
        )}
      </div>

      <div className="grid grid-cols-12 gap-4 h-[calc(100vh-200px)]">
        {/* Sidebar - Supplier threads */}
        <div className="col-span-4 border rounded-lg flex flex-col">
          <div className="p-3 border-b space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search suppliers..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="flex gap-1">
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
                <p className="text-xs mt-1">Messages will appear here when you communicate with suppliers</p>
              </div>
            ) : (
              filteredThreads.map((s: any) => (
                <button
                  key={s.id}
                  onClick={() => { setSelectedSupplierId(s.id); }}
                  className={cn(
                    "w-full p-3 text-left border-b hover:bg-accent/50 transition-colors",
                    selectedSupplierId === s.id && "bg-accent"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate">{s.name}</span>
                        {s.unread > 0 && <Badge variant="destructive" className="text-xs">{s.unread}</Badge>}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        {s.lastMsg && (
                          <span className={cn("text-xs px-1.5 py-0.5 rounded flex items-center gap-1", channelColor(s.lastMsg.channel))}>
                            {channelIcon(s.lastMsg.channel)}
                            {s.lastMsg.channel}
                          </span>
                        )}
                        {s.country && <span className="text-xs text-muted-foreground">📍 {s.country}</span>}
                      </div>
                      {s.lastMsg && (
                        <p className="text-xs text-muted-foreground truncate mt-1">
                          {s.lastMsg.direction === 'sent' ? 'You: ' : ''}{s.lastMsg.message}
                        </p>
                      )}
                    </div>
                    {s.lastMsg && (
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatDistanceToNow(new Date(s.lastMsg.created_at), { addSuffix: false })}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </ScrollArea>
        </div>

        {/* Main conversation area */}
        <div className="col-span-8 border rounded-lg flex flex-col">
          {!selectedSupplierId ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg">Select a supplier to view conversation</p>
              </div>
            </div>
          ) : (
            <>
              <div className="p-4 border-b flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{selectedSupplier?.name}</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {selectedSupplier?.country && <span>📍 {selectedSupplier.country}</span>}
                    {selectedSupplier?.platform && <span>· {selectedSupplier.platform}</span>}
                    {selectedSupplier?.contact_email && <span>· {selectedSupplier.contact_email}</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline">{selectedSupplier?.status}</Badge>
                  {selectedSupplier?.preferred && <Badge className="bg-yellow-500/20 text-yellow-400"><Star className="h-3 w-3 mr-1" />Preferred</Badge>}
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
                      <p>No messages yet with this supplier</p>
                      <p className="text-xs mt-1">Send the first message below</p>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="p-4 border-t">
                <div className="flex gap-2 mb-2">
                  <Select value={replyChannel} onValueChange={setReplyChannel}>
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email"><Mail className="inline h-3 w-3 mr-1" />Email</SelectItem>
                      <SelectItem value="whatsapp"><MessageSquare className="inline h-3 w-3 mr-1" />WhatsApp</SelectItem>
                      <SelectItem value="alibaba"><Globe className="inline h-3 w-3 mr-1" />Alibaba</SelectItem>
                      <SelectItem value="manual"><MessageSquare className="inline h-3 w-3 mr-1" />Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Type your message..."
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    className="flex-1 min-h-[60px]"
                    onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) sendReply.mutate(); }}
                  />
                  <Button onClick={() => sendReply.mutate()} disabled={!replyText.trim()} className="self-end">
                    <Send className="h-4 w-4 mr-1" /> Send
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
