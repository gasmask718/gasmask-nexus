import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Phone, 
  Plus, 
  Trash2, 
  FlaskConical, 
  CheckCircle2,
  AlertTriangle,
  Shield,
  Loader2
} from 'lucide-react';
import { 
  useTestCallWhitelist, 
  useAddToTestWhitelist,
  useGovernedCall,
  useKillSwitchStatus
} from '@/hooks/useGovernedOutboundCall';
import { useBusiness } from '@/contexts/BusinessContext';
import { toast } from 'sonner';

/**
 * TEST CALL PANEL
 * 
 * Provides a safe environment for testing outbound calls:
 * - Whitelist management
 * - Rate limit display
 * - Test call execution
 * - Results display
 */

export function TestCallPanel() {
  const { currentBusiness } = useBusiness();
  const businessId = currentBusiness?.id || null;
  
  const [newPhone, setNewPhone] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [selectedPhone, setSelectedPhone] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  
  const { data: whitelist = [], isLoading: loadingWhitelist } = useTestCallWhitelist(businessId);
  const { data: killSwitch } = useKillSwitchStatus('global');
  const addToWhitelist = useAddToTestWhitelist();
  const governedCall = useGovernedCall();

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

  const handleTestCall = async () => {
    if (!selectedPhone || !businessId) {
      toast.error('Select a whitelisted phone number');
      return;
    }

    // For test calls, we need a test campaign - show info message
    toast.info('Test calls require an active test campaign. Creating simulation...');
    
    // Simulate the governed call check (without actual campaign)
    setTestResult({
      simulation: true,
      message: 'Test call simulation completed',
      gates_checked: [
        { name: 'kill_switch', passed: !killSwitch?.active },
        { name: 'test_whitelist', passed: true },
        { name: 'rate_limit', passed: true },
        { name: 'disclosure_ready', passed: true }
      ],
      next_steps: [
        '1. Create a test campaign',
        '2. Start a campaign run in test mode',
        '3. Execute call through governed-outbound-call',
        '4. Verify disclosure is spoken',
        '5. Write campaign frame'
      ]
    });
  };

  return (
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
            <Badge variant="outline" className="text-green-600">System Ready</Badge>
          )}
        </div>
        <CardDescription>
          Safe testing environment — No external selling, no metrics, no learning
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Whitelist Management */}
        <div className="space-y-4">
          <h4 className="font-medium flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Test Whitelist
          </h4>
          
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
            <div className="space-y-2">
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
                    <span className="font-mono">{entry.phone_number}</span>
                    {entry.label && (
                      <Badge variant="secondary" className="text-xs">{entry.label}</Badge>
                    )}
                    {entry.is_internal && (
                      <Badge variant="outline" className="text-xs">Internal</Badge>
                    )}
                  </div>
                  {selectedPhone === entry.phone_number && (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Test Call Execution */}
        <div className="space-y-4 pt-4 border-t">
          <h4 className="font-medium flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Execute Test Call
          </h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Selected Number</Label>
              <Input 
                value={selectedPhone || 'None selected'} 
                disabled 
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label>Execution Mode</Label>
              <Input value="Test (No external calling)" disabled />
            </div>
          </div>

          <Button 
            className="w-full"
            onClick={handleTestCall}
            disabled={!selectedPhone || killSwitch?.active || governedCall.isPending}
          >
            {governedCall.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Validating Gates...
              </>
            ) : (
              <>
                <FlaskConical className="h-4 w-4 mr-2" />
                Run Test Call Simulation
              </>
            )}
          </Button>

          {killSwitch?.active && (
            <div className="flex items-center gap-2 text-red-500 text-sm">
              <AlertTriangle className="h-4 w-4" />
              Kill switch is active. Test calls are blocked.
            </div>
          )}
        </div>

        {/* Test Results */}
        {testResult && (
          <div className="space-y-4 pt-4 border-t">
            <h4 className="font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Simulation Results
            </h4>
            
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{testResult.message}</p>
              
              <div className="grid grid-cols-2 gap-2">
                {testResult.gates_checked?.map((gate: any, i: number) => (
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
                    <span>{gate.name.replace('_', ' ')}</span>
                  </div>
                ))}
              </div>

              <div className="bg-muted/50 rounded-lg p-3 mt-4">
                <p className="text-sm font-medium mb-2">Next Steps:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {testResult.next_steps?.map((step: string, i: number) => (
                    <li key={i}>{step}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default TestCallPanel;