import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Check, X, User } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function UnmatchedMessagesPanel() {
  const { currentBusiness } = useBusiness();
  const queryClient = useQueryClient();
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [selectedContactId, setSelectedContactId] = useState('');

  // Fetch unmatched messages
  const { data: unmatchedMessages, refetch } = useQuery({
    queryKey: ['unmatched-messages', currentBusiness?.id],
    queryFn: async () => {
      if (!currentBusiness?.id) return [];

      const { data, error } = await supabase
        .from('unmatched_messages')
        .select(`
          *,
          suggested_contact:crm_contacts(id, name, phone, email)
        `)
        .eq('business_id', currentBusiness.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentBusiness?.id,
  });

  // Fetch contacts for manual matching
  const { data: contacts } = useQuery({
    queryKey: ['crm-contacts', currentBusiness?.id],
    queryFn: async () => {
      if (!currentBusiness?.id) return [];

      const { data, error } = await supabase
        .from('crm_contacts')
        .select('id, name, phone, email')
        .eq('business_id', currentBusiness.id)
        .order('name');

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentBusiness?.id,
  });

  // Real-time subscription
  useEffect(() => {
    if (!currentBusiness?.id) return;

    const channel = supabase
      .channel('unmatched-messages-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'unmatched_messages',
          filter: `business_id=eq.${currentBusiness.id}`,
        },
        (payload) => {
          console.log('🔄 Unmatched message updated:', payload);
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentBusiness?.id, refetch]);

  // Match message to contact
  const matchMutation = useMutation({
    mutationFn: async ({ messageId, contactId }: { messageId: string; contactId: string }) => {
      const message = unmatchedMessages?.find(m => m.id === messageId);
      if (!message) throw new Error('Message not found');

      // Create communication log
      const { logCommunication } = await import('@/services/communicationLogger');
      await logCommunication({
        channel: message.channel as 'sms' | 'email' | 'call',
        direction: 'inbound',
        summary: `Incoming ${message.channel} from customer (manually matched)`,
        message_content: message.message_content,
        contact_id: contactId,
        business_id: currentBusiness?.id,
        sender_phone: message.sender_phone,
        sender_email: message.sender_email,
        performed_by: 'system',
      });

      // Update unmatched message status
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('unmatched_messages')
        .update({
          status: 'matched',
          matched_by: user?.id,
          matched_at: new Date().toISOString(),
        })
        .eq('id', messageId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Message matched and logged');
      setSelectedMessage(null);
      setSelectedContactId('');
      queryClient.invalidateQueries({ queryKey: ['unmatched-messages'] });
      queryClient.invalidateQueries({ queryKey: ['communication-logs-crm'] });
    },
    onError: (error) => {
      console.error('Failed to match message:', error);
      toast.error('Failed to match message');
    },
  });

  // Dismiss message
  const dismissMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from('unmatched_messages')
        .update({ status: 'dismissed' })
        .eq('id', messageId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Message dismissed');
      queryClient.invalidateQueries({ queryKey: ['unmatched-messages'] });
    },
    onError: (error) => {
      console.error('Failed to dismiss message:', error);
      toast.error('Failed to dismiss message');
    },
  });

  if (!unmatchedMessages || unmatchedMessages.length === 0) {
    return null;
  }

  return (
    <>
      <Card className="border-orange-200 bg-orange-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-700">
            <AlertCircle className="w-5 h-5" />
            Unmatched Messages ({unmatchedMessages.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {unmatchedMessages.map((msg) => (
            <div
              key={msg.id}
              className="flex items-start gap-3 p-4 bg-white rounded-lg border border-orange-200"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="capitalize">
                    {msg.channel}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {msg.sender_phone || msg.sender_email}
                  </span>
                </div>
                <p className="text-sm line-clamp-2">{msg.message_content}</p>
                {msg.suggested_contact && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    AI suggests: {msg.suggested_contact.name} 
                    ({(msg.ai_confidence_score * 100).toFixed(0)}% confidence)
                  </div>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedMessage(msg)}
                >
                  <User className="w-3 h-3 mr-1" />
                  Match
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => dismissMutation.mutate(msg.id)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Match Dialog */}
      <Dialog open={!!selectedMessage} onOpenChange={() => setSelectedMessage(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Match Message to Contact</DialogTitle>
          </DialogHeader>
          {selectedMessage && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-1">
                  {selectedMessage.channel.toUpperCase()} from{' '}
                  {selectedMessage.sender_phone || selectedMessage.sender_email}
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedMessage.message_content}
                </p>
              </div>

              {selectedMessage.suggested_contact && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-blue-900 mb-1">
                    AI Suggestion ({(selectedMessage.ai_confidence_score * 100).toFixed(0)}% confidence)
                  </p>
                  <p className="text-sm text-blue-700">
                    {selectedMessage.suggested_contact.name}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => setSelectedContactId(selectedMessage.ai_suggested_contact_id)}
                  >
                    Use AI Suggestion
                  </Button>
                </div>
              )}

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Select Contact
                </label>
                <Select value={selectedContactId} onValueChange={setSelectedContactId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a contact..." />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts?.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.name} - {contact.phone || contact.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  disabled={!selectedContactId || matchMutation.isPending}
                  onClick={() =>
                    matchMutation.mutate({
                      messageId: selectedMessage.id,
                      contactId: selectedContactId,
                    })
                  }
                >
                  <Check className="w-4 h-4 mr-2" />
                  Match & Log
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedMessage(null);
                    setSelectedContactId('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
