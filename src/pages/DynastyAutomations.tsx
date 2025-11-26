import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Zap, Plus, MessageSquare, Package, User, Truck, DollarSign, Clock } from 'lucide-react';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { AutomationEventType, DEFAULT_AUTOMATION_TEMPLATES } from '@/services/automationService';

const EVENT_CATEGORIES = {
  'Order Events': ['order_created', 'order_paid', 'order_delivered'],
  'Contact Events': ['new_contact_created', 'new_store_created', 'new_brand_sub_account_created'],
  'Delivery Events': ['biker_delivery_assigned', 'biker_delivery_completed'],
  'Ambassador Events': ['new_store_found', 'new_purchase_initiated', 'new_transaction_completed'],
  'Lead Signups': ['wholesale_signup', 'funding_signup', 'playboxxx_model_signup', 'icllean_client_signup', 'sports_betting_user_signup'],
};

const EVENT_ICONS: Record<string, any> = {
  order_created: Package,
  order_paid: DollarSign,
  order_delivered: Truck,
  new_contact_created: User,
  new_store_created: User,
  biker_delivery_assigned: Truck,
  biker_delivery_completed: Truck,
  new_store_found: User,
};

export default function DynastyAutomations() {
  const { currentBusiness } = useBusiness();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<AutomationEventType>('order_created');
  const [templateMessage, setTemplateMessage] = useState('');

  // Fetch automation rules
  const { data: automationRules, isLoading } = useQuery({
    queryKey: ['automation-rules', currentBusiness?.id],
    queryFn: async () => {
      if (!currentBusiness?.id) return [];

      const { data, error } = await supabase
        .from('automation_rules')
        .select('*')
        .eq('business_id', currentBusiness.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentBusiness?.id,
  });

  // Fetch automation logs
  const { data: automationLogs } = useQuery({
    queryKey: ['automation-logs', currentBusiness?.id],
    queryFn: async () => {
      if (!currentBusiness?.id) return [];

      const { data, error } = await supabase
        .from('automation_logs')
        .select('*')
        .eq('business_id', currentBusiness.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentBusiness?.id,
  });

  // Create automation rule
  const createRuleMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('automation_rules')
        .insert({
          business_id: currentBusiness?.id,
          brand: selectedBrand || null,
          event_type: selectedEvent,
          action_type: 'send_sms',
          is_enabled: true,
          template_message: templateMessage || DEFAULT_AUTOMATION_TEMPLATES[selectedEvent],
          created_by: user?.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Automation rule created');
      setIsDialogOpen(false);
      setSelectedBrand('');
      setSelectedEvent('order_created');
      setTemplateMessage('');
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
    },
    onError: (error) => {
      console.error('Failed to create automation rule:', error);
      toast.error('Failed to create automation rule');
    },
  });

  // Toggle automation rule
  const toggleRuleMutation = useMutation({
    mutationFn: async ({ ruleId, isEnabled }: { ruleId: string; isEnabled: boolean }) => {
      const { error } = await supabase
        .from('automation_rules')
        .update({ is_enabled: isEnabled })
        .eq('id', ruleId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Automation rule updated');
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
    },
    onError: (error) => {
      console.error('Failed to update automation rule:', error);
      toast.error('Failed to update automation rule');
    },
  });

  const successfulLogs = automationLogs?.filter(log => log.status === 'success').length || 0;
  const failedLogs = automationLogs?.filter(log => log.status === 'failed').length || 0;
  const pendingLogs = automationLogs?.filter(log => log.status === 'pending').length || 0;

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dynasty Automations</h1>
          <p className="text-muted-foreground">Event-based automatic messaging</p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Rules</CardTitle>
              <Zap className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {automationRules?.filter(r => r.is_enabled).length || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Successful</CardTitle>
              <MessageSquare className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{successfulLogs}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{pendingLogs}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
              <MessageSquare className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{failedLogs}</div>
            </CardContent>
          </Card>
        </div>

        {/* Automation Rules */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Automation Rules
            </CardTitle>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Rule
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create Automation Rule</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Brand (Optional)</Label>
                    <Input
                      placeholder="Leave empty for all brands"
                      value={selectedBrand}
                      onChange={(e) => setSelectedBrand(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label>Event Trigger</Label>
                    <Select value={selectedEvent} onValueChange={(v) => {
                      setSelectedEvent(v as AutomationEventType);
                      setTemplateMessage(DEFAULT_AUTOMATION_TEMPLATES[v as AutomationEventType]);
                    }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(EVENT_CATEGORIES).map(([category, events]) => (
                          <div key={category}>
                            <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                              {category}
                            </div>
                            {events.map((event) => (
                              <SelectItem key={event} value={event}>
                                {event.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </SelectItem>
                            ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>SMS Template Message</Label>
                    <Textarea
                      placeholder="Message template..."
                      value={templateMessage}
                      onChange={(e) => setTemplateMessage(e.target.value)}
                      rows={4}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Available variables: {'{brand}'}, {'{store_name}'}
                    </p>
                  </div>

                  <Button
                    className="w-full"
                    onClick={() => createRuleMutation.mutate()}
                    disabled={createRuleMutation.isPending}
                  >
                    Create Automation Rule
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : automationRules && automationRules.length > 0 ? (
              <div className="space-y-3">
                {automationRules.map((rule) => {
                  const Icon = EVENT_ICONS[rule.event_type] || Zap;
                  return (
                    <div key={rule.id} className="flex items-start gap-4 p-4 rounded-lg border">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium">
                            {rule.event_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </p>
                          {rule.brand && <Badge variant="outline">{rule.brand}</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {rule.template_message}
                        </p>
                      </div>
                      <Switch
                        checked={rule.is_enabled}
                        onCheckedChange={(checked) =>
                          toggleRuleMutation.mutate({ ruleId: rule.id, isEnabled: checked })
                        }
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No automation rules yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Create your first rule to start automating messages
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Automation Logs */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {automationLogs && automationLogs.length > 0 ? (
              <div className="space-y-2">
                {automationLogs.slice(0, 10).map((log) => (
                  <div key={log.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {log.event_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Badge
                      variant={
                        log.status === 'success' ? 'default' :
                        log.status === 'pending' ? 'secondary' : 'destructive'
                      }
                    >
                      {log.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">No activity yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
