import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  Power, 
  RotateCcw, 
  Shield,
  Loader2,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  useKillSwitchStatus, 
  useTriggerKillSwitch, 
  useResetKillSwitch 
} from '@/hooks/useGovernedOutboundCall';
import { useBusiness } from '@/contexts/BusinessContext';

/**
 * KILL SWITCH PANEL
 * 
 * Real-time kill switch control for outbound campaigns:
 * - Global: Stops ALL campaigns system-wide
 * - Business: Stops all campaigns for current business
 * - Campaign: Stops specific campaign (if selected)
 * 
 * Kill switch ALWAYS wins - no exceptions.
 */

interface KillSwitchPanelProps {
  campaignId?: string;
}

export function KillSwitchPanel({ campaignId }: KillSwitchPanelProps) {
  const { currentBusiness } = useBusiness();
  const businessId = currentBusiness?.id;
  
  const [triggerReason, setTriggerReason] = useState('');
  const [selectedScope, setSelectedScope] = useState<'global' | 'business' | 'campaign'>('business');

  const { data: globalStatus, isLoading: loadingGlobal } = useKillSwitchStatus('global');
  const { data: businessStatus, isLoading: loadingBusiness } = useKillSwitchStatus('business', businessId);
  const { data: campaignStatus, isLoading: loadingCampaign } = useKillSwitchStatus('campaign', businessId, campaignId);

  const triggerKillSwitch = useTriggerKillSwitch();
  const resetKillSwitch = useResetKillSwitch();

  const handleTrigger = async (scope: 'global' | 'business' | 'campaign') => {
    if (!triggerReason) return;
    
    await triggerKillSwitch.mutateAsync({
      scope,
      business_id: scope !== 'global' ? businessId : undefined,
      campaign_id: scope === 'campaign' ? campaignId : undefined,
      reason: triggerReason
    });
    
    setTriggerReason('');
  };

  const handleReset = async (scope: 'global' | 'business' | 'campaign') => {
    await resetKillSwitch.mutateAsync({
      scope,
      business_id: scope !== 'global' ? businessId : undefined,
      campaign_id: scope === 'campaign' ? campaignId : undefined
    });
  };

  const getStatusBadge = (status: any, loading: boolean) => {
    if (loading) return <Badge variant="outline"><Loader2 className="h-3 w-3 animate-spin" /></Badge>;
    if (status?.active) return <Badge variant="destructive">HALTED</Badge>;
    return <Badge variant="outline" className="text-green-600">OPERATIONAL</Badge>;
  };

  return (
    <Card className="border-red-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <CardTitle className="text-red-900">Kill Switch Control</CardTitle>
          </div>
          <Badge variant="outline" className="text-red-600">
            Emergency Controls
          </Badge>
        </div>
        <CardDescription>
          Instant halt capability — Kill switch always wins, no exceptions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Overview */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-lg border bg-background">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Global</span>
              {getStatusBadge(globalStatus, loadingGlobal)}
            </div>
            <p className="text-xs text-muted-foreground">All campaigns, all businesses</p>
          </div>
          
          <div className="p-4 rounded-lg border bg-background">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Business</span>
              {getStatusBadge(businessStatus, loadingBusiness)}
            </div>
            <p className="text-xs text-muted-foreground">{currentBusiness?.name || 'Current business'}</p>
          </div>
          
          <div className="p-4 rounded-lg border bg-background">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Campaign</span>
              {campaignId ? getStatusBadge(campaignStatus, loadingCampaign) : (
                <Badge variant="outline">N/A</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {campaignId ? 'Selected campaign' : 'No campaign selected'}
            </p>
          </div>
        </div>

        {/* Trigger Controls */}
        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label>Reason for Kill Switch</Label>
              <Input
                placeholder="e.g., Compliance issue detected, High objection rate..."
                value={triggerReason}
                onChange={(e) => setTriggerReason(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {/* Global Trigger */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  className="w-full"
                  disabled={globalStatus?.active || !triggerReason}
                >
                  <Power className="h-4 w-4 mr-2" />
                  Global Halt
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    Trigger Global Kill Switch?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will immediately halt ALL outbound campaigns across ALL businesses.
                    All in-progress calls will be terminated. This requires manual reset.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleTrigger('global')}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {triggerKillSwitch.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Confirm Global Halt'
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Business Trigger */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  className="w-full"
                  disabled={businessStatus?.active || !triggerReason || !businessId}
                >
                  <Power className="h-4 w-4 mr-2" />
                  Business Halt
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    Trigger Business Kill Switch?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will halt all campaigns for {currentBusiness?.name}.
                    In-progress calls will be terminated.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleTrigger('business')}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Confirm Business Halt
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Campaign Trigger */}
            <Button 
              variant="destructive" 
              className="w-full"
              disabled={!campaignId || campaignStatus?.active || !triggerReason}
              onClick={() => campaignId && handleTrigger('campaign')}
            >
              <Power className="h-4 w-4 mr-2" />
              Campaign Halt
            </Button>
          </div>
        </div>

        {/* Reset Controls */}
        {(globalStatus?.active || businessStatus?.active || campaignStatus?.active) && (
          <div className="space-y-4 pt-4 border-t">
            <h4 className="font-medium flex items-center gap-2 text-green-700">
              <RotateCcw className="h-4 w-4" />
              Reset Kill Switch
            </h4>
            
            <div className="grid grid-cols-3 gap-4">
              {globalStatus?.active && (
                <Button 
                  variant="outline"
                  className="w-full border-green-500 text-green-700 hover:bg-green-50"
                  onClick={() => handleReset('global')}
                  disabled={resetKillSwitch.isPending}
                >
                  {resetKillSwitch.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Reset Global
                    </>
                  )}
                </Button>
              )}
              
              {businessStatus?.active && (
                <Button 
                  variant="outline"
                  className="w-full border-green-500 text-green-700 hover:bg-green-50"
                  onClick={() => handleReset('business')}
                  disabled={resetKillSwitch.isPending}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Reset Business
                </Button>
              )}
              
              {campaignId && campaignStatus?.active && (
                <Button 
                  variant="outline"
                  className="w-full border-green-500 text-green-700 hover:bg-green-50"
                  onClick={() => handleReset('campaign')}
                  disabled={resetKillSwitch.isPending}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Reset Campaign
                </Button>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Resetting a kill switch will allow new calls but won't restart halted campaigns.
              Campaigns must be manually reactivated after reset.
            </p>
          </div>
        )}

        {/* Safety Reminder */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <Shield className="h-5 w-5 text-red-500 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Kill Switch Guarantees</p>
              <ul className="text-xs text-red-700 mt-1 space-y-1">
                <li>• Interrupts in-progress calls immediately</li>
                <li>• Blocks ALL new calls instantly</li>
                <li>• Cannot be bypassed by any system</li>
                <li>• Requires manual reset to restore operations</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default KillSwitchPanel;