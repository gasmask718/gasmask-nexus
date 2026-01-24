import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Phone, 
  Plus, 
  FlaskConical, 
  CheckCircle2,
  AlertTriangle,
  Shield,
  Loader2,
  Rocket,
  FileText,
  Play
} from 'lucide-react';
import { 
  useTestCallWhitelist, 
  useAddToTestWhitelist,
  useKillSwitchStatus
} from '@/hooks/useGovernedOutboundCall';
import { 
  useTestCampaigns,
  useTestPlaybooks,
  useCreateCampaignRun,
  useCreateDefaultTestSetup,
  TestCampaign,
  TestPlaybook
} from '@/hooks/useTestCampaigns';
import { useBusiness } from '@/contexts/BusinessContext';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

/**
 * TEST CALL PANEL (Enhanced)
 * 
 * Complete test environment with:
 * - Campaign selector
 * - Playbook selector
 * - Whitelist management
 * - Campaign run creation
 * - Test call execution
 */

export function TestCallPanel() {
  const { currentBusiness } = useBusiness();
  const businessId = currentBusiness?.id || null;
  
  const [newPhone, setNewPhone] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [selectedPhone, setSelectedPhone] = useState('');
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [selectedPlaybookId, setSelectedPlaybookId] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  
  // Data hooks
  const { data: whitelist = [], isLoading: loadingWhitelist } = useTestCallWhitelist(businessId);
  const { data: killSwitch } = useKillSwitchStatus('global');
  const { data: campaigns = [], isLoading: loadingCampaigns } = useTestCampaigns(businessId);
  const { data: playbooks = [], isLoading: loadingPlaybooks } = useTestPlaybooks(businessId);
  
  // Mutations
  const addToWhitelist = useAddToTestWhitelist();
  const createRun = useCreateCampaignRun();
  const createDefaultSetup = useCreateDefaultTestSetup();

  // Selected entities
  const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId);
  const selectedPlaybook = playbooks.find(p => p.id === selectedPlaybookId);

  // Auto-select playbook when campaign changes
  const handleCampaignChange = (campaignId: string) => {
    setSelectedCampaignId(campaignId);
    const campaign = campaigns.find(c => c.id === campaignId);
    if (campaign?.product_playbook_id) {
      setSelectedPlaybookId(campaign.product_playbook_id);
    }
  };

  const handleAddToWhitelist = async () => {
    if (!newPhone || !businessId) return;
    
    await addToWhitelist.mutateAsync({
      business_id: businessId,
      phone_number: newPhone,
      label: newLabel || undefined,
      is_internal: true
    });
    
    setNewPhone('');
    setNewLabel('');
  };

  const handleCreateDefaultSetup = async () => {
    if (!businessId) return;
    const result = await createDefaultSetup.mutateAsync(businessId);
    if (result.campaign) {
      setSelectedCampaignId(result.campaign.id);
    }
    if (result.playbook) {
      setSelectedPlaybookId(result.playbook.id);
    }
  };

  const handleExecuteTestCall = async () => {
    if (!selectedPhone || !businessId) {
      toast.error('Select a whitelisted phone number');
      return;
    }

    if (!selectedCampaignId) {
      toast.error('Select a test campaign');
      return;
    }

    setIsExecuting(true);
    setTestResult(null);

    try {
      // Create a test campaign run
      const run = await createRun.mutateAsync({
        campaign_id: selectedCampaignId,
        business_id: businessId,
      });

      // Now call the governed outbound function
      const { data, error } = await supabase.functions.invoke('governed-outbound-call', {
        body: {
          phone_number: selectedPhone,
          campaign_id: selectedCampaignId,
          campaign_run_id: run.id,
          playbook_id: selectedPlaybookId || selectedCampaign?.product_playbook_id,
          execution_mode: 'test',
          business_id: businessId,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      setTestResult({
        success: data?.success ?? false,
        message: data?.message || 'Test call executed',
        gates_checked: data?.gate_checks || [],
        session_id: data?.session_id,
        execution_mode: 'test',
        campaign_run_id: run.id,
      });

      if (data?.success) {
        toast.success('Test call initiated');
      } else {
        toast.warning(data?.message || 'Call blocked by governance');
      }
    } catch (error: any) {
      console.error('Test call error:', error);
      setTestResult({
        success: false,
        message: error.message || 'Test call failed',
        gates_checked: [],
      });
      toast.error(error.message || 'Test call failed');
    } finally {
      setIsExecuting(false);
    }
  };

  const canExecute = selectedPhone && selectedCampaignId && !killSwitch?.active && !isExecuting;

  return (
    <div className="space-y-6">
      {/* System Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-primary" />
              <CardTitle>Test Call Protocol</CardTitle>
            </div>
            {killSwitch?.active ? (
              <Badge variant="destructive">Kill Switch Active</Badge>
            ) : (
              <Badge variant="outline" className="text-green-600 border-green-600">System Ready</Badge>
            )}
          </div>
          <CardDescription>
            Safe testing environment — No external selling, no metrics, no learning
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Campaign & Playbook Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Rocket className="h-4 w-4" />
            Test Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Campaign Selector */}
          <div className="space-y-2">
            <Label>Test Campaign *</Label>
            {loadingCampaigns ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading campaigns...
              </div>
            ) : campaigns.length === 0 ? (
              <div className="border-2 border-dashed rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground mb-3">No campaigns found for this business</p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleCreateDefaultSetup}
                  disabled={createDefaultSetup.isPending}
                >
                  {createDefaultSetup.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Create Default Test Setup
                </Button>
              </div>
            ) : (
              <Select value={selectedCampaignId} onValueChange={handleCampaignChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a campaign..." />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      <div className="flex items-center gap-2">
                        <span>{campaign.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {campaign.status}
                        </Badge>
                        {campaign.product_playbook_id && (
                          <Badge variant="outline" className="text-xs text-green-600">
                            has playbook
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Playbook Selector */}
          <div className="space-y-2">
            <Label>Playbook {selectedCampaign?.product_playbook_id ? '(auto-selected)' : ''}</Label>
            {loadingPlaybooks ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading playbooks...
              </div>
            ) : playbooks.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No playbooks found. Create a campaign with a playbook first.
              </div>
            ) : (
              <Select 
                value={selectedPlaybookId} 
                onValueChange={setSelectedPlaybookId}
                disabled={!!selectedCampaign?.product_playbook_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a playbook..." />
                </SelectTrigger>
                <SelectContent>
                  {playbooks.map((playbook) => (
                    <SelectItem key={playbook.id} value={playbook.id}>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span>{playbook.product_name}</span>
                        {playbook.is_active && (
                          <Badge variant="outline" className="text-xs text-green-600">
                            active
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Debug Info */}
          <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
            <p><strong>Business ID:</strong> {businessId || 'None'}</p>
            <p><strong>Campaigns Found:</strong> {campaigns.length}</p>
            <p><strong>Playbooks Found:</strong> {playbooks.length}</p>
          </div>
        </CardContent>
      </Card>

      {/* Whitelist Management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Test Whitelist
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Phone number (e.g. +1234567890)"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
              />
            </div>
            <div className="w-32">
              <Input
                placeholder="Label"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
              />
            </div>
            <Button 
              onClick={handleAddToWhitelist}
              disabled={!newPhone || addToWhitelist.isPending}
            >
              {addToWhitelist.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>

          {loadingWhitelist ? (
            <div className="text-center py-4 text-muted-foreground">Loading whitelist...</div>
          ) : whitelist.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No phone numbers whitelisted. Add your test numbers above.
            </div>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {whitelist.map((entry: any) => (
                <div 
                  key={entry.id}
                  className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-colors ${
                    selectedPhone === entry.phone_number 
                      ? 'border-primary bg-primary/5' 
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setSelectedPhone(entry.phone_number)}
                >
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-sm">{entry.phone_number}</span>
                    {entry.label && (
                      <Badge variant="secondary" className="text-xs">{entry.label}</Badge>
                    )}
                  </div>
                  {selectedPhone === entry.phone_number && (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Execute Test Call */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Play className="h-4 w-4" />
            Execute Test Call
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <Label className="text-muted-foreground">Selected Phone</Label>
              <p className="font-mono">{selectedPhone || 'None'}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Campaign</Label>
              <p>{selectedCampaign?.name || 'None selected'}</p>
            </div>
          </div>

          <Button 
            className="w-full"
            onClick={handleExecuteTestCall}
            disabled={!canExecute}
          >
            {isExecuting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Executing Test Call...
              </>
            ) : (
              <>
                <FlaskConical className="h-4 w-4 mr-2" />
                Execute Governed Test Call
              </>
            )}
          </Button>

          {killSwitch?.active && (
            <div className="flex items-center gap-2 text-red-500 text-sm">
              <AlertTriangle className="h-4 w-4" />
              Kill switch is active. Test calls are blocked.
            </div>
          )}

          {!selectedCampaignId && (
            <div className="flex items-center gap-2 text-amber-500 text-sm">
              <AlertTriangle className="h-4 w-4" />
              Select a test campaign to proceed.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Results */}
      {testResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {testResult.success ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              )}
              Test Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">{testResult.message}</p>
            
            {testResult.gates_checked?.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {testResult.gates_checked.map((gate: any, i: number) => (
                  <div 
                    key={i}
                    className={`flex items-center gap-2 p-2 rounded text-sm ${
                      gate.passed ? 'bg-green-500/10' : 'bg-red-500/10'
                    }`}
                  >
                    {gate.passed ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    )}
                    <span>{gate.name?.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
            )}

            {testResult.session_id && (
              <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                <p><strong>Session ID:</strong> {testResult.session_id}</p>
                {testResult.campaign_run_id && (
                  <p><strong>Run ID:</strong> {testResult.campaign_run_id}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default TestCallPanel;
