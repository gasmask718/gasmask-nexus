// ═══════════════════════════════════════════════════════════════════════════════
// RISK RADAR PAGE — Early Warning System
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GrabbaLayout } from '@/components/grabba/GrabbaLayout';
import { useRiskRadar, RiskInsight } from '@/hooks/useRiskRadar';
import { RiskLevel, RiskType } from '@/lib/riskEngine';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  AlertTriangle,
  TrendingDown,
  Package,
  Users,
  DollarSign,
  RefreshCw,
  ExternalLink,
  Sparkles,
  ShieldAlert,
  CheckCircle,
  XCircle,
} from 'lucide-react';

const RISK_LEVEL_COLORS: Record<string, string> = {
  critical: 'bg-destructive text-destructive-foreground',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-black',
  low: 'bg-muted text-muted-foreground',
};

const RISK_TYPE_ICONS: Record<string, React.ReactNode> = {
  churn: <TrendingDown className="h-4 w-4" />,
  non_payment: <DollarSign className="h-4 w-4" />,
  low_stock: <Package className="h-4 w-4" />,
  overworked: <Users className="h-4 w-4" />,
  inactive_ambassador: <Users className="h-4 w-4" />,
};

export default function RiskRadar() {
  const navigate = useNavigate();
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  
  const { 
    risksByType, 
    summary, 
    latestSnapshot,
    loading, 
    refetch,
    triggerRiskScan,
    updateRiskStatus,
  } = useRiskRadar({
    brand: brandFilter !== 'all' ? brandFilter : undefined,
    minLevel: levelFilter !== 'all' ? levelFilter as RiskLevel : undefined,
  });

  const [scanning, setScanning] = useState(false);

  const handleTriggerScan = async () => {
    setScanning(true);
    try {
      await triggerRiskScan();
      toast.success('Risk scan completed');
    } catch (error) {
      toast.error('Failed to run risk scan');
    } finally {
      setScanning(false);
    }
  };

  const handleResolve = async (risk: RiskInsight) => {
    try {
      await updateRiskStatus(risk.id, 'resolved');
      toast.success('Risk marked as resolved');
    } catch (error) {
      toast.error('Failed to update risk');
    }
  };

  const handleIgnore = async (risk: RiskInsight) => {
    try {
      await updateRiskStatus(risk.id, 'ignored');
      toast.success('Risk ignored');
    } catch (error) {
      toast.error('Failed to update risk');
    }
  };

  const handleCreatePlaybook = (riskType: RiskType) => {
    const playbookTemplates: Record<RiskType, string> = {
      churn: 'Send recovery text to each store owner|Schedule follow-up tasks for 3 days later|Create route to visit top risk stores tomorrow',
      non_payment: 'Send polite payment reminder|Schedule follow-up task for next Monday',
      low_stock: 'Place emergency reorder|Notify warehouse team',
      overworked: 'Reassign routes to other drivers|Review workload distribution',
      inactive_ambassador: 'Send re-engagement message|Schedule check-in call',
    };
    
    navigate(`/grabba/ai-playbooks?template=${riskType}&steps=${encodeURIComponent(playbookTemplates[riskType])}`);
  };

  const handleOpenInCopilot = (risk: RiskInsight) => {
    const command = `Create a recovery plan for ${risk.entity_type} with ${risk.risk_level} ${risk.risk_type} risk`;
    navigate(`/grabba/ai-console?command=${encodeURIComponent(command)}`);
  };

  const renderRiskCard = (risk: RiskInsight) => (
    <Card key={risk.id} className="mb-3">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge className={RISK_LEVEL_COLORS[risk.risk_level]}>
                {risk.risk_level.toUpperCase()}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Score: {risk.risk_score}
              </span>
            </div>
            <h4 className="font-medium mb-1">{risk.headline}</h4>
            <p className="text-sm text-muted-foreground mb-2">{risk.details}</p>
            {risk.recommended_action && (
              <p className="text-sm text-primary">
                <Sparkles className="h-3 w-3 inline mr-1" />
                {risk.recommended_action}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenInCopilot(risk)}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Fix
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleResolve(risk)}
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              Resolve
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleIgnore(risk)}
            >
              <XCircle className="h-3 w-3 mr-1" />
              Ignore
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderRiskSection = (
    title: string,
    riskType: RiskType,
    risks: RiskInsight[],
    icon: React.ReactNode
  ) => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-semibold">{title}</h3>
          <Badge variant="outline">{risks.length}</Badge>
        </div>
        {risks.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleCreatePlaybook(riskType)}
          >
            <Sparkles className="h-3 w-3 mr-1" />
            Create Fix Playbook
          </Button>
        )}
      </div>
      
      <ScrollArea className="h-[400px]">
        {risks.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No {riskType.replace('_', ' ')} risks detected
          </p>
        ) : (
          risks.map(renderRiskCard)
        )}
      </ScrollArea>
    </div>
  );

  return (
    <GrabbaLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <ShieldAlert className="h-8 w-8 text-primary" />
              Risk Radar
            </h1>
            <p className="text-muted-foreground">
              Early warning system for stores, invoices, stock, and teams
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={brandFilter} onValueChange={setBrandFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Brands" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Brands</SelectItem>
                <SelectItem value="grabba">Grabba</SelectItem>
                <SelectItem value="fronto">Fronto</SelectItem>
              </SelectContent>
            </Select>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleTriggerScan} disabled={scanning}>
              <RefreshCw className={`h-4 w-4 mr-2 ${scanning ? 'animate-spin' : ''}`} />
              {scanning ? 'Scanning...' : 'Run Scan'}
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-orange-500" />
                Churn Risk Stores
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.byType.churn}</div>
              <p className="text-xs text-muted-foreground">
                {risksByType.churn.filter(r => r.risk_level === 'critical').length} critical
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-red-500" />
                Unpaid & Risky
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.byType.non_payment}</div>
              <p className="text-xs text-muted-foreground">
                {risksByType.non_payment.filter(r => r.risk_level === 'critical').length} critical
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4 text-yellow-500" />
                Low Stock Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.byType.low_stock}</div>
              <p className="text-xs text-muted-foreground">
                {risksByType.low_stock.filter(r => r.risk_level === 'critical').length} out of stock
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-500" />
                Team Risks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary.byType.overworked + summary.byType.inactive_ambassador}
              </div>
              <p className="text-xs text-muted-foreground">
                Drivers & Ambassadors
              </p>
            </CardContent>
          </Card>
        </div>

        {/* KPI Snapshot */}
        {latestSnapshot && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Daily Snapshot</CardTitle>
              <CardDescription>
                Last updated: {new Date(latestSnapshot.snapshot_date).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold">{latestSnapshot.total_stores}</div>
                  <div className="text-xs text-muted-foreground">Total Stores</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-500">{latestSnapshot.active_stores}</div>
                  <div className="text-xs text-muted-foreground">Active</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-500">{latestSnapshot.inactive_stores}</div>
                  <div className="text-xs text-muted-foreground">Inactive</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{latestSnapshot.total_invoices}</div>
                  <div className="text-xs text-muted-foreground">Invoices</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-500">{latestSnapshot.unpaid_invoices}</div>
                  <div className="text-xs text-muted-foreground">Unpaid</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-500">{latestSnapshot.low_stock_items}</div>
                  <div className="text-xs text-muted-foreground">Low Stock</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Risk Tabs */}
        <Tabs defaultValue="churn" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="churn" className="flex items-center gap-1">
              <TrendingDown className="h-4 w-4" />
              Stores ({summary.byType.churn})
            </TabsTrigger>
            <TabsTrigger value="non_payment" className="flex items-center gap-1">
              <DollarSign className="h-4 w-4" />
              Invoices ({summary.byType.non_payment})
            </TabsTrigger>
            <TabsTrigger value="low_stock" className="flex items-center gap-1">
              <Package className="h-4 w-4" />
              Inventory ({summary.byType.low_stock})
            </TabsTrigger>
            <TabsTrigger value="overworked" className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              Drivers ({summary.byType.overworked})
            </TabsTrigger>
            <TabsTrigger value="inactive_ambassador" className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              Ambassadors ({summary.byType.inactive_ambassador})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="churn" className="mt-4">
            {renderRiskSection(
              'Stores at Churn Risk',
              'churn',
              risksByType.churn,
              <TrendingDown className="h-5 w-5 text-orange-500" />
            )}
          </TabsContent>

          <TabsContent value="non_payment" className="mt-4">
            {renderRiskSection(
              'Invoices at Non-Payment Risk',
              'non_payment',
              risksByType.non_payment,
              <DollarSign className="h-5 w-5 text-red-500" />
            )}
          </TabsContent>

          <TabsContent value="low_stock" className="mt-4">
            {renderRiskSection(
              'Low Stock Items',
              'low_stock',
              risksByType.low_stock,
              <Package className="h-5 w-5 text-yellow-500" />
            )}
          </TabsContent>

          <TabsContent value="overworked" className="mt-4">
            {renderRiskSection(
              'Overworked Drivers',
              'overworked',
              risksByType.overworked,
              <Users className="h-5 w-5 text-purple-500" />
            )}
          </TabsContent>

          <TabsContent value="inactive_ambassador" className="mt-4">
            {renderRiskSection(
              'Inactive Ambassadors',
              'inactive_ambassador',
              risksByType.inactive_ambassador,
              <Users className="h-5 w-5 text-purple-500" />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </GrabbaLayout>
  );
}
