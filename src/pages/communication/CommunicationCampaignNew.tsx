import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useBusiness } from '@/contexts/BusinessContext';
import { supabase } from '@/integrations/supabase/client';
import CommunicationLayout from './CommunicationLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { MessageSquare, Mail, Phone, ArrowLeft, ArrowRight, Send, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

type Channel = 'sms' | 'email' | 'call';

const CommunicationCampaignNew = () => {
  const { currentBusiness } = useBusiness();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [step, setStep] = useState(1);
  const [channel, setChannel] = useState<Channel>('sms');
  const [campaignName, setCampaignName] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [sendNow, setSendNow] = useState(true);
  const [scheduledDate, setScheduledDate] = useState('');

  const { data: contacts } = useQuery({
    queryKey: ['crm-contacts', currentBusiness?.id],
    enabled: !!currentBusiness?.id && step === 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_contacts')
        .select('*')
        .eq('business_id', currentBusiness!.id)
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  const createCampaignMutation = useMutation({
    mutationFn: async () => {
      if (!currentBusiness) throw new Error('No business selected');

      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .insert({
          business_id: currentBusiness.id,
          name: campaignName,
          channel,
          subject: channel === 'email' ? subject : null,
          message_template: message,
          status: sendNow ? 'sending' : 'scheduled',
          scheduled_at: sendNow ? null : scheduledDate,
          total_recipients: selectedContacts.length,
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      const recipients = selectedContacts.map(contactId => {
        const contact = contacts?.find(c => c.id === contactId);
        return {
          campaign_id: campaign.id,
          contact_id: contactId,
          contact_name: contact?.name || '',
          contact_value: channel === 'email' ? contact?.email : contact?.phone || '',
          status: 'pending'
        };
      });

      const { error: recipientsError } = await supabase
        .from('campaign_recipients')
        .insert(recipients);

      if (recipientsError) throw recipientsError;

      return campaign;
    },
    onSuccess: (campaign) => {
      toast.success('Campaign created successfully!');
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      navigate(`/communication/campaigns/${campaign.id}`);
    },
    onError: (error) => {
      toast.error('Failed to create campaign');
      console.error(error);
    }
  });

  const handleNext = () => {
    if (step === 1 && !channel) {
      toast.error('Please select a channel');
      return;
    }
    if (step === 2 && selectedContacts.length === 0) {
      toast.error('Please select at least one contact');
      return;
    }
    if (step === 3 && !message) {
      toast.error('Please write a message');
      return;
    }
    if (step === 4 && !campaignName) {
      toast.error('Please enter a campaign name');
      return;
    }
    if (step < 4) setStep(step + 1);
  };

  const handleLaunch = () => {
    createCampaignMutation.mutate();
  };

  if (!currentBusiness) {
    return (
      <CommunicationLayout title="New Campaign">
        <p className="text-muted-foreground">Please select a business to create a campaign.</p>
      </CommunicationLayout>
    );
  }

  return (
    <CommunicationLayout title="New Campaign" subtitle="Create a mass messaging campaign">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8">
          {['Channel', 'Contacts', 'Message', 'Launch'].map((label, idx) => (
            <div key={label} className="flex items-center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                step > idx + 1 ? 'bg-primary text-primary-foreground' :
                step === idx + 1 ? 'bg-primary text-primary-foreground' :
                'bg-muted text-muted-foreground'
              }`}>
                {idx + 1}
              </div>
              <span className="ml-2 text-sm font-medium">{label}</span>
              {idx < 3 && <div className="w-12 h-0.5 mx-4 bg-muted" />}
            </div>
          ))}
        </div>

        {/* Step 1: Select Channel */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Select Channel</CardTitle>
              <CardDescription>Choose how you want to reach your contacts</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup value={channel} onValueChange={(v) => setChannel(v as Channel)}>
                <div className="grid gap-4">
                  <div className="flex items-center space-x-4 border rounded-lg p-4 cursor-pointer hover:bg-accent"
                       onClick={() => setChannel('sms')}>
                    <RadioGroupItem value="sms" id="sms" />
                    <MessageSquare className="h-6 w-6" />
                    <div className="flex-1">
                      <Label htmlFor="sms" className="text-base font-semibold cursor-pointer">SMS</Label>
                      <p className="text-sm text-muted-foreground">Send text messages to phone numbers</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4 border rounded-lg p-4 cursor-pointer hover:bg-accent"
                       onClick={() => setChannel('email')}>
                    <RadioGroupItem value="email" id="email" />
                    <Mail className="h-6 w-6" />
                    <div className="flex-1">
                      <Label htmlFor="email" className="text-base font-semibold cursor-pointer">Email</Label>
                      <p className="text-sm text-muted-foreground">Send emails to contacts</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4 border rounded-lg p-4 cursor-pointer hover:bg-accent"
                       onClick={() => setChannel('call')}>
                    <RadioGroupItem value="call" id="call" />
                    <Phone className="h-6 w-6" />
                    <div className="flex-1">
                      <Label htmlFor="call" className="text-base font-semibold cursor-pointer">Voice Call</Label>
                      <p className="text-sm text-muted-foreground">Make automated phone calls</p>
                    </div>
                  </div>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Select Contacts */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Select Contacts</CardTitle>
              <CardDescription>Choose who will receive this campaign</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {contacts && contacts.length > 0 ? (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {contacts.map((contact) => (
                      <div key={contact.id} className="flex items-center space-x-2 p-2 border rounded hover:bg-accent">
                        <Checkbox
                          checked={selectedContacts.includes(contact.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedContacts([...selectedContacts, contact.id]);
                            } else {
                              setSelectedContacts(selectedContacts.filter(id => id !== contact.id));
                            }
                          }}
                        />
                        <div className="flex-1">
                          <p className="font-medium">{contact.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {channel === 'email' ? contact.email : contact.phone}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No contacts found</p>
                )}
                <Badge variant="secondary">{selectedContacts.length} contacts selected</Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Write Message */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Write Message</CardTitle>
              <CardDescription>Craft your campaign message</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {channel === 'email' && (
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Email subject line"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write your message here... Use {{name}} for personalization"
                  rows={8}
                />
                <p className="text-xs text-muted-foreground">
                  You can use merge tags like {'{{name}}'}, {'{{email}}'}, {'{{phone}}'}
                </p>
              </div>
              <Button variant="outline" size="sm">
                <Sparkles className="h-4 w-4 mr-2" />
                Generate with AI
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Schedule & Launch */}
        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>Review & Launch</CardTitle>
              <CardDescription>Confirm your campaign details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="campaignName">Campaign Name</Label>
                <Input
                  id="campaignName"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="Enter campaign name"
                />
              </div>
              
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Channel:</span>
                  <Badge>{channel.toUpperCase()}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Recipients:</span>
                  <span className="font-medium">{selectedContacts.length}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Schedule</Label>
                <RadioGroup value={sendNow ? 'now' : 'later'} onValueChange={(v) => setSendNow(v === 'now')}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="now" id="now" />
                    <Label htmlFor="now" className="cursor-pointer">Send now</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="later" id="later" />
                    <Label htmlFor="later" className="cursor-pointer">Schedule for later</Label>
                  </div>
                </RadioGroup>
                {!sendNow && (
                  <Input
                    type="datetime-local"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => step === 1 ? navigate('/communication/campaigns') : setStep(step - 1)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>
          {step < 4 ? (
            <Button onClick={handleNext}>
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleLaunch} disabled={createCampaignMutation.isPending}>
              <Send className="h-4 w-4 mr-2" />
              {createCampaignMutation.isPending ? 'Launching...' : 'Launch Campaign'}
            </Button>
          )}
        </div>
      </div>
    </CommunicationLayout>
  );
};

export default CommunicationCampaignNew;
