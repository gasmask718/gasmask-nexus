import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  Shield,
  DollarSign,
  Truck,
  Cpu,
  FileCheck,
  Building2,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';

const BUSINESSES = [
  { id: 'all', name: 'All Businesses' },
  { id: 'gasmask', name: 'GasMask' },
  { id: 'grabba', name: 'Grabba / Hot Mama / Scalatti' },
  { id: 'toptier', name: 'Top Tier Experience' },
  { id: 'unforgettable', name: 'Unforgettable Times' },
  { id: 'playboxxx', name: 'PlayBoxxx' },
  { id: 'funding', name: 'Funding Company' },
  { id: 'iclean', name: 'iClean WeClean' },
  { id: 'reselling', name: 'Prime Source Depot' },
  { id: 'investments', name: 'Real Estate + Investments' },
  { id: 'grants', name: 'Grant Company' },
  { id: 'wealth', name: 'Wealth Engine' },
  { id: 'betting', name: 'Sports Betting AI' },
];

const RISK_TYPES = [
  { id: 'all', name: 'All Types', icon: AlertTriangle },
  { id: 'financial', name: 'Financial', icon: DollarSign },
  { id: 'operational', name: 'Operational', icon: Truck },
  { id: 'tech', name: 'Technical', icon: Cpu },
  { id: 'compliance', name: 'Compliance', icon: FileCheck },
];

const risks = [
  {
    id: '1',
    type: 'financial',
    severity: 'critical',
    title: 'Funding files over SLA',
    description: '4 files in underwriting over 48 hours. Potential revenue loss.',
    business: 'Funding Company',
    impact: '$15,000',
    action: 'Create forced follow-up rule',
  },
  {
    id: '2',
    type: 'financial',
    severity: 'high',
    title: 'Unpaid invoices accumulating',
    description: '12 invoices over 30 days unpaid across GasMask stores.',
    business: 'GasMask / Grabba Cluster',
    impact: '$8,500',
    action: 'Send collection notices',
  },
  {
    id: '3',
    type: 'operational',
    severity: 'high',
    title: 'Driver shortage in Zone 3',
    description: 'Only 2 drivers covering high-demand zone. 3+ needed.',
    business: 'GasMask / Grabba Cluster',
    impact: 'Delayed deliveries',
    action: 'Reassign or recruit',
  },
  {
    id: '4',
    type: 'operational',
    severity: 'medium',
    title: 'VA task backlog',
    description: '47 tasks pending assignment. Normal is <20.',
    business: 'Dynasty OS Core',
    impact: 'Workflow delays',
    action: 'Review and prioritize',
  },
  {
    id: '5',
    type: 'tech',
    severity: 'high',
    title: 'Automation degraded',
    description: 'Funding Pipeline Monitor showing errors.',
    business: 'Funding Company',
    impact: 'Missed follow-ups',
    action: 'Check logs and restart',
  },
  {
    id: '6',
    type: 'tech',
    severity: 'medium',
    title: 'API rate limits approaching',
    description: 'External SMS API at 80% daily limit.',
    business: 'Communication Hub',
    impact: 'Blocked messages',
    action: 'Upgrade plan or optimize',
  },
  {
    id: '7',
    type: 'compliance',
    severity: 'critical',
    title: 'Grant deadline imminent',
    description: '2 client applications due in 72 hours, incomplete docs.',
    business: 'Grant Company',
    impact: '$25,000',
    action: 'Urgent client outreach',
  },
  {
    id: '8',
    type: 'compliance',
    severity: 'medium',
    title: 'Creator payout review pending',
    description: '3 payouts need compliance review before release.',
    business: 'Playboxxx',
    impact: 'Creator trust',
    action: 'Complete review',
  },
];

export default function OwnerRiskRadar() {
  const [business, setBusiness] = useState('all');
  const [riskType, setRiskType] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  };

  const filteredRisks = risks.filter((r) => {
    const businessMatch = business === 'all' || r.business.toLowerCase().includes(business);
    const typeMatch = riskType === 'all' || r.type === riskType;
    return businessMatch && typeMatch;
  });

  const criticalCount = filteredRisks.filter((r) => r.severity === 'critical').length;
  const highCount = filteredRisks.filter((r) => r.severity === 'high').length;
  const mediumCount = filteredRisks.filter((r) => r.severity === 'medium').length;

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/10 border border-red-500/30">
            <Shield className="h-8 w-8 text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Risk Radar</h1>
            <p className="text-sm text-muted-foreground">
              Empire-wide risk monitoring across all businesses
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={business} onValueChange={setBusiness}>
            <SelectTrigger className="w-[200px]">
              <Building2 className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUSINESSES.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={riskType} onValueChange={setRiskType}>
            <SelectTrigger className="w-[160px]">
              <AlertTriangle className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RISK_TYPES.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-xl">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Risks</p>
            <p className="text-2xl font-bold">{filteredRisks.length}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-red-500/30">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Critical</p>
            <p className="text-2xl font-bold text-red-400">{criticalCount}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-amber-500/30">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">High</p>
            <p className="text-2xl font-bold text-amber-400">{highCount}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-blue-500/30">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Medium</p>
            <p className="text-2xl font-bold text-blue-400">{mediumCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Risks List */}
      <Card className="rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Active Risks</CardTitle>
          <CardDescription className="text-xs">Sorted by severity</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-3">
              {filteredRisks
                .sort((a, b) => {
                  const order = { critical: 0, high: 1, medium: 2, low: 3 };
                  return order[a.severity as keyof typeof order] - order[b.severity as keyof typeof order];
                })
                .map((risk) => (
                  <RiskCard key={risk.id} risk={risk} />
                ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function RiskCard({ risk }: { risk: typeof risks[0] }) {
  const navigate = useNavigate();
  const severityConfig = {
    critical: { color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30' },
    high: { color: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/30' },
    medium: { color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/30' },
    low: { color: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/30' },
  };

  const typeIcons = {
    financial: DollarSign,
    operational: Truck,
    tech: Cpu,
    compliance: FileCheck,
  };

  const config = severityConfig[risk.severity as keyof typeof severityConfig];
  const TypeIcon = typeIcons[risk.type as keyof typeof typeIcons];

  return (
    <div 
      className={cn("p-4 rounded-xl border transition-colors hover:bg-muted/30 cursor-pointer", config.border)}
      onClick={() => navigate(`/os/owner/risk/risk-${risk.id}`)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={cn("p-2 rounded-lg", config.bg)}>
            <TypeIcon className={cn("h-4 w-4", config.color)} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-sm">{risk.title}</h4>
              <Badge variant="outline" className={cn(config.bg, config.color, "border-transparent text-[10px]")}>
                {risk.severity}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-2">{risk.description}</p>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-muted-foreground">{risk.business}</span>
              <span className={config.color}>Impact: {risk.impact}</span>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-1 shrink-0" onClick={(e) => { e.stopPropagation(); navigate(`/os/owner/risk/risk-${risk.id}`); }}>
          View Details
          <ChevronRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
