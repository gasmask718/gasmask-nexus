import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Brain, 
  FlaskConical, 
  Shield, 
  UserCheck, 
  Rocket, 
  Eye,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Lock
} from 'lucide-react';
import { useBusiness } from '@/contexts/BusinessContext';
import { 
  useLearningProposals, 
  useActivePromotions,
  LearningProposal,
  Promotion
} from '@/hooks/useAILearning';
import { ProposalPipeline } from './ProposalPipeline';
import { PromotionWatchPanel } from './PromotionWatchPanel';

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  proposed: { label: 'Proposed', color: 'bg-blue-500/10 text-blue-500', icon: <Brain className="h-3 w-3" /> },
  simulating: { label: 'Simulating', color: 'bg-yellow-500/10 text-yellow-500', icon: <FlaskConical className="h-3 w-3" /> },
  simulation_passed: { label: 'Simulation Passed', color: 'bg-green-500/10 text-green-500', icon: <CheckCircle2 className="h-3 w-3" /> },
  simulation_failed: { label: 'Simulation Failed', color: 'bg-red-500/10 text-red-500', icon: <XCircle className="h-3 w-3" /> },
  pending_sentinel: { label: 'Pending Sentinel', color: 'bg-purple-500/10 text-purple-500', icon: <Shield className="h-3 w-3" /> },
  sentinel_approved: { label: 'Sentinel Approved', color: 'bg-emerald-500/10 text-emerald-500', icon: <Shield className="h-3 w-3" /> },
  sentinel_rejected: { label: 'Sentinel Blocked', color: 'bg-red-500/10 text-red-500', icon: <AlertTriangle className="h-3 w-3" /> },
  pending_human: { label: 'Awaiting Human', color: 'bg-orange-500/10 text-orange-500', icon: <UserCheck className="h-3 w-3" /> },
  approved: { label: 'Approved', color: 'bg-green-500/10 text-green-500', icon: <CheckCircle2 className="h-3 w-3" /> },
  promoted: { label: 'Promoted', color: 'bg-primary/10 text-primary', icon: <Rocket className="h-3 w-3" /> },
  rolled_back: { label: 'Rolled Back', color: 'bg-gray-500/10 text-gray-500', icon: <RotateCcw className="h-3 w-3" /> },
  archived: { label: 'Archived', color: 'bg-gray-500/10 text-gray-500', icon: <Lock className="h-3 w-3" /> }
};

