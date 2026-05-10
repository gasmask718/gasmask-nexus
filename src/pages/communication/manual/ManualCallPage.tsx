import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Phone, PhoneCall, PhoneOff, Search, User, Clock, MessageSquare, Save, Tag, Store, Plus, History, Users, Sparkles, Package } from 'lucide-react';
import { useBusiness } from '@/contexts/BusinessContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { usePriorCustomerSegmentMap, FLOW_STATUS_META, FLOW_STATUS_ORDER, type FlowStatus } from '@/hooks/usePriorCustomerSegmentMap';
import { SendToRouteModal } from '@/components/scheduling/SendToRouteModal';

interface Contact {
  id: string;
  name: string;
  phone: string | null;
  email?: string | null;
  organization?: string | null;
  type: 'person' | 'store';
  city?: string | null;
}

const ManualCallPage = () => {
  const [searchParams] = useSearchParams();
  const contactId = searchParams.get('contact_id');
  const { currentBusiness } = useBusiness();
  const queryClient = useQueryClient();

  const [phoneNumber, setPhoneNumber] = useState('');
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'connected' | 'ended'>('idle');
  const [callDuration, setCallDuration] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [contactTab, setContactTab] = useState('all');
  const [priorBucket, setPriorBucket] = useState<FlowStatus | 'all'>('all');
  const { map: priorCustomerMap, counts: priorCounts } = usePriorCustomerSegmentMap();
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customNumber, setCustomNumber] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Call notes
  const [callSummary, setCallSummary] = useState('');
  const [callOutcome, setCallOutcome] = useState('');
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduledCall, setScheduledCall] = useState<{ id: string; storeId: string; storeName: string } | null>(null);

  const tags = ['Store Issue', 'Order Missing', 'Upsell Opportunity', 'Payment Issue', 'General Inquiry', 'Complaint', 'Follow-up Required'];

  // ─── Fetch ALL contacts (people + stores) ───
  const { data: allContacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ['manual-call-contacts'],
    queryFn: async () => {
      const contacts: Contact[] = [];

      // Fetch people
      const { data: people } = await supabase
        .from('people')
        .select('id, name, phone, email, organization, address_city')
        .not('phone', 'is', null)
        .order('name', { ascending: true })
        .limit(500);

      if (people) {
        for (const p of people) {
          contacts.push({
            id: p.id,
            name: p.name,
            phone: p.phone,
            email: p.email,
            organization: p.organization,
            type: 'person',
            city: p.address_city,
          });
        }
      }

      // Fetch stores
      const { data: stores } = await supabase
        .from('store_master')
        .select('id, store_name, phone, contact_name, city, state')
        .not('phone', 'is', null)
        .order('store_name', { ascending: true })
        .limit(500);

      if (stores) {
        for (const s of stores) {
          contacts.push({
            id: s.id,
            name: s.store_name,
            phone: s.phone,
            email: null,
            organization: s.contact_name || undefined,
            type: 'store',
            city: s.city ? `${s.city}, ${s.state}` : null,
          });
        }
      }

      return contacts;
    },
  });

  // ─── Fetch call history from communication_logs ───
  const { data: callHistory = [] } = useQuery({
    queryKey: ['manual-call-history'],
    queryFn: async () => {
      const { data } = await supabase
        .from('communication_logs')
        .select('id, channel, direction, outcome, summary, call_duration, recipient_phone, sender_phone, created_at, contact_id')
        .eq('channel', 'call')
        .order('created_at', { ascending: false })
        .limit(100);
      return data || [];
    },
  });

  // Filter contacts
  const filteredContacts = allContacts.filter(c => {
    const matchesSearch = !searchTerm ||
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.phone && c.phone.includes(searchTerm)) ||
      (c.organization && c.organization.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesTab = contactTab === 'all' ||
      (contactTab === 'people' && c.type === 'person') ||
      (contactTab === 'stores' && c.type === 'store') ||
      (contactTab === 'customers' && c.type === 'store' && priorCustomerMap.has(c.id));
    let matchesBucket = true;
    if (contactTab === 'customers' && priorBucket !== 'all') {
      const seg = priorCustomerMap.get(c.id);
      matchesBucket = seg?.flow_status === priorBucket;
    }
    return matchesSearch && matchesTab && matchesBucket;
  });

  // Load contact from URL param
  useEffect(() => {
    if (contactId && allContacts.length > 0) {
      const found = allContacts.find(c => c.id === contactId);
      if (found) selectContact(found);
    }
  }, [contactId, allContacts]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleStartCall = () => {
    const number = phoneNumber.trim();
    if (!number) {
      toast.error('Please enter a phone number');
      return;
    }
    // Open tel: link for actual calling
    window.open(`tel:${number}`, '_self');
    setCallStatus('connected');
    setCallDuration(0);
    intervalRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const handleEndCall = () => {
    setCallStatus('ended');
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    toast.success('Call ended — save your notes below');
  };

  const handleSaveCallLog = async () => {
    if (!callSummary.trim()) {
      toast.error('Please enter a call summary');
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in');
        return;
      }

      const { data: inserted, error } = await supabase.from('communication_logs').insert({
        business_id: currentBusiness?.id || null,
        channel: 'call',
        direction: 'outbound',
        contact_id: selectedContact?.id || null,
        store_id: selectedContact?.type === 'store' ? selectedContact.id : null,
        outcome: callOutcome || null,
        summary: callSummary,
        full_message: followUpNotes || null,
        follow_up_required: selectedTags.includes('Follow-up Required'),
        created_by: user.id,
        call_duration: callDuration > 0 ? callDuration : null,
        recipient_phone: phoneNumber || null,
      }).select('id').single();

      if (error) throw error;
      toast.success('Call logged successfully');
      queryClient.invalidateQueries({ queryKey: ['manual-call-history'] });

      // Schedule Delivery outcome → open the route modal pre-filled with this store
      if (callOutcome === 'schedule_delivery' && selectedContact?.type === 'store' && inserted?.id) {
        setScheduledCall({
          id: inserted.id,
          storeId: selectedContact.id,
          storeName: selectedContact.name,
        });
        setScheduleModalOpen(true);
      }

      // Reset
      setCallSummary('');
      setCallOutcome('');
      setFollowUpNotes('');
      setSelectedTags([]);
      setCallStatus('idle');
      setCallDuration(0);
    } catch (error: any) {
      toast.error(`Failed to log call: ${error.message}`);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const selectContact = (contact: Contact) => {
    setSelectedContact(contact);
    setPhoneNumber(contact.phone || '');
    setSearchTerm('');
  };

  const handleCustomNumber = () => {
    if (!customNumber.trim()) return;
    setPhoneNumber(customNumber.trim());
    setSelectedContact({ id: 'custom', name: customNumber.trim(), phone: customNumber.trim(), type: 'person' });
    setShowCustomInput(false);
    setCustomNumber('');
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  return (
    <div className="w-full min-h-full flex flex-col lg:flex-row gap-4 p-4">
      {/* ─── LEFT: Contacts ─── */}
      <div className="w-full lg:w-80 flex flex-col gap-3 flex-shrink-0">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Contacts
              </CardTitle>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setShowCustomInput(!showCustomInput)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {/* Custom number input */}
            {showCustomInput && (
              <div className="flex gap-1.5 mb-2">
                <Input
                  placeholder="+1 (555) 000-0000"
                  value={customNumber}
                  onChange={(e) => setCustomNumber(e.target.value)}
                  className="text-sm h-8"
                  onKeyDown={(e) => e.key === 'Enter' && handleCustomNumber()}
                />
                <Button size="sm" className="h-8 px-3" onClick={handleCustomNumber}>Call</Button>
              </div>
            )}

            <Input
              placeholder="Search contacts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="text-sm h-8"
            />

            <div className="flex gap-1">
              {['all', 'people', 'stores', 'customers'].map(tab => (
                <Button key={tab} size="sm" variant={contactTab === tab ? 'default' : 'ghost'}
                  className="h-6 text-xs flex-1 capitalize" onClick={() => setContactTab(tab)}>
                  {tab === 'customers' ? <><Sparkles className="h-3 w-3 mr-0.5" />Customers</> : tab}
                </Button>
              ))}
            </div>

            {contactTab === 'customers' && (
              <div className="flex flex-wrap gap-1">
                <Button
                  size="sm"
                  variant={priorBucket === 'all' ? 'secondary' : 'ghost'}
                  className="h-5 text-[10px] px-1.5"
                  onClick={() => setPriorBucket('all')}
                >
                  All ({priorCounts.total})
                </Button>
                {FLOW_STATUS_ORDER.map(s => (
                  <Button
                    key={s}
                    size="sm"
                    variant={priorBucket === s ? 'secondary' : 'ghost'}
                    className="h-5 text-[10px] px-1.5"
                    onClick={() => setPriorBucket(s)}
                  >
                    {FLOW_STATUS_META[s].emoji} {priorCounts[s]}
                  </Button>
                ))}
              </div>
            )}

            <ScrollArea className="h-[calc(100vh-380px)] min-h-[300px]">
              {contactsLoading ? (
                <div className="text-center py-8 text-sm text-muted-foreground">Loading contacts...</div>
              ) : filteredContacts.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  {searchTerm ? 'No matches found' : 'No contacts with phone numbers'}
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredContacts.map((contact) => (
                    <div
                      key={`${contact.type}-${contact.id}`}
                      onClick={() => selectContact(contact)}
                      className={`p-2.5 rounded-lg cursor-pointer transition-colors ${
                        selectedContact?.id === contact.id
                          ? 'bg-primary/10 border border-primary/30'
                          : 'hover:bg-muted border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {contact.type === 'store' ? (
                          <Store className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
                        ) : (
                          <User className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                        )}
                        <span className="font-medium text-sm truncate">{contact.name}</span>
                      </div>
                      <div className="ml-5.5 mt-0.5 text-xs text-muted-foreground truncate">
                        {contact.phone}
                        {contact.city && ` · ${contact.city}`}
                      </div>
                      {contact.organization && (
                        <div className="ml-5.5 text-[10px] text-muted-foreground truncate">{contact.organization}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* ─── CENTER: Dialer + Notes ─── */}
      <div className="flex-1 max-w-xl space-y-4">
        {/* Selected contact header */}
        {selectedContact && (
          <Card className="border-primary/30">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                {selectedContact.type === 'store'
                  ? <Store className="h-4 w-4 text-primary" />
                  : <User className="h-4 w-4 text-primary" />}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{selectedContact.name}</p>
                <p className="text-xs text-muted-foreground">{selectedContact.phone}</p>
              </div>
              <Badge variant="outline" className="ml-auto text-[10px] flex-shrink-0">
                {selectedContact.type}
              </Badge>
            </CardContent>
          </Card>
        )}

        {/* Dialer */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <PhoneCall className="h-4 w-4" />
              Dialer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Phone Number</Label>
              <Input
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={callStatus === 'connected'}
                className="text-lg font-mono"
              />
            </div>

            {/* Call status */}
            {callStatus !== 'idle' && (
              <div className={`p-3 rounded-lg text-center ${
                callStatus === 'connected' ? 'bg-emerald-500/10 border border-emerald-500/20' :
                callStatus === 'ended' ? 'bg-muted' : 'bg-amber-500/10'
              }`}>
                <div className="flex items-center justify-center gap-2 mb-1">
                  {callStatus === 'calling' && <Phone className="h-4 w-4 animate-pulse text-amber-500" />}
                  {callStatus === 'connected' && <Phone className="h-4 w-4 text-emerald-500" />}
                  {callStatus === 'ended' && <PhoneOff className="h-4 w-4 text-muted-foreground" />}
                  <span className={`font-medium text-sm ${
                    callStatus === 'connected' ? 'text-emerald-500' :
                    callStatus === 'ended' ? 'text-muted-foreground' : 'text-amber-500'
                  }`}>
                    {callStatus === 'calling' ? 'Calling...' : callStatus === 'connected' ? 'Connected' : 'Call Ended'}
                  </span>
                </div>
                <div className="flex items-center justify-center gap-1.5 text-xl font-mono">
                  <Clock className="h-4 w-4" />
                  {formatDuration(callDuration)}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              {callStatus === 'idle' || callStatus === 'ended' ? (
                <Button onClick={handleStartCall} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Phone className="h-4 w-4 mr-2" />
                  Call
                </Button>
              ) : (
                <Button onClick={handleEndCall} variant="destructive" className="flex-1">
                  <PhoneOff className="h-4 w-4 mr-2" />
                  End Call
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Call Notes */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Call Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Summary</Label>
              <Textarea placeholder="Brief summary of the call..." value={callSummary}
                onChange={(e) => setCallSummary(e.target.value)} rows={2} className="text-sm" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Outcome</Label>
              <Select value={callOutcome} onValueChange={setCallOutcome}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select outcome" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="answered">Answered — Resolved</SelectItem>
                  <SelectItem value="answered_followup">Answered — Needs Follow-up</SelectItem>
                  <SelectItem value="voicemail">Voicemail Left</SelectItem>
                  <SelectItem value="no_answer">No Answer</SelectItem>
                  <SelectItem value="busy">Busy</SelectItem>
                  <SelectItem value="wrong_number">Wrong Number</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Follow-up Notes</Label>
              <Textarea placeholder="Any follow-up tasks..." value={followUpNotes}
                onChange={(e) => setFollowUpNotes(e.target.value)} rows={2} className="text-sm" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <Tag className="h-3 w-3" /> Tags
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {tags.map(tag => (
                  <Badge key={tag} variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                    className="cursor-pointer text-xs" onClick={() => toggleTag(tag)}>
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>

            <Button onClick={handleSaveCallLog} className="w-full" disabled={!callSummary.trim()}>
              <Save className="h-4 w-4 mr-2" />
              Save Call Log
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ─── RIGHT: Call History ─── */}
      <div className="w-full lg:w-80 flex-shrink-0">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4" />
              Call History
              <Badge variant="outline" className="ml-auto text-[10px]">{callHistory.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-200px)] min-h-[400px]">
              {callHistory.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">No call history yet</div>
              ) : (
                <div className="space-y-2">
                  {callHistory.map((log: any) => (
                    <div key={log.id} className="p-2.5 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => {
                        const num = log.recipient_phone || log.sender_phone;
                        if (num) {
                          setPhoneNumber(num);
                          // Try to find matching contact
                          const match = allContacts.find(c => c.phone === num);
                          if (match) setSelectedContact(match);
                        }
                      }}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <Phone className={`h-3 w-3 ${log.direction === 'inbound' ? 'text-blue-400' : 'text-emerald-400'}`} />
                          <span className="font-medium text-xs truncate max-w-[140px]">
                            {log.recipient_phone || log.sender_phone || 'Unknown'}
                          </span>
                        </div>
                        <Badge variant="outline" className={`text-[9px] ${
                          log.outcome === 'answered' ? 'text-emerald-400 border-emerald-500/30' :
                          log.outcome === 'no_answer' ? 'text-amber-400 border-amber-500/30' :
                          'text-muted-foreground'
                        }`}>
                          {log.outcome || log.direction}
                        </Badge>
                      </div>
                      {log.summary && (
                        <p className="text-[11px] text-muted-foreground line-clamp-2 mb-1">{log.summary}</p>
                      )}
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>{formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}</span>
                        {log.call_duration && (
                          <span className="flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5" />
                            {formatDuration(log.call_duration)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ManualCallPage;
