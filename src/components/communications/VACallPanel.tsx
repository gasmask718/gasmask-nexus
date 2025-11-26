import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Phone, Clock, Save, X, CheckCircle, XCircle, PhoneCall, Search } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface VACallPanelProps {
  brand: string;
  brandColor?: string;
  contactId?: string;
  contactName?: string;
  contactPhone?: string;
}

export default function VACallPanel({ brand, brandColor = '#6366f1', contactId, contactName, contactPhone }: VACallPanelProps) {
  const [calling, setCalling] = useState(false);
  const [callTimer, setCallTimer] = useState(0);
  const [notes, setNotes] = useState('');
  const [outcome, setOutcome] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState(contactPhone || '');
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    setPhoneNumber(contactPhone || '');
  }, [contactPhone]);

  useEffect(() => {
    fetchContacts();
  }, [brand]);

  const fetchContacts = async () => {
    const { data } = await supabase
      .from('crm_contacts')
      .select('*')
      .order('name');
    setContacts(data || []);
  };

  const handleContactSelect = (contact: any) => {
    setSelectedContact(contact);
    setPhoneNumber(contact.phone || '');
    setSearchOpen(false);
  };

  const handleKeypadPress = (digit: string) => {
    setPhoneNumber(prev => prev + digit);
  };

  const startCall = () => {
    setCalling(true);
    const interval = setInterval(() => {
      setCallTimer(prev => prev + 1);
    }, 1000);
    
    // Store interval ID for cleanup
    (window as any).callTimerInterval = interval;
  };

  const endCall = async () => {
    setCalling(false);
    clearInterval((window as any).callTimerInterval);
    
    if (outcome && contactId) {
      // Save call log to database (using type assertion for now)
      const { error } = await supabase.from('communication_logs').insert({
        store_brand_account_id: contactId,
        type: 'manual-call',
        message: notes,
        call_outcome: outcome,
        performed_by: 'VA',
        channel: 'phone',
        direction: 'outbound'
      } as any);

      if (error) {
        toast.error('Failed to save call log');
      } else {
        toast.success('Call logged successfully');
      }
    }
    
    setCallTimer(0);
    setNotes('');
    setOutcome(null);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const outcomes = [
    { value: 'interested', label: 'Interested', icon: CheckCircle, color: 'text-green-600' },
    { value: 'callback', label: 'Call Back Later', icon: Clock, color: 'text-blue-600' },
    { value: 'not-interested', label: 'Not Interested', icon: XCircle, color: 'text-red-600' },
    { value: 'wrong-number', label: 'Wrong Number', icon: X, color: 'text-gray-600' },
    { value: 'voicemail', label: 'Voicemail', icon: PhoneCall, color: 'text-yellow-600' },
  ];

  return (
    <Card style={{ borderTop: `4px solid ${brandColor}` }}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Phone className="w-5 h-5" style={{ color: brandColor }} />
            VA Call Panel - {brand}
          </span>
          {calling && (
            <Badge variant="outline" className="animate-pulse" style={{ borderColor: brandColor }}>
              <Clock className="w-3 h-3 mr-1" />
              {formatTime(callTimer)}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Contact Picker */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Contact</label>
          <Popover open={searchOpen} onOpenChange={setSearchOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start">
                <Search className="w-4 h-4 mr-2" />
                {selectedContact ? selectedContact.name : 'Search contacts...'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <CommandInput placeholder="Search contacts..." />
                <CommandList>
                  <CommandEmpty>No contacts found.</CommandEmpty>
                  <CommandGroup>
                    {contacts.map((contact) => (
                      <CommandItem
                        key={contact.id}
                        value={contact.name}
                        onSelect={() => handleContactSelect(contact)}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{contact.name}</span>
                          <span className="text-xs text-muted-foreground">{contact.phone}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* Manual Phone Number Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Phone Number</label>
          <Input
            type="tel"
            placeholder="Enter phone number"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            disabled={calling}
          />
        </div>

        {/* Numeric Keypad */}
        {!calling && (
          <div className="grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((digit) => (
              <Button
                key={digit}
                variant="outline"
                className="h-12 text-lg"
                onClick={() => handleKeypadPress(digit)}
              >
                {digit}
              </Button>
            ))}
          </div>
        )}

        {/* Call Script */}
        <div className="p-4 rounded-lg" style={{ backgroundColor: `${brandColor}10` }}>
          <h3 className="font-semibold mb-2">Call Script</h3>
          <p className="text-sm text-muted-foreground">
            "Hi, this is [Your Name] from {brand}. We're checking in about your recent order and wanted to see if you'd be interested in..."
          </p>
        </div>

        {/* Call Controls */}
        <div className="flex gap-3">
          {!calling ? (
            <Button
              className="flex-1"
              size="lg"
              style={{ backgroundColor: brandColor, color: 'white' }}
              onClick={startCall}
              disabled={!phoneNumber}
            >
              <Phone className="w-4 h-4 mr-2" />
              Start Call
            </Button>
          ) : (
            <Button
              className="flex-1"
              size="lg"
              variant="destructive"
              onClick={endCall}
            >
              <X className="w-4 h-4 mr-2" />
              End Call
            </Button>
          )}
        </div>

        {/* Outcome Buttons */}
        {calling && (
          <div>
            <label className="text-sm font-medium mb-2 block">Call Outcome</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {outcomes.map((opt) => {
                const Icon = opt.icon;
                return (
                  <Button
                    key={opt.value}
                    variant={outcome === opt.value ? 'default' : 'outline'}
                    className="h-auto py-3 flex-col gap-1"
                    onClick={() => setOutcome(opt.value)}
                    style={outcome === opt.value ? {
                      backgroundColor: brandColor,
                      color: 'white'
                    } : {}}
                  >
                    <Icon className={`w-4 h-4 ${opt.color}`} />
                    <span className="text-xs">{opt.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="text-sm font-medium mb-2 block">Call Notes</label>
          <Textarea
            placeholder="Notes about the call..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            disabled={!calling}
          />
        </div>

        {/* Save Button */}
        {calling && outcome && (
          <Button
            className="w-full"
            style={{ backgroundColor: brandColor, color: 'white' }}
            onClick={endCall}
          >
            <Save className="w-4 h-4 mr-2" />
            End Call & Save
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