export function AILearningDashboard() {
  const { currentBusiness } = useBusiness();
  const businessId = currentBusiness?.id || null;
  
  const { data: proposals, isLoading: loadingProposals } = useLearningProposals(businessId);
  const { data: promotions, isLoading: loadingPromotions } = useActivePromotions(businessId);
  
  const [selectedProposal, setSelectedProposal] = useState<LearningProposal | null>(null);
  const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(null);

  const pendingProposals = proposals?.filter(p => 
    !['promoted', 'rolled_back', 'archived'].includes(p.status)
  ) || [];
  
  const activeWatchPromotions = promotions?.filter(p => p.watch_mode_active) || [];

  return (
    <div className="space-y-6">
      {/* Pipeline Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Self-Improving AI Pipeline
          </CardTitle>
          <CardDescription>
            AI proposes improvements → Simulates → Sentinel approves → Human signs → Promotes → Watches
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-2 text-sm">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
              <Brain className="h-4 w-4 text-blue-500" />
              <span>Propose</span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
              <FlaskConical className="h-4 w-4 text-yellow-500" />
              <span>Simulate</span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
              <Shield className="h-4 w-4 text-purple-500" />
              <span>Sentinel</span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
              <UserCheck className="h-4 w-4 text-orange-500" />
              <span>Human Sign</span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
              <Rocket className="h-4 w-4 text-green-500" />
              <span>Promote</span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
              <Eye className="h-4 w-4 text-primary" />
              <span>Watch</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Proposals</p>
                <p className="text-2xl font-bold">{pendingProposals.length}</p>
              </div>
              <Brain className="h-8 w-8 text-blue-500/20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Watch</p>
                <p className="text-2xl font-bold">{activeWatchPromotions.length}</p>
              </div>
              <Eye className="h-8 w-8 text-primary/20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Promotions</p>
                <p className="text-2xl font-bold">{promotions?.length || 0}</p>
              </div>
              <Rocket className="h-8 w-8 text-green-500/20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Rollbacks</p>
                <p className="text-2xl font-bold">
                  {promotions?.filter(p => p.is_rolled_back).length || 0}
                </p>
              </div>
              <RotateCcw className="h-8 w-8 text-red-500/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="proposals">
        <TabsList>
          <TabsTrigger value="proposals" className="gap-2">
            <Brain className="h-4 w-4" />
            Proposals
          </TabsTrigger>
          <TabsTrigger value="watch" className="gap-2">
            <Eye className="h-4 w-4" />
            Watch Mode
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <Clock className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="proposals" className="space-y-4">
          {loadingProposals ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Loading proposals...
              </CardContent>
            </Card>
          ) : selectedProposal ? (
            <ProposalPipeline 
              proposal={selectedProposal} 
              onBack={() => setSelectedProposal(null)} 
            />
          ) : (
            <div className="space-y-4">
              {pendingProposals.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                    <p className="text-muted-foreground">No pending proposals</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      AI will generate proposals based on call performance analysis
                    </p>
                  </CardContent>
                </Card>
              ) : (
                pendingProposals.map((proposal) => (
                  <Card 
                    key={proposal.id} 
                    className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => setSelectedProposal(proposal)}
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold">{proposal.title}</h3>
                            <Badge variant="outline" className={statusConfig[proposal.status]?.color}>
                              {statusConfig[proposal.status]?.icon}
                              <span className="ml-1">{statusConfig[proposal.status]?.label}</span>
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {proposal.description}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Type: {proposal.proposal_type.replace('_', ' ')}</span>
                            <span>Risk: {proposal.risk_level}</span>
                            {proposal.expected_improvement_pct && (
                              <span>Expected: +{proposal.expected_improvement_pct}%</span>
                            )}
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="watch" className="space-y-4">
          {loadingPromotions ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Loading promotions...
              </CardContent>
            </Card>
          ) : selectedPromotion ? (
            <PromotionWatchPanel 
              promotion={selectedPromotion}
              onBack={() => setSelectedPromotion(null)}
            />
          ) : activeWatchPromotions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Eye className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">No active watch modes</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Promotions enter watch mode for 48 hours after deployment
                </p>
              </CardContent>
            </Card>
          ) : (
            activeWatchPromotions.map((promotion) => (
              <Card 
                key={promotion.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setSelectedPromotion(promotion)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">v{promotion.version_number}</h3>
                        <Badge variant="outline" className="bg-primary/10 text-primary">
                          <Eye className="h-3 w-3 mr-1" />
                          Watch Active
                        </Badge>
                        {promotion.elevated_sensitivity && (
                          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500">
                            Elevated Sensitivity
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {promotion.promotion_scope}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Type: {promotion.affected_artifact_type}</span>
                        <span>
                          Watch until: {new Date(promotion.watch_mode_until || '').toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {promotions?.filter(p => !p.watch_mode_active).map((promotion) => (
            <Card key={promotion.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">v{promotion.version_number}</h3>
                      {promotion.is_rolled_back ? (
                        <Badge variant="outline" className="bg-red-500/10 text-red-500">
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Rolled Back
                        </Badge>
                      ) : promotion.is_permanent ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-500">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Permanent
                        </Badge>
                      ) : (
                        <Badge variant="outline">Active</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {promotion.promotion_scope}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Promoted: {new Date(promotion.promoted_at).toLocaleString()}</span>
                      {promotion.is_rolled_back && promotion.rolled_back_at && (
                        <span className="text-red-500">
                          Rolled back: {new Date(promotion.rolled_back_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
