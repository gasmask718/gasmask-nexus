import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  MessageSquare, Send, Search, User, Phone, Store,
  Sparkles, Check, CheckCheck, Plus, Loader2, ArrowLeft,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, isToday, isYesterday } from 'date-fns';

// ── Types ──────────────────────────────────────────────
interface Contact {
  id: string;
  name: string;
  phone: string;
  type: 'person' | 'store' | 'custom';
  subtitle?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unread: number;
}

interface TextMessage {
  id: string;
  body: string;
  direction: 'inbound' | 'outbound';
  created_at: string;
  status?: string;
  source: 'comm_log' | 'messaging' | 'brandaro';
}

// ── Helpers ────────────────────────────────────────────
const normalizePhone = (p: string) => {
  const d = p.replace(/\D/g, '');
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d[0] === '1') return `+${d}`;
  if (d.length > 6) return `+${d}`;
  return p;
};

const formatPhone = (p: string) => {
  const d = p.replace(/\D/g, '');
  if (d.length === 11 && d[0] === '1') {
    return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  }
  if (d.length === 10) {
    return `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return p;
};

const formatTimestamp = (d: string) => {
  const date = new Date(d);
  if (isToday(date)) return format(date, 'h:mm a');
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMM d, yyyy');
};

// ── Main Component ─────────────────────────────────────
const ManualTextPage = () => {
  const [searchParams] = useSearchParams();
  const preselectedPhone = searchParams.get('phone');
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [customNumber, setCustomNumber] = useState('');
  const [mobileShowThread, setMobileShowThread] = useState(false);

  // ── Fetch all contacts (people + stores) ─────────────
  const { data: contacts = [], isLoading: loadingContacts } = useQuery({
    queryKey: ['manual-text-contacts'],
    queryFn: async () => {
      const results: Contact[] = [];

      // Fetch people with phone numbers
      const { data: people } = await supabase
        .from('people')
        .select('id, name, phone, organization, type')
        .not('phone', 'is', null)
        .order('last_contact_date', { ascending: false, nullsFirst: false });

      if (people) {
        for (const p of people) {
          if (!p.phone) continue;
          results.push({
            id: p.id,
            name: p.name || 'Unknown',
            phone: normalizePhone(p.phone),
            type: 'person',
            subtitle: p.organization || p.type || undefined,
            unread: 0,
          });
        }
      }

      // Fetch stores with phone numbers
      const { data: stores } = await supabase
        .from('store_master')
        .select('id, store_name, phone, contact_name, city, state')
        .not('phone', 'is', null)
        .order('store_name');

      if (stores) {
        for (const s of stores) {
          if (!s.phone) continue;
          results.push({
            id: s.id,
            name: s.store_name || 'Unknown Store',
            phone: normalizePhone(s.phone),
            type: 'store',
            subtitle: s.contact_name || [s.city, s.state].filter(Boolean).join(', ') || undefined,
            unread: 0,
          });
        }
      }

      // Dedupe by phone
      const seen = new Set<string>();
      return results.filter(c => {
        if (seen.has(c.phone)) return false;
        seen.add(c.phone);
        return true;
      });
    },
    staleTime: 60_000,
  });

  // ── Fetch all SMS logs to build thread map ───────────
  const { data: allMessages = [] } = useQuery({
    queryKey: ['manual-text-all-messages'],
    queryFn: async () => {
      const msgs: TextMessage[] = [];

      // communication_logs (SMS only)
      const { data: commLogs } = await supabase
        .from('communication_logs')
        .select('id, direction, message_content, summary, recipient_phone, sender_phone, created_at, delivery_status')
        .eq('channel', 'sms')
        .order('created_at', { ascending: false })
        .limit(500);

      if (commLogs) {
        for (const l of commLogs) {
          msgs.push({
            id: l.id,
            body: l.message_content || l.summary || '',
            direction: l.direction as 'inbound' | 'outbound',
            created_at: l.created_at,
            status: l.delivery_status || undefined,
            source: 'comm_log',
          });
        }
      }

      // messaging_messages
      const { data: mmLogs } = await supabase
        .from('messaging_messages')
        .select('id, direction, body, phone, status, created_at, twilio_sid')
        .order('created_at', { ascending: false })
        .limit(500);

      if (mmLogs) {
        for (const m of mmLogs) {
          msgs.push({
            id: m.id,
            body: m.body || '',
            direction: m.direction as 'inbound' | 'outbound',
            created_at: m.created_at,
            status: m.status || undefined,
            source: 'messaging',
          });
        }
      }

      // brandaro_conversations
      const { data: brandConvs } = await (supabase as any)
        .from('brandaro_conversations')
        .select('id, direction, message_body, from_number, to_number, status, created_at')
        .order('created_at', { ascending: false })
        .limit(500);

      if (brandConvs) {
        for (const b of brandConvs) {
          msgs.push({
            id: b.id,
            body: b.message_body || '',
            direction: b.direction as 'inbound' | 'outbound',
            created_at: b.created_at,
            status: b.status || undefined,
            source: 'brandaro',
          });
        }
      }

      return msgs;
    },
    staleTime: 30_000,
  });

  // ── Build phone → messages map ───────────────────────
  const phoneMessageMap = useMemo(() => {
    const map = new Map<string, TextMessage[]>();

    // Index comm_logs by phone
    const addMsg = (phone: string | null | undefined, msg: TextMessage) => {
      if (!phone) return;
      const norm = normalizePhone(phone);
      if (!map.has(norm)) map.set(norm, []);
      map.get(norm)!.push(msg);
    };

    // We need raw data to know phones — re-query is expensive so we
    // store a simpler approach: attach phone via contact lookup
    // For now, messages are keyed generically. We'll fetch per-contact.
    return map;
  }, [allMessages]);

  // ── Fetch messages for selected contact ──────────────
  const { data: threadMessages = [], isLoading: loadingThread, refetch: refetchThread } = useQuery({
    queryKey: ['manual-text-thread', selectedContact?.phone],
    queryFn: async () => {
      if (!selectedContact?.phone) return [];
      const phone = selectedContact.phone;
      const phoneDigits = phone.replace(/\D/g, '');
      const last10 = phoneDigits.slice(-10);
      const msgs: TextMessage[] = [];

      // communication_logs
      const { data: commLogs } = await supabase
        .from('communication_logs')
        .select('id, direction, message_content, summary, recipient_phone, sender_phone, created_at, delivery_status')
        .eq('channel', 'sms')
        .or(`recipient_phone.ilike.%${last10}%,sender_phone.ilike.%${last10}%`)
        .order('created_at', { ascending: true });

      if (commLogs) {
        for (const l of commLogs) {
          msgs.push({
            id: l.id,
            body: l.message_content || l.summary || '',
            direction: l.direction as 'inbound' | 'outbound',
            created_at: l.created_at,
            status: l.delivery_status || undefined,
            source: 'comm_log',
          });
        }
      }

      // messaging_messages
      const { data: mmLogs } = await supabase
        .from('messaging_messages')
        .select('id, direction, body, phone, status, created_at')
        .ilike('phone', `%${last10}%`)
        .order('created_at', { ascending: true });

      if (mmLogs) {
        for (const m of mmLogs) {
          msgs.push({
            id: m.id,
            body: m.body || '',
            direction: m.direction as 'inbound' | 'outbound',
            created_at: m.created_at,
            status: m.status || undefined,
            source: 'messaging',
          });
        }
      }

      // brandaro_conversations by phone
      const { data: brandConvs } = await (supabase as any)
        .from('brandaro_conversations')
        .select('id, direction, message_body, from_number, to_number, status, created_at')
        .or(`from_number.ilike.%${last10}%,to_number.ilike.%${last10}%`)
        .order('created_at', { ascending: true });

      if (brandConvs) {
        for (const b of brandConvs) {
          msgs.push({
            id: b.id,
            body: b.message_body || '',
            direction: b.direction as 'inbound' | 'outbound',
            created_at: b.created_at,
            status: b.status || undefined,
            source: 'brandaro',
          });
        }
      }

      // Dedupe by id and sort
      const seen = new Set<string>();
      return msgs
        .filter(m => {
          if (seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        })
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    },
    enabled: !!selectedContact?.phone,
  });

  // ── Enrich contacts with last message ────────────────
  const enrichedContacts = useMemo(() => {
    // We'll just use the contacts as-is since per-contact message enrichment
    // would require N queries. The thread loads when selected.
    return contacts;
  }, [contacts]);

  // ── Filtered contacts ────────────────────────────────
  const filteredContacts = useMemo(() => {
    if (!searchTerm) return enrichedContacts;
    const q = searchTerm.toLowerCase();
    return enrichedContacts.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      c.subtitle?.toLowerCase().includes(q)
    );
  }, [enrichedContacts, searchTerm]);

  // ── Auto-select from URL param ───────────────────────
  useEffect(() => {
    if (preselectedPhone && contacts.length > 0 && !selectedContact) {
      const norm = normalizePhone(preselectedPhone);
      const match = contacts.find(c => c.phone === norm);
      if (match) {
        setSelectedContact(match);
        setMobileShowThread(true);
      } else {
        // Custom number from URL
        setSelectedContact({
          id: 'custom',
          name: formatPhone(norm),
          phone: norm,
          type: 'custom',
          unread: 0,
        });
        setMobileShowThread(true);
      }
    }
  }, [preselectedPhone, contacts, selectedContact]);

  // ── Scroll to bottom on new messages ─────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadMessages]);

  // ── Realtime subscription ────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('manual-text-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'communication_logs',
      }, () => {
        refetchThread();
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messaging_messages',
      }, () => {
        refetchThread();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [refetchThread]);

  // ── Send message ─────────────────────────────────────
  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedContact?.phone) return;
    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: {
          to_number: selectedContact.phone,
          message_body: messageText.trim(),
          idempotency_key: crypto.randomUUID(),
          skip_cooldown: true,
          metadata: {
            source_ui: 'manual_text_page',
            contact_name: selectedContact.name,
          },
        },
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || 'Send failed');

      // Log to communication_logs
      await supabase.from('communication_logs').insert({
        channel: 'sms',
        direction: 'outbound',
        summary: 'Manual SMS sent',
        message_content: messageText.trim(),
        recipient_phone: selectedContact.phone,
        delivery_status: 'sent',
        performed_by: 'va',
      });

      setMessageText('');
      toast.success('Message sent');

      // Refresh thread
      setTimeout(() => refetchThread(), 500);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  // ── Start custom number chat ─────────────────────────
  const startCustomChat = () => {
    if (!customNumber.trim()) return;
    const norm = normalizePhone(customNumber.trim());
    setSelectedContact({
      id: 'custom-' + norm,
      name: formatPhone(norm),
      phone: norm,
      type: 'custom',
      unread: 0,
    });
    setShowNewChat(false);
    setCustomNumber('');
    setMobileShowThread(true);
  };

  // ── Select contact ──────────────────────────────────
  const selectContact = (c: Contact) => {
    setSelectedContact(c);
    setMobileShowThread(true);
    setShowNewChat(false);
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex bg-background rounded-lg border overflow-hidden">
      {/* ── Left: Contact List ───────────────────────── */}
      <div className={`w-full md:w-80 lg:w-96 border-r flex flex-col bg-card ${mobileShowThread ? 'hidden md:flex' : 'flex'}`}>
        {/* Header */}
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">Messages</h2>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setShowNewChat(!showNewChat)}
              className="h-8 w-8"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* New chat — custom number */}
          {showNewChat && (
            <div className="flex gap-2">
              <Input
                placeholder="Enter phone number..."
                value={customNumber}
                onChange={e => setCustomNumber(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && startCustomChat()}
                className="text-sm h-8"
              />
              <Button size="sm" className="h-8 shrink-0" onClick={startCustomChat} disabled={!customNumber.trim()}>
                <Send className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>

        {/* Contact list */}
        <ScrollArea className="flex-1">
          {loadingContacts ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading contacts...
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm">
              <User className="h-8 w-8 mb-2 opacity-40" />
              {searchTerm ? 'No contacts match' : 'No contacts with phone numbers'}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredContacts.map(contact => (
                <button
                  key={contact.id}
                  onClick={() => selectContact(contact)}
                  className={`w-full text-left px-3 py-2.5 hover:bg-accent/50 transition-colors ${
                    selectedContact?.id === contact.id ? 'bg-accent' : ''
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                      contact.type === 'store' ? 'bg-chart-2/15 text-chart-2' : 'bg-primary/10 text-primary'
                    }`}>
                      {contact.type === 'store' ? (
                        <Store className="h-4 w-4" />
                      ) : (
                        <User className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium truncate">{contact.name}</p>
                        {contact.type === 'store' && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 ml-1 shrink-0">Store</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-2.5 w-2.5" />
                        <span className="truncate">{formatPhone(contact.phone)}</span>
                      </div>
                      {contact.subtitle && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{contact.subtitle}</p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Contact count */}
        <div className="px-3 py-2 border-t text-xs text-muted-foreground">
          {contacts.length} contacts with phone numbers
        </div>
      </div>

      {/* ── Right: Thread ────────────────────────────── */}
      <div className={`flex-1 flex flex-col ${!mobileShowThread ? 'hidden md:flex' : 'flex'}`}>
        {selectedContact ? (
          <>
            {/* Thread header */}
            <div className="px-4 py-3 border-b flex items-center gap-3 bg-card">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 md:hidden"
                onClick={() => setMobileShowThread(false)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                selectedContact.type === 'store' ? 'bg-chart-2/15 text-chart-2' : 'bg-primary/10 text-primary'
              }`}>
                {selectedContact.type === 'store' ? <Store className="h-4 w-4" /> : <User className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{selectedContact.name}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="h-2.5 w-2.5" />
                  {formatPhone(selectedContact.phone)}
                </p>
              </div>
              {selectedContact.type !== 'custom' && (
                <Badge variant="outline" className="text-xs capitalize">{selectedContact.type}</Badge>
              )}
            </div>

            {/* Messages area */}
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-3 min-h-full flex flex-col justify-end">
                {loadingThread ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Loading messages...
                  </div>
                ) : threadMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <MessageSquare className="h-10 w-10 mb-3 opacity-30" />
                    <p className="text-sm">No messages yet</p>
                    <p className="text-xs mt-1">Send the first message below</p>
                  </div>
                ) : (
                  threadMessages.map((msg, i) => {
                    const isOut = msg.direction === 'outbound';
                    // Show date separator
                    const showDate = i === 0 ||
                      new Date(msg.created_at).toDateString() !== new Date(threadMessages[i - 1].created_at).toDateString();

                    return (
                      <div key={msg.id}>
                        {showDate && (
                          <div className="flex justify-center my-2">
                            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                              {isToday(new Date(msg.created_at))
                                ? 'Today'
                                : isYesterday(new Date(msg.created_at))
                                  ? 'Yesterday'
                                  : format(new Date(msg.created_at), 'MMM d, yyyy')}
                            </span>
                          </div>
                        )}
                        <div className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${
                            isOut
                              ? 'bg-primary text-primary-foreground rounded-br-md'
                              : 'bg-muted text-foreground rounded-bl-md'
                          }`}>
                            <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                            <div className={`flex items-center justify-end gap-1 mt-0.5 ${
                              isOut ? 'text-primary-foreground/60' : 'text-muted-foreground'
                            }`}>
                              <span className="text-[10px]">{format(new Date(msg.created_at), 'h:mm a')}</span>
                              {isOut && (
                                msg.status === 'delivered' || msg.status === 'read'
                                  ? <CheckCheck className="h-3 w-3" />
                                  : <Check className="h-3 w-3" />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Composer */}
            <div className="p-3 border-t bg-card">
              <div className="flex gap-2 items-end">
                <Textarea
                  ref={inputRef}
                  placeholder="Type a message..."
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  rows={1}
                  className="flex-1 resize-none min-h-[40px] max-h-32 text-sm"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={sending || !messageText.trim()}
                  size="icon"
                  className="h-10 w-10 shrink-0 rounded-full"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <MessageSquare className="h-14 w-14 mx-auto mb-4 opacity-20" />
              <p className="text-sm font-medium">Select a conversation</p>
              <p className="text-xs mt-1">Choose a contact or enter a custom number</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManualTextPage;
