import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Shield,
  Zap,
  Lock,
  Eye
} from 'lucide-react';
import { PowersMatrix } from '@/hooks/useExecutiveDirectives';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface PowersMatrixPanelProps {
  powers: PowersMatrix[];
  isLoading: boolean;
}

export function PowersMatrixPanel({ powers, isLoading }: PowersMatrixPanelProps) {
  const canDo = powers.filter(p => p.category === 'can');
  const cannotDo = powers.filter(p => p.category === 'cannot');
  const requiresApproval = powers.filter(p => p.category === 'requires_approval');

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'can': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'cannot': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'requires_approval': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default: return <Eye className="h-4 w-4" />;
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'can':
        return <Badge className="bg-green-500/20 text-green-500 border-green-500">Allowed</Badge>;
      case 'cannot':
        return <Badge className="bg-red-500/20 text-red-500 border-red-500">Forbidden</Badge>;
      case 'requires_approval':
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500">Approval Required</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  // Default powers if none loaded
  const defaultPowers: PowersMatrix[] = [
    // CAN
    { power_id: '1', power_name: 'recommend_campaigns', category: 'can', description: 'Recommend outbound campaigns based on data', enforced_at: ['ui', 'api', 'edge'] },
    { power_id: '2', power_name: 'allocate_call_volume', category: 'can', description: 'Distribute call volume across brands', enforced_at: ['edge'] },
    { power_id: '3', power_name: 'propose_playbook_combinations', category: 'can', description: 'Suggest playbook + style pairings', enforced_at: ['edge'] },
    { power_id: '4', power_name: 'pause_campaigns_on_risk', category: 'can', description: 'Auto-pause when risk detected', enforced_at: ['edge', 'trigger'] },
    { power_id: '5', power_name: 'request_mode_changes', category: 'can', description: 'Request AI mode promotion/demotion', enforced_at: ['ui', 'api'] },
    // CANNOT
    { power_id: '6', power_name: 'launch_live_campaigns', category: 'cannot', description: 'Start live campaigns without human approval', enforced_at: ['edge', 'api'] },
    { power_id: '7', power_name: 'modify_compliance_baselines', category: 'cannot', description: 'Change compliance thresholds or rules', enforced_at: ['api', 'database'] },
    { power_id: '8', power_name: 'alter_pricing_contracts', category: 'cannot', description: 'Modify pricing, terms, or contracts', enforced_at: ['edge', 'api'] },
    { power_id: '9', power_name: 'override_sentinel_containment', category: 'cannot', description: 'Bypass Sentinel safety containment', enforced_at: ['trigger', 'edge'] },
    { power_id: '10', power_name: 'cross_business_without_approval', category: 'cannot', description: 'Access or operate across businesses', enforced_at: ['rls', 'edge'] },
    // REQUIRES APPROVAL
    { power_id: '11', power_name: 'activate_new_directives', category: 'requires_approval', description: 'Activate drafted executive directives', enforced_at: ['ui'] },
    { power_id: '12', power_name: 'increase_call_volume', category: 'requires_approval', description: 'Scale beyond current limits', enforced_at: ['edge'] },
    { power_id: '13', power_name: 'use_new_playbooks', category: 'requires_approval', description: 'Deploy newly created playbooks', enforced_at: ['edge'] },
  ];

  const displayPowers = powers.length > 0 ? powers : defaultPowers;
  const displayCanDo = displayPowers.filter(p => p.category === 'can');
  const displayCannotDo = displayPowers.filter(p => p.category === 'cannot');
  const displayRequiresApproval = displayPowers.filter(p => p.category === 'requires_approval');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Executive AI Powers Matrix</h3>
      </div>

      <p className="text-sm text-muted-foreground">
        This matrix defines what the Executive AI can and cannot do. Powers are enforced at UI, API, and edge function levels.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* CAN DO */}
        <Card className="border-green-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-green-500" />
              Executive AI CAN
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {displayCanDo.map(power => (
              <div key={power.power_id} className="p-2 rounded bg-green-500/5 border border-green-500/20">
                <p className="text-sm font-medium">{power.power_name.replace(/_/g, ' ')}</p>
                <p className="text-xs text-muted-foreground">{power.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* CANNOT DO */}
        <Card className="border-red-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Lock className="h-4 w-4 text-red-500" />
              Executive AI CANNOT
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {displayCannotDo.map(power => (
              <div key={power.power_id} className="p-2 rounded bg-red-500/5 border border-red-500/20">
                <p className="text-sm font-medium">{power.power_name.replace(/_/g, ' ')}</p>
                <p className="text-xs text-muted-foreground">{power.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* REQUIRES APPROVAL */}
        <Card className="border-yellow-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Requires Human Approval
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {displayRequiresApproval.map(power => (
              <div key={power.power_id} className="p-2 rounded bg-yellow-500/5 border border-yellow-500/20">
                <p className="text-sm font-medium">{power.power_name.replace(/_/g, ' ')}</p>
                <p className="text-xs text-muted-foreground">{power.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Enforcement Levels */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Enforcement Levels</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="text-xs">
              <span className="w-2 h-2 rounded-full bg-blue-500 mr-2" />
              UI — Button disabled / hidden
            </Badge>
            <Badge variant="outline" className="text-xs">
              <span className="w-2 h-2 rounded-full bg-purple-500 mr-2" />
              API — Request rejected
            </Badge>
            <Badge variant="outline" className="text-xs">
              <span className="w-2 h-2 rounded-full bg-orange-500 mr-2" />
              Edge — Function gate blocks
            </Badge>
            <Badge variant="outline" className="text-xs">
              <span className="w-2 h-2 rounded-full bg-cyan-500 mr-2" />
              Trigger — Database prevents
            </Badge>
            <Badge variant="outline" className="text-xs">
              <span className="w-2 h-2 rounded-full bg-pink-500 mr-2" />
              RLS — Row-level security
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default PowersMatrixPanel;
