import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Rocket, Target, Activity, UserX, BarChart3, FileText, 
  Shield, Plus, FlaskConical, AlertTriangle, CheckCircle2
} from 'lucide-react';
import { CampaignBuilder, LiveCampaignMonitor, OptOutRegistry, ProductPlaybookEditor } from '@/components/communication/outbound';
import { TestCallPanel, KillSwitchPanel, ExecutionGateMonitor } from '@/components/outbound';
import { useOutboundCampaigns } from '@/hooks/useOutboundCampaigns';
import { useKillSwitchStatus } from '@/hooks/useGovernedOutboundCall';
import { useBusiness } from '@/contexts/BusinessContext';
import { GlobalBusinessSelector } from '@/components/crm/GlobalBusinessSelector';

export default function OutboundGrowthPage() {
  const { currentBusiness } = useBusiness();
  const businessId = currentBusiness?.id || null;
  
  const { data: campaigns } = useOutboundCampaigns(businessId);
  const { data: killSwitchStatus } = useKillSwitchStatus('global');
  
  const [activeTab, setActiveTab] = useState('monitor');
  const [showCampaignBuilder, setShowCampaignBuilder] = useState(false);
  const [showPlaybookEditor, setShowPlaybookEditor] = useState(false);

  const activeCampaigns = campaigns?.filter(c => c.status === 'active').length || 0;
  const pendingApproval = campaigns?.filter(c => c.status === 'pending_approval' || c.status === 'draft').length || 0;
  const isSystemHalted = killSwitchStatus?.active;

  return (
    <div className="space-y-6">
      {/* Kill Switch Warning Banner */}
      {isSystemHalted && (
        <div className="bg-red-500 text-white p-4 rounded-lg flex items-center gap-3">
          <AlertTriangle className="h-6 w-6" />
          <div>
            <p className="font-bold">SYSTEM HALTED</p>
            <p className="text-sm opacity-90">
              Kill switch is active. All outbound calls are blocked. Reason: {killSwitchStatus?.reason || 'Manual trigger'}
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Rocket className="h-6 w-6 text-primary" />
            Outbound Growth
          </h1>
          <p className="text-muted-foreground">
            AI-powered outbound sales campaigns with full governance
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <GlobalBusinessSelector className="w-[200px]" />
          
          {/* System Status Badge */}
          <Badge 
            variant={isSystemHalted ? 'destructive' : 'default'}
            className="gap-1"
          >
            {isSystemHalted ? (
              <>
                <AlertTriangle className="h-3 w-3" />
                Halted
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3 w-3" />
                Operational
              </>
            )}
          </Badge>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Activity className="h-4 w-4" />
            Active Campaigns
          </div>
          <p className="text-2xl font-bold mt-1">{activeCampaigns}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <FileText className="h-4 w-4" />
            Pending Approval
          </div>
          <p className="text-2xl font-bold mt-1">{pendingApproval}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Target className="h-4 w-4" />
            Total Calls Today
          </div>
          <p className="text-2xl font-bold mt-1">
            {campaigns?.reduce((sum, c) => sum + (c.calls_made || 0), 0) || 0}
          </p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <BarChart3 className="h-4 w-4" />
            Conversion Rate
          </div>
          <p className="text-2xl font-bold mt-1">
            {campaigns?.length ? 
              `${Math.round((campaigns.reduce((sum, c) => sum + (c.conversions || 0), 0) / 
                Math.max(campaigns.reduce((sum, c) => sum + (c.calls_made || 0), 0), 1)) * 100)}%` 
              : '0%'}
          </p>
        </div>
      </div>

      {/* Main Content */}
      {showCampaignBuilder ? (
        <div>
          <Button 
            variant="ghost" 
            onClick={() => setShowCampaignBuilder(false)}
            className="mb-4"
          >
            ← Back to Monitor
          </Button>
          <CampaignBuilder onSuccess={() => setShowCampaignBuilder(false)} />
        </div>
      ) : showPlaybookEditor ? (
        <div>
          <Button 
            variant="ghost" 
            onClick={() => setShowPlaybookEditor(false)}
            className="mb-4"
          >
            ← Back to Monitor
          </Button>
          <ProductPlaybookEditor onClose={() => setShowPlaybookEditor(false)} />
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="monitor" className="gap-2">
                <Activity className="h-4 w-4" />
                Live Monitor
              </TabsTrigger>
              <TabsTrigger value="campaigns" className="gap-2">
                <Target className="h-4 w-4" />
                Campaigns
              </TabsTrigger>
              <TabsTrigger value="test-calls" className="gap-2">
                <FlaskConical className="h-4 w-4" />
                Test Calls
              </TabsTrigger>
              <TabsTrigger value="governance" className="gap-2">
                <Shield className="h-4 w-4" />
                Governance
              </TabsTrigger>
              <TabsTrigger value="playbooks" className="gap-2">
                <FileText className="h-4 w-4" />
                Playbooks
              </TabsTrigger>
              <TabsTrigger value="opt-outs" className="gap-2">
                <UserX className="h-4 w-4" />
                Opt-Outs
              </TabsTrigger>
            </TabsList>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowPlaybookEditor(true)}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                New Playbook
              </Button>
              <Button 
                size="sm"
                onClick={() => setShowCampaignBuilder(true)}
                className="gap-2"
                disabled={isSystemHalted}
              >
                <Plus className="h-4 w-4" />
                New Campaign
              </Button>
            </div>
          </div>

          <TabsContent value="monitor" className="mt-6">
            <LiveCampaignMonitor />
          </TabsContent>

          <TabsContent value="campaigns" className="mt-6">
            <LiveCampaignMonitor />
          </TabsContent>

          <TabsContent value="test-calls" className="mt-6">
            <div className="grid md:grid-cols-2 gap-6">
              <TestCallPanel />
              <ExecutionGateMonitor />
            </div>
          </TabsContent>

          <TabsContent value="governance" className="mt-6">
            <div className="space-y-6">
              <KillSwitchPanel />
              <ExecutionGateMonitor />
            </div>
          </TabsContent>

          <TabsContent value="playbooks" className="mt-6">
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Playbook management coming soon</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setShowPlaybookEditor(true)}
              >
                Create First Playbook
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="opt-outs" className="mt-6">
            <OptOutRegistry />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
