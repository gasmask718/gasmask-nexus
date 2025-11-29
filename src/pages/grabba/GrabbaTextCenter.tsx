import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Send, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useGrabbaBrand } from '@/contexts/GrabbaBrandContext';
import { BrandFilterBar } from '@/components/grabba/BrandFilterBar';
import { GRABBA_BRAND_CONFIG, GrabbaBrand } from '@/config/grabbaBrands';

export default function GrabbaTextCenter() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { selectedBrand, setSelectedBrand, getBrandQuery } = useGrabbaBrand();
  
  const [entityType, setEntityType] = useState<string>('store');
  const [entityId, setEntityId] = useState<string>('');
  const [message, setMessage] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  const { data: templates } = useQuery({
    queryKey: ['grabba-sms-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communication_templates')
        .select('*')
        .eq('template_type', 'sms' as any)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: stores } = useQuery({
    queryKey: ['grabba-stores-for-sms', selectedBrand],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name, phone')
        .eq('status', 'active')
        .not('phone', 'is', null)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: entityType === 'store',
  });

  const { data: contacts } = useQuery({
    queryKey: ['grabba-contacts-for-sms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_contacts')
        .select('id, name, phone')
        .not('phone', 'is', null)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: entityType === 'contact',
  });

  const { data: recentTexts } = useQuery({
    queryKey: ['grabba-recent-texts', selectedBrand],
    queryFn: async () => {
      const brandsToQuery = getBrandQuery();
      const { data, error } = await supabase
        .from('communication_logs')
        .select(`
          *,
          contact:crm_contacts(name),
          store:stores(name)
        `)
        .eq('channel', 'sms')
        .in('brand', brandsToQuery)
        .order('created_at', { ascending: false })
        .limit(15);
      if (error) throw error;
      return data;
    },
  });

  const sendTextMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from('communication_logs').insert([{
        channel: 'sms',
        direction: 'outbound',
        summary: data.message.substring(0, 100),
        full_message: data.message,
        store_id: data.entityType === 'store' ? data.entityId : null,
        contact_id: data.entityType === 'contact' ? data.entityId : null,
        brand: selectedBrand !== 'all' ? selectedBrand : 'gasmask',
        created_by: user?.id,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Text logged successfully');
      queryClient.invalidateQueries({ queryKey: ['grabba-recent-texts'] });
      setMessage('');
      setEntityId('');
    },
    onError: (error) => {
      toast.error('Failed to log text: ' + error.message);
    },
  });

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates?.find(t => t.id === templateId);
    if (template) {
      setMessage(template.message_template);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !message) {
      toast.error('Please select a recipient and enter a message');
      return;
    }
    sendTextMutation.mutate({ entityType, entityId, message });
  };

  const characterCount = message.length;
  const messageCount = Math.ceil(characterCount / 160) || 1;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <MessageSquare className="h-8 w-8 text-primary" />
              Grabba Text Center
            </h1>
            <p className="text-muted-foreground mt-1">
              Send and log SMS communications for Grabba brands
            </p>
          </div>
          <BrandFilterBar
            selectedBrand={selectedBrand}
            onBrandChange={setSelectedBrand}
            variant="compact"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Text Composer */}
          <Card className="p-6 lg:col-span-2 bg-card/50 backdrop-blur border-border/50">
            <div className="flex items-center gap-2 mb-6">
              <MessageSquare className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Compose Text Message</h2>
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
                              {store.name} ({store.phone})
                            </SelectItem>
                          ))
                        : contacts?.map((contact) => (
                            <SelectItem key={contact.id} value={contact.id}>
                              {contact.name} ({contact.phone})
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
                <div className="flex items-center justify-between">
                  <Label>Message</Label>
                  <span className="text-xs text-muted-foreground">
                    {characterCount} chars · {messageCount} SMS
                  </span>
                </div>
                <Textarea
                  placeholder="Type your message here..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={8}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={sendTextMutation.isPending}>
                <Send className="mr-2 h-4 w-4" />
                {sendTextMutation.isPending ? 'Sending...' : 'Send Text'}
              </Button>
            </form>
          </Card>

          {/* Recent Texts */}
          <Card className="p-6 bg-card/50 backdrop-blur border-border/50">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Recent Texts</h2>
            </div>
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {recentTexts?.map((text) => {
                const brandConfig = text.brand ? GRABBA_BRAND_CONFIG[text.brand as GrabbaBrand] : null;
                return (
                  <div key={text.id} className="p-3 rounded-lg border border-border/50 bg-muted/30">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-sm">
                        {text.contact?.name || text.store?.name || 'Unknown'}
                      </p>
                      <div className="flex items-center gap-2">
                        {brandConfig && (
                          <Badge 
                            variant="outline" 
                            className="text-xs"
                            style={{ borderColor: brandConfig.primary, color: brandConfig.primary }}
                          >
                            {brandConfig.label}
                          </Badge>
                        )}
                        <Badge variant="outline" className="capitalize text-xs">
                          {text.direction}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {text.full_message || text.summary}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(text.created_at).toLocaleString()}
                    </p>
                  </div>
                );
              })}
              {(!recentTexts || recentTexts.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No recent texts for selected brand
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
