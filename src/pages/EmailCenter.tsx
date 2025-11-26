import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Mail, Send, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const EmailCenter = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [entityType, setEntityType] = useState<string>('store');
  const [entityId, setEntityId] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  const { data: templates } = useQuery({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communication_templates')
        .select('*')
        .eq('template_type', 'email' as any)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: stores } = useQuery({
    queryKey: ['stores-for-email'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name, email')
        .eq('status', 'active')
        .not('email', 'is', null)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: entityType === 'store',
  });

  const { data: contacts } = useQuery({
    queryKey: ['contacts-for-email'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_contacts')
        .select('id, name, email')
        .not('email', 'is', null)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: entityType === 'contact',
  });

  const { data: recentEmails } = useQuery({
    queryKey: ['recent-emails'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communication_logs')
        .select(`
          *,
          contact:crm_contacts(name),
          store:stores(name)
        `)
        .eq('channel', 'email')
        .order('created_at', { ascending: false})
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const sendEmailMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from('communication_logs').insert([{
        channel: 'email',
        direction: 'outbound',
        summary: data.subject,
        full_message: data.message,
        store_id: data.entityType === 'store' ? data.entityId : null,
        contact_id: data.entityType === 'contact' ? data.entityId : null,
        created_by: user?.id,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Email logged successfully (simulation mode)');
      queryClient.invalidateQueries({ queryKey: ['recent-emails'] });
      setSubject('');
      setMessage('');
      setEntityId('');
    },
    onError: (error) => {
      toast.error('Failed to log email: ' + error.message);
    },
  });

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates?.find(t => t.id === templateId);
    if (template) {
      setSubject(template.name);
      setMessage(template.message_template);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!entityId || !subject || !message) {
      toast.error('Please fill in all required fields');
      return;
    }

    sendEmailMutation.mutate({
      entityType,
      entityId,
      subject,
      message,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Email Center</h1>
        <p className="text-muted-foreground mt-1">
          Compose and log email communications
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Email Composer */}
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center gap-2 mb-6">
            <Mail className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Compose Email</h2>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Send To</Label>
                <Select value={entityType} onValueChange={setEntityType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="store">Store</SelectItem>
                    <SelectItem value="contact">Contact</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Select Recipient</Label>
                <Select value={entityId} onValueChange={setEntityId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose recipient..." />
                  </SelectTrigger>
                  <SelectContent>
                    {entityType === 'store'
                      ? stores?.map((store) => (
                          <SelectItem key={store.id} value={store.id}>
                            {store.name} ({store.email})
                          </SelectItem>
                        ))
                      : contacts?.map((contact) => (
                          <SelectItem key={contact.id} value={contact.id}>
                            {contact.name} ({contact.email})
                          </SelectItem>
                        ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Use Template (Optional)</Label>
              <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates?.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Subject *</Label>
              <Input
                placeholder="Email subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Message *</Label>
              <Textarea
                placeholder="Type your email message here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={12}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={sendEmailMutation.isPending}>
              <Send className="mr-2 h-4 w-4" />
              {sendEmailMutation.isPending ? 'Sending...' : 'Send Email (Simulation)'}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              ⚠️ This is a simulation. No actual email will be sent.
            </p>
          </form>
        </Card>

        {/* Recent Emails */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Recent Emails</h2>
          </div>
          <div className="space-y-3">
            {recentEmails?.map((email) => (
              <div
                key={email.id}
                className="p-3 rounded-lg border"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-sm">
                    {email.contact?.name || email.store?.name || 'Unknown'}
                  </p>
                  <Badge variant="outline" className="capitalize text-xs">
                    {email.direction}
                  </Badge>
                </div>
                <p className="text-sm font-medium mb-1">{email.summary}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {email.full_message}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {new Date(email.created_at).toLocaleString()}
                </p>
              </div>
            ))}
            {(!recentEmails || recentEmails.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No recent emails
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default EmailCenter;