import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { 
  FileText, Calendar, AlertTriangle, CheckCircle, 
  Clock, Target, Gift, Ban, ExternalLink
} from 'lucide-react';
import { format, differenceInDays, differenceInMonths } from 'date-fns';
import type { WholesalerContract } from '@/hooks/useWholesalerIntelligence';

interface WholesalerContractsProps {
  contracts: WholesalerContract[];
  profile: any;
}

export function WholesalerContractsSection({ contracts, profile }: WholesalerContractsProps) {
  const activeContracts = contracts.filter(c => c.status === 'active');
  const expiringContracts = contracts.filter(c => {
    if (!c.end_date) return false;
    const daysUntilExpiry = differenceInDays(new Date(c.end_date), new Date());
    return daysUntilExpiry > 0 && daysUntilExpiry <= 30;
  });

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'expiring': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'expired': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'terminated': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getContractTypeColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'exclusive': return 'bg-purple-500/20 text-purple-400';
      case 'performance': return 'bg-blue-500/20 text-blue-400';
      case 'trial': return 'bg-amber-500/20 text-amber-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-violet-500" />
            Contracts & Strategic Alignment
          </CardTitle>
          {expiringContracts.length > 0 && (
            <Badge variant="outline" className="text-amber-400 border-amber-500/30 animate-pulse">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {expiringContracts.length} Expiring Soon
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <FileText className="h-5 w-5 mx-auto text-violet-500 mb-1" />
            <p className="text-2xl font-bold">{contracts.length}</p>
            <p className="text-xs text-muted-foreground">Total Contracts</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <CheckCircle className="h-5 w-5 mx-auto text-green-500 mb-1" />
            <p className="text-2xl font-bold">{activeContracts.length}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <Clock className="h-5 w-5 mx-auto text-amber-500 mb-1" />
            <p className="text-2xl font-bold">{expiringContracts.length}</p>
            <p className="text-xs text-muted-foreground">Expiring Soon</p>
          </div>
        </div>

        {/* Profile Contract Info */}
        {(profile?.contract_start_date || profile?.growth_target_percentage) && (
          <div className="p-4 rounded-lg bg-violet-500/5 border border-violet-500/20">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Current Agreement</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {profile.contract_start_date && (
                <div>
                  <p className="text-xs text-muted-foreground">Start Date</p>
                  <p className="text-sm font-medium">
                    {format(new Date(profile.contract_start_date), 'MMM d, yyyy')}
                  </p>
                </div>
              )}
              {profile.contract_end_date && (
                <div>
                  <p className="text-xs text-muted-foreground">End Date</p>
                  <p className="text-sm font-medium">
                    {format(new Date(profile.contract_end_date), 'MMM d, yyyy')}
                  </p>
                </div>
              )}
              {profile.growth_target_percentage && (
                <div>
                  <p className="text-xs text-muted-foreground">Growth Target</p>
                  <p className="text-sm font-medium">{profile.growth_target_percentage}%</p>
                </div>
              )}
              {profile.contract_end_date && (
                <div>
                  <p className="text-xs text-muted-foreground">Time Remaining</p>
                  <p className="text-sm font-medium">
                    {Math.max(0, differenceInDays(new Date(profile.contract_end_date), new Date()))} days
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Contract List */}
        <ScrollArea className="h-48">
          <div className="space-y-3">
            {contracts.map((contract) => {
              const daysUntilExpiry = contract.end_date 
                ? differenceInDays(new Date(contract.end_date), new Date())
                : null;
              const isExpiring = daysUntilExpiry !== null && daysUntilExpiry > 0 && daysUntilExpiry <= 30;
              const contractDuration = contract.end_date
                ? differenceInMonths(new Date(contract.end_date), new Date(contract.start_date))
                : null;
              const elapsedMonths = differenceInMonths(new Date(), new Date(contract.start_date));
              const progressPercent = contractDuration && contractDuration > 0
                ? Math.min(100, (elapsedMonths / contractDuration) * 100)
                : 0;

              return (
                <div 
                  key={contract.id}
                  className={`p-4 rounded-lg border ${isExpiring ? 'bg-amber-500/5 border-amber-500/30' : 'bg-muted/30 border-border/50'}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">{contract.contract_name}</p>
                        <Badge className={getContractTypeColor(contract.contract_type)}>
                          {contract.contract_type}
                        </Badge>
                        <Badge className={getStatusColor(contract.status)}>
                          {contract.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(contract.start_date), 'MMM d, yyyy')}
                        </span>
                        {contract.end_date && (
                          <>
                            <span>→</span>
                            <span>{format(new Date(contract.end_date), 'MMM d, yyyy')}</span>
                          </>
                        )}
                        {contract.auto_renew && (
                          <Badge variant="outline" className="text-green-400 border-green-500/30">
                            Auto-renew
                          </Badge>
                        )}
                      </div>
                    </div>
                    {contract.document_url && (
                      <Button size="sm" variant="ghost" asChild>
                        <a href={contract.document_url} target="_blank" rel="noopener">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>

                  {/* Progress */}
                  {contractDuration && contractDuration > 0 && (
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Contract Progress</span>
                        <span>{progressPercent.toFixed(0)}%</span>
                      </div>
                      <Progress value={progressPercent} className="h-1.5" />
                    </div>
                  )}

                  {/* Contract Details */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    {contract.exclusivity_clauses && contract.exclusivity_clauses.length > 0 && (
                      <div className="flex items-center gap-1 text-purple-400">
                        <Ban className="h-3 w-3" />
                        {contract.exclusivity_clauses.length} exclusivity clauses
                      </div>
                    )}
                    {contract.growth_targets && Object.keys(contract.growth_targets).length > 0 && (
                      <div className="flex items-center gap-1 text-blue-400">
                        <Target className="h-3 w-3" />
                        Growth targets set
                      </div>
                    )}
                    {contract.incentive_structure && Object.keys(contract.incentive_structure).length > 0 && (
                      <div className="flex items-center gap-1 text-green-400">
                        <Gift className="h-3 w-3" />
                        Incentives active
                      </div>
                    )}
                    {contract.penalty_structure && Object.keys(contract.penalty_structure).length > 0 && (
                      <div className="flex items-center gap-1 text-red-400">
                        <AlertTriangle className="h-3 w-3" />
                        Penalties defined
                      </div>
                    )}
                  </div>

                  {/* Expiring Warning */}
                  {isExpiring && (
                    <div className="mt-3 pt-3 border-t border-amber-500/20 flex items-center gap-2 text-amber-400">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-sm">Expires in {daysUntilExpiry} days — schedule renewal review</span>
                    </div>
                  )}
                </div>
              );
            })}
            {contracts.length === 0 && (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No contracts on file</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
