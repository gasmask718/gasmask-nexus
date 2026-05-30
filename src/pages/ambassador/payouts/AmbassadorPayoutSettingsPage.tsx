import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ArrowLeft,
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Banknote,
  Info
} from 'lucide-react';
import { useMyPayoutAccounts, useUpsertPayoutAccount } from '@/hooks/usePayouts';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export default function AmbassadorPayoutSettingsPage() {
  const navigate = useNavigate();
  const { data: accounts, isLoading } = useMyPayoutAccounts();
  const upsertAccount = useUpsertPayoutAccount();

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

  const manualAccount = accounts?.find((a: any) => a.provider === 'manual');

  const handleSaveManual = async () => {
    if (!ambassador?.id) return;
    
    await upsertAccount.mutateAsync({
      ambassador_id: ambassador.id,
      provider: 'manual',
      provider_account_id: manualDetails,
      payouts_enabled: true,
      kyc_status: 'verified',
    });
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
            <p className="text-muted-foreground">How you receive your commission payments</p>
          </div>
        </div>

        {/* Cash Notice */}
        <Alert className="border-amber-500/30 bg-amber-500/10">
          <Info className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            Payouts are currently handled directly in cash. Online payout setup (Stripe, bank transfer, etc.) is coming soon.
          </AlertDescription>
        </Alert>

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
                {manualAccount?.payouts_enabled ? (
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Banknote className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Cash / Manual Payout</p>
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
                      <p className="font-medium">No payout details on file</p>
                      <p className="text-sm text-muted-foreground">
                        Add your preferred cash contact info below so admin knows how to reach you
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Manual Payout Details */}
            <Card>
              <CardHeader>
                <CardTitle>Your Payout Details</CardTitle>
                <CardDescription>
                  How admin should contact you for cash payouts (optional — for record-keeping)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Payment Preference / Contact</Label>
                  <Input
                    value={manualDetails}
                    onChange={(e) => setManualDetails(e.target.value)}
                    placeholder="e.g., Pick up at office, Zelle: (555) 123-4567, PayPal: email@example.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    This is optional. Admin will coordinate cash payouts directly with you.
                  </p>
                </div>
                <Button onClick={handleSaveManual} disabled={!manualDetails || upsertAccount.isPending}>
                  {upsertAccount.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Payout Details'
                  )}
                </Button>
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
                    <span className="text-muted-foreground">Processing</span>
                    <span className="font-medium">Handled directly by admin</span>
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
