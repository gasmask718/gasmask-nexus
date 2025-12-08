import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Phone, PhoneCall, PhoneOff, Search, User, Clock, MessageSquare, Bot, Save, Tag } from 'lucide-react';
import { useBusiness } from '@/contexts/BusinessContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const ManualCallPage = () => {
  const [searchParams] = useSearchParams();
  const contactId = searchParams.get('contact_id');
  const { currentBusiness } = useBusiness();

  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedBrandPhone, setSelectedBrandPhone] = useState('');
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'connected' | 'ended'>('idle');
  const [callDuration, setCallDuration] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [aiWhisperEnabled, setAiWhisperEnabled] = useState(false);
  
  // Call notes
  const [callSummary, setCallSummary] = useState('');
  const [callOutcome, setCallOutcome] = useState('');
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const tags = ['Store Issue', 'Order Missing', 'Upsell Opportunity', 'Payment Issue', 'General Inquiry', 'Complaint', 'Follow-up Required'];

  // Fetch contacts for search
  const { data: contacts } = useQuery({
    queryKey: ['crm-contacts-search', searchTerm, currentBusiness?.id],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return [];
      const { data, error } = await supabase
        .from('crm_contacts')
        .select('id, name, phone, email, organization')
        .or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: searchTerm.length >= 2,
  });

  // Brand phone numbers (mock data - would come from settings)
  const brandPhones = [
    { id: '1', label: 'Main Line', number: '+1 (555) 123-4567' },
    { id: '2', label: 'Sales', number: '+1 (555) 234-5678' },
    { id: '3', label: 'Support', number: '+1 (555) 345-6789' },
  ];

  const handleStartCall = () => {
    if (!phoneNumber) {
      toast.error('Please enter a phone number');
      return;
    }
    setCallStatus('calling');
    // Simulate connection after 2 seconds
    setTimeout(() => {
      setCallStatus('connected');
      // Start timer
      const interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
      // Store interval ID for cleanup
      (window as any).callInterval = interval;
    }, 2000);
  };

  const handleEndCall = () => {
    setCallStatus('ended');
    clearInterval((window as any).callInterval);
    toast.success('Call ended');
  };

  const handleSaveCallLog = async () => {
    try {
      // Log to communication_logs
      const { error } = await supabase.from('communication_logs').insert({
        business_id: currentBusiness?.id,
        channel: 'phone',
        direction: 'outbound',
        contact_id: selectedContact?.id || null,
        outcome: callOutcome,
        summary: callSummary,
        full_message: followUpNotes,
        follow_up_required: selectedTags.includes('Follow-up Required'),
      });

      if (error) throw error;
      toast.success('Call logged successfully');
      
      // Reset form
      setCallSummary('');
      setCallOutcome('');
      setFollowUpNotes('');
      setSelectedTags([]);
      setCallStatus('idle');
      setCallDuration(0);
    } catch (error) {
      toast.error('Failed to log call');
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const selectContact = (contact: any) => {
    setSelectedContact(contact);
    setPhoneNumber(contact.phone || '');
    setSearchTerm('');
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div className="w-full min-h-full flex gap-6">
      {/* Left Panel - Contact Search */}
      <div className="w-80 flex flex-col gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="h-4 w-4" />
              Find Contact
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Search by name or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <ScrollArea className="h-64">
              {contacts && contacts.length > 0 ? (
                <div className="space-y-2">
                  {contacts.map((contact) => (
                    <div
                      key={contact.id}
                      onClick={() => selectContact(contact)}
                      className="p-3 border rounded-lg cursor-pointer hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {contact.name}
                        </span>
                      </div>
                      {contact.phone && (
                        <p className="text-sm text-muted-foreground mt-1">{contact.phone}</p>
                      )}
                      {contact.organization && (
                        <p className="text-xs text-muted-foreground">{contact.organization}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : searchTerm.length >= 2 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No contacts found</p>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Type to search...</p>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Selected Contact */}
        {selectedContact && (
          <Card className="border-primary">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{selectedContact.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedContact.phone}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Center Panel - Dialer */}
      <div className="flex-1 max-w-xl space-y-6">
        {/* Dialer Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PhoneCall className="h-5 w-5" />
              Manual Dialer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Brand Phone Selector */}
            <div className="space-y-2">
              <Label>Call From</Label>
              <Select value={selectedBrandPhone} onValueChange={setSelectedBrandPhone}>
                <SelectTrigger>
                  <SelectValue placeholder="Select brand phone number" />
                </SelectTrigger>
                <SelectContent>
                  {brandPhones.map(phone => (
                    <SelectItem key={phone.id} value={phone.id}>
                      {phone.label} - {phone.number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Phone Number Input */}
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={callStatus === 'calling' || callStatus === 'connected'}
              />
            </div>

            {/* Call Status Display */}
            {callStatus !== 'idle' && (
              <div className="p-4 rounded-lg bg-muted text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  {callStatus === 'calling' && (
                    <>
                      <Phone className="h-5 w-5 animate-pulse text-yellow-500" />
                      <span className="text-yellow-500 font-medium">Calling...</span>
                    </>
                  )}
                  {callStatus === 'connected' && (
                    <>
                      <Phone className="h-5 w-5 text-green-500" />
                      <span className="text-green-500 font-medium">Connected</span>
                    </>
                  )}
                  {callStatus === 'ended' && (
                    <>
                      <PhoneOff className="h-5 w-5 text-muted-foreground" />
                      <span className="text-muted-foreground font-medium">Call Ended</span>
                    </>
                  )}
                </div>
                <div className="flex items-center justify-center gap-2 text-2xl font-mono">
                  <Clock className="h-5 w-5" />
                  {formatDuration(callDuration)}
                </div>
              </div>
            )}

            {/* Call Buttons */}
            <div className="flex gap-3">
              {callStatus === 'idle' || callStatus === 'ended' ? (
                <Button onClick={handleStartCall} className="flex-1 bg-green-600 hover:bg-green-700">
                  <Phone className="h-4 w-4 mr-2" />
                  Start Call
                </Button>
              ) : (
                <Button onClick={handleEndCall} variant="destructive" className="flex-1">
                  <PhoneOff className="h-4 w-4 mr-2" />
                  End Call
                </Button>
              )}
            </div>

            {/* AI Whisper Toggle */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                <Label>AI Whisper Coaching</Label>
              </div>
              <Switch checked={aiWhisperEnabled} onCheckedChange={setAiWhisperEnabled} />
            </div>
          </CardContent>
        </Card>

        {/* Call Notes Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Call Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Summary</Label>
              <Textarea
                placeholder="Brief summary of the call..."
                value={callSummary}
                onChange={(e) => setCallSummary(e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Outcome</Label>
              <Select value={callOutcome} onValueChange={setCallOutcome}>
                <SelectTrigger>
                  <SelectValue placeholder="Select call outcome" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="answered">Answered - Resolved</SelectItem>
                  <SelectItem value="answered_followup">Answered - Needs Follow-up</SelectItem>
                  <SelectItem value="voicemail">Voicemail Left</SelectItem>
                  <SelectItem value="no_answer">No Answer</SelectItem>
                  <SelectItem value="busy">Busy</SelectItem>
                  <SelectItem value="wrong_number">Wrong Number</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Follow-up Notes</Label>
              <Textarea
                placeholder="Any follow-up tasks or notes..."
                value={followUpNotes}
                onChange={(e) => setFollowUpNotes(e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Tags
              </Label>
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => (
                  <Badge
                    key={tag}
                    variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>

            <Button onClick={handleSaveCallLog} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              Save Call Log
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ManualCallPage;
