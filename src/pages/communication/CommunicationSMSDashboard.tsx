import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SmsProviderSelect } from "@/components/communication/SmsProviderSelect";
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MessageSquare, Send, Loader2, CheckCircle2, XCircle, Clock, Phone } from 'lucide-react';
import { toast } from 'sonner';
import CommunicationLayout from './CommunicationLayout';

const PHONE_REGEX = /^[0-9]{10,15}$/;

const CommunicationSMSDashboard = () => {
  const { currentBusiness } = useBusiness();
  const queryClient = useQueryClient();
  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState("default");

  // Fetch sent messages from communication_messages
  const { data: messages, isLoading } = useQuery({
    queryKey: ['biztext-sms-history', currentBusiness?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communication_messages')
        .select('*')
        .eq('channel', 'biztext')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentBusiness?.id,
  });

  // Stats
  const totalSent = messages?.length ?? 0;
  const delivered = messages?.filter(m => m.status === 'delivered').length ?? 0;
  const failed = messages?.filter(m => m.status === 'failed').length ?? 0;

  const cleanPhone = recipient.replace(/[\s\-()+ ]/g, '');
  const isPhoneValid = PHONE_REGEX.test(cleanPhone);
  const charCount = message.length;
  const canSend = isPhoneValid && message.trim().length > 0 && !isSending;

  const handleSend = async () => {
    if (!canSend) return;
    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: {
          to_number: cleanPhone,
          message_body: message.trim(),
          idempotency_key: crypto.randomUUID(),
          explicit_provider: selectedProvider === "default" ? undefined : selectedProvider,
          metadata: { business_id: currentBusiness?.id },
        },
      });

      if (error) throw error;
      if (data?.success) {
        toast.success('SMS sent successfully');
        setRecipient('');
        setMessage('');
        queryClient.invalidateQueries({ queryKey: ['biztext-sms-history'] });
      } else {
        throw new Error(data?.error || 'Failed to send SMS');
      }
    } catch (err: any) {
      console.error('SMS send error:', err);
      toast.error(err.message || 'Failed to send SMS');
    } finally {
      setIsSending(false);
    }
  };

  const statusBadge = (status: string | null) => {
    switch (status) {
      case 'delivered':
        return <Badge className="bg-[hsl(var(--success))] text-white gap-1"><CheckCircle2 className="h-3 w-3" /> Delivered</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Failed</Badge>;
      default:
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
    }
  };

  return (
    <CommunicationLayout
      title="SMS Dashboard"
      subtitle="Send and track text messages via BizText (textit.biz)"
    >
      <div className="space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Sent</p>
                  <p className="text-3xl font-bold">{totalSent}</p>
                </div>
                <MessageSquare className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Delivered</p>
                  <p className="text-3xl font-bold text-[hsl(var(--success))]">{delivered}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-[hsl(var(--success))]" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Failed</p>
                  <p className="text-3xl font-bold text-destructive">{failed}</p>
                </div>
                <XCircle className="h-8 w-8 text-destructive" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Composer */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Compose SMS
            </CardTitle>
            <CardDescription>Send a text message via BizText API</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="recipient">Recipient Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="recipient"
                  placeholder="e.g. 9477xxxxxxx"
                  className="pl-10"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                />
              </div>
              {recipient && !isPhoneValid && (
                <p className="text-xs text-destructive">Enter a valid phone number (10-15 digits, international format)</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="sms-message">Message</Label>
              <Textarea
                id="sms-message"
                placeholder="Type your message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <div className="flex justify-between items-center">
                <p className="text-xs text-muted-foreground">
                  {charCount > 160 && <span className="text-[hsl(var(--warning))]">Multi-part SMS — </span>}
                  Standard SMS: 160 chars
                </p>
                <p className={`text-xs font-medium ${charCount > 160 ? 'text-[hsl(var(--warning))]' : 'text-muted-foreground'}`}>
                  {charCount} / 160
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <div className="flex items-center gap-3">
                <SmsProviderSelect value={selectedProvider} onChange={setSelectedProvider} className="min-w-[160px]" />
                <Button onClick={handleSend} disabled={!canSend}>
                {isSending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send SMS
                  </>
                )}
              </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Message History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Message History
            </CardTitle>
            <CardDescription>Recent SMS messages sent via BizText</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : messages && messages.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {messages.map((msg) => (
                      <TableRow key={msg.id}>
                        <TableCell className="font-mono text-sm">{msg.phone_number || '—'}</TableCell>
                        <TableCell className="max-w-[300px] truncate">{msg.content || '—'}</TableCell>
                        <TableCell>{statusBadge(msg.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {msg.created_at ? new Date(msg.created_at).toLocaleString() : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No messages sent yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </CommunicationLayout>
  );
};

export default CommunicationSMSDashboard;
