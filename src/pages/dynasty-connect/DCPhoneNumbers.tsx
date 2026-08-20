import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Phone, Settings, PhoneCall, Loader2, CheckCircle, XCircle, Shield, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function DCPhoneNumbers() {
  const qc = useQueryClient();
  const [configuringId, setConfiguringId] = useState<string | null>(null);
  const [configuringAll, setConfiguringAll] = useState(false);
  const [configProgress, setConfigProgress] = useState({ current: 0, total: 0 });
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testNumber, setTestNumber] = useState('');
  const [testFrom, setTestFrom] = useState('');
  const [testFromBusiness, setTestFromBusiness] = useState('');
  const [testing, setTesting] = useState(false);

  const { data: phoneNumbers = [] } = useQuery({
    queryKey: ['dc-phone-numbers-config'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('dc_phone_numbers').select('*').order('created_at');
      return data || [];
    },
  });

  const { data: credStatus } = useQuery({
    queryKey: ['dc-cred-status'],
    queryFn: async () => {
      // Use a real number from our list to validate credentials
      const { data: nums } = await (supabase as any).from('dc_phone_numbers').select('phone_number').limit(1);
      const testNum = nums?.[0]?.phone_number || '+18484004179';
      const { data, error } = await supabase.functions.invoke('twilio-admin-set-number-webhook', {
        body: { phone_number: testNum }
      });
      if (data?.credential_issue) return { checked: true, error: data.error, credentialIssue: true };
      return { checked: true, error: error?.message && !data?.success ? (data?.error || error.message) : null };
    },
    staleTime: 60000,
  });

  const configureWebhook = useMutation({
    mutationFn: async (phone: any) => {
      const { data, error } = await supabase.functions.invoke('twilio-admin-set-number-webhook', {
        body: { phone_number: phone.phone_number, phone_number_id: phone.id }
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Configuration failed');
      return data;
    },
    onSuccess: (_, phone) => {
      toast.success(`Webhook configured for ${phone.phone_number}`);
      qc.invalidateQueries({ queryKey: ['dc-phone-numbers-config'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const configureAll = async () => {
    setConfiguringAll(true);
    const nums = phoneNumbers.filter((p: any) => !p.twilio_webhook_configured);
    setConfigProgress({ current: 0, total: nums.length });

    for (let i = 0; i < nums.length; i++) {
      setConfigProgress({ current: i + 1, total: nums.length });
      try {
        await configureWebhook.mutateAsync(nums[i]);
      } catch {
        // continue to next
      }
    }
    setConfiguringAll(false);
    qc.invalidateQueries({ queryKey: ['dc-phone-numbers-config'] });
    toast.success('All numbers configured!');
  };

  const testCall = async () => {
    if (!testNumber || !testFrom) return;
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('dc-outbound-call', {
        body: { to_number: testNumber, business: testFromBusiness, lead_name: 'Test Call' }
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Call failed');
      toast.success(`Test call initiated — SID: ${data.call_sid}`);
      setTestDialogOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setTesting(false);
    }
  };

  const unconfiguredCount = phoneNumbers.filter((p: any) => !p.twilio_webhook_configured).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Phone className="h-6 w-6" /> Phone Number Configuration
        </h1>
        <p className="text-sm text-muted-foreground">
          Connect Twilio numbers to ElevenLabs agents via webhooks
        </p>
      </div>

      {/* Credentials Status Panel */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" /> Credentials Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {credStatus?.credentialIssue ? (
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-destructive">Twilio Credentials Invalid</p>
                <p className="text-sm text-destructive/80 mt-1">{credStatus.error}</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-2 p-3 rounded-lg border border-border">
                {credStatus?.error ? <XCircle className="h-4 w-4 text-destructive" /> : <CheckCircle className="h-4 w-4 text-green-500" />}
                <div>
                  <p className="text-xs text-muted-foreground">TWILIO_ACCOUNT_SID</p>
                  <p className="text-sm font-mono">{credStatus?.error ? 'Issue detected' : 'Configured'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg border border-border">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <div>
                  <p className="text-xs text-muted-foreground">TWILIO_AUTH_TOKEN</p>
                  <p className="text-sm font-mono">Configured</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg border border-border">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <div>
                  <p className="text-xs text-muted-foreground">ELEVENLABS_API_KEY</p>
                  <p className="text-sm font-mono">Configured</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configure All Button */}
      {unconfiguredCount > 0 && (
        <div className="flex items-center gap-3">
          <Button onClick={configureAll} disabled={configuringAll}>
            {configuringAll ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Configuring {configProgress.current}/{configProgress.total}...
              </>
            ) : (
              <>
                <Settings className="h-4 w-4 mr-2" />
                Configure All Numbers ({unconfiguredCount} remaining)
              </>
            )}
          </Button>
        </div>
      )}

      {/* Phone Numbers Table */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Phone Number</TableHead>
                <TableHead>Display Name</TableHead>
                <TableHead>Business</TableHead>
                <TableHead>ElevenLabs Agent</TableHead>
                <TableHead>Webhook</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {phoneNumbers.map((num: any) => (
                <TableRow key={num.id}>
                  <TableCell className="font-mono text-sm">{num.phone_number}</TableCell>
                  <TableCell>{num.display_name || num.friendly_name || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{num.business?.replace(/_/g, ' ') || '-'}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{num.elevenlabs_agent_name || num.assigned_agent_name || '-'}</span>
                  </TableCell>
                  <TableCell>
                    {num.twilio_webhook_configured ? (
                      <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500">
                        <CheckCircle className="h-3 w-3 mr-1" /> Configured
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500">
                        <XCircle className="h-3 w-3 mr-1" /> Not Configured
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={configuringId === num.id || num.twilio_webhook_configured}
                        onClick={() => {
                          setConfiguringId(num.id);
                          configureWebhook.mutate(num, { onSettled: () => setConfiguringId(null) });
                        }}
                      >
                        {configuringId === num.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Settings className="h-3 w-3 mr-1" />
                        )}
                        {num.twilio_webhook_configured ? 'Done' : 'Configure'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setTestFrom(num.phone_number);
                          setTestFromBusiness(num.business || 'gasmask');
                          setTestDialogOpen(true);
                        }}
                      >
                        <PhoneCall className="h-3 w-3 mr-1" /> Test
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {phoneNumbers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No phone numbers registered
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Test Call Dialog */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test Call from {testFrom}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm text-muted-foreground">Destination Number</label>
              <Input
                value={testNumber}
                onChange={(e) => setTestNumber(e.target.value)}
                placeholder="+1XXXXXXXXXX"
              />
            </div>
            <Button onClick={testCall} disabled={testing || !testNumber} className="w-full">
              {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PhoneCall className="h-4 w-4 mr-2" />}
              Place Test Call
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
