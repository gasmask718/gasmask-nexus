import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ArrowLeft,
  CreditCard, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Banknote,
  ExternalLink
} from 'lucide-react';
import { useMyPayoutAccounts, useUpsertPayoutAccount } from '@/hooks/usePayouts';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export default function AmbassadorPayoutSettingsPage() {
  const navigate = useNavigate();
  const { data: accounts, isLoading } = useMyPayoutAccounts();
  const upsertAccount = useUpsertPayoutAccount();

  const [provider, setProvider] = useState<'stripe' | 'manual'>('stripe');
  const [manualDetails, setManualDetails] = useState('');

  // Get current ambassador ID
  const { data: ambassador } = useQuery({
    queryKey: ['my-ambassador-id'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await (supabase as any)
        .from('ambassadors')
        .select('id')
        .eq('user_id', user.id)
        .single();
      return data;
    },
  });

  const stripeAccount = accounts?.find((a: any) => a.provider === 'stripe');
  const manualAccount = accounts?.find((a: any) => a.provider === 'manual');

  const handleSaveManual = async () => {
    if (!ambassador?.id) return;
    
    await upsertAccount.mutateAsync({
      ambassador_id: ambassador.id,
      provider: 'manual',
      provider_account_id: manualDetails,
      payouts_enabled: true,
      kyc_status: 'verified', // Manual accounts are self-verified
    });
  };

  const kycStatusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    unverified: { label: 'Not Verified', variant: 'secondary' },
    pending: { label: 'Pending Review', variant: 'outline' },
    verified: { label: 'Verified', variant: 'default' },
    rejected: { label: 'Rejected', variant: 'destructive' },
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/ambassador/payouts')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Payout Settings</h1>
            <p className="text-muted-foreground">Configure how you receive payments</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Current Status */}
            <Card>
              <CardHeader>
                <CardTitle>Current Payout Method</CardTitle>
              </CardHeader>
              <CardContent>
                {stripeAccount?.payouts_enabled ? (
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <CreditCard className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Stripe Connect</p>
                      <p className="text-sm text-muted-foreground">
                        Account: {stripeAccount.provider_account_id?.slice(0, 12)}...
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={kycStatusConfig[stripeAccount.kyc_status]?.variant || 'secondary'}>
                        {kycStatusConfig[stripeAccount.kyc_status]?.label || stripeAccount.kyc_status}
                      </Badge>
                      {stripeAccount.payouts_enabled && (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Active
                        </Badge>
                      )}
                    </div>
                  </div>
                ) : manualAccount?.payouts_enabled ? (
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Banknote className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Manual Payout</p>
                      <p className="text-sm text-muted-foreground">
                        {manualAccount.provider_account_id || 'Details on file'}
                      </p>
                    </div>
                    <Badge variant="default" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Active
                    </Badge>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                      <AlertCircle className="h-6 w-6 text-destructive" />
                    </div>
                    <div>
                      <p className="font-medium">No payout method configured</p>
                      <p className="text-sm text-muted-foreground">Set up a method below to receive payments</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Setup Options */}
            <Card>
              <CardHeader>
                <CardTitle>Setup Payout Method</CardTitle>
                <CardDescription>Choose how you want to receive your commission payments</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <RadioGroup value={provider} onValueChange={(v: 'stripe' | 'manual') => setProvider(v)}>
                  <div className="flex items-start space-x-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="stripe" id="stripe" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="stripe" className="cursor-pointer">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4" />
                          Stripe Connect (Recommended)
                        </div>
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Automatic deposits to your bank account. Secure, fast, and reliable.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="manual" id="manual" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="manual" className="cursor-pointer">
                        <div className="flex items-center gap-2">
                          <Banknote className="h-4 w-4" />
                          Manual Payout
                        </div>
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Cash, Zelle, PayPal, or other methods handled outside the platform.
                      </p>
                    </div>
                  </div>
                </RadioGroup>

                {provider === 'stripe' && (
                  <Alert>
                    <CreditCard className="h-4 w-4" />
                    <AlertDescription>
                      Stripe Connect setup requires admin assistance. Please contact your administrator to link your Stripe account.
                    </AlertDescription>
                  </Alert>
                )}

                {provider === 'manual' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Payment Details</Label>
                      <Input
                        value={manualDetails}
                        onChange={(e) => setManualDetails(e.target.value)}
                        placeholder="e.g., PayPal: email@example.com, Zelle: (555) 123-4567"
                      />
                      <p className="text-xs text-muted-foreground">
                        Enter your preferred payment method and contact details
                      </p>
                    </div>
                    <Button onClick={handleSaveManual} disabled={!manualDetails || upsertAccount.isPending}>
                      {upsertAccount.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Save Manual Payout Method'
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Info */}
            <Card>
              <CardHeader>
                <CardTitle>Payout Schedule</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payout Frequency</span>
                    <span className="font-medium">Weekly (Mondays)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Minimum Payout</span>
                    <span className="font-medium">$25.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Processing Time</span>
                    <span className="font-medium">1-3 business days</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
