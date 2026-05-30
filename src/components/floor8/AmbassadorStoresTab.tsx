/**
 * Ambassador Profile - Stores Tab
 * Three distinct sections:
 * 1. Stores Sourced (attribution/credit - immutable)
 * 2. Stores Assigned (operational responsibility - can change)
 * 3. Store Intake Pipeline (lead flow)
 * 
 * Now includes:
 * - Visible store health rules
 * - Visit/follow-up cadence indicators
 * - Inline actions for operational accountability
 * - Ambassador-level alerts
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { 
  Store, Users, AlertTriangle, CheckCircle2, 
  TrendingUp, MapPin, Calendar, DollarSign,
  Clock, MessageSquare, Eye, ChevronRight, Info, Plus, UserPlus
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { 
  calculateStoreHealth, 
  generateAmbassadorAlerts,
  DEFAULT_VISIT_CADENCE,
  type HealthCalculationResult 
} from '@/lib/storeHealthRules';
import { StoreHealthIndicator, HealthRulesReference } from './StoreHealthIndicator';
import { AmbassadorAlertsPanel } from './AmbassadorAlertsPanel';
import { AssignedStoreActions } from './AssignedStoreActions';
import { AssignStoreToAmbassadorModal } from './AssignStoreToAmbassadorModal';
import { usePortalPermissions } from '@/hooks/usePortalPermission';

interface StoreData {
  id: string;
  store_name: string;
  city?: string;
  neighborhood?: string;
  status?: string;
  health_status?: string;
  sourced_at?: string;
  last_visit_at?: string;
  last_order_at?: string;
  created_at?: string;
}

interface SourcedStore {
  store: StoreData;
  sourcedAt: string;
  currentManager?: string;
  currentManagerId?: string;
  lifetimeRevenue: number;
  commissionEarned: number;
}

interface AssignedStore {
  store: StoreData;
  assignedAt: string;
  sourcedBy?: string;
  sourcedById?: string;
  lastVisit?: string;
  lastOrder?: string;
  healthStatus: 'healthy' | 'at_risk' | 'dormant';
}

interface PipelineStage {
  stage: string;
  label: string;
  count: number;
  stores: StoreData[];
}

interface AmbassadorStoresTabProps {
  ambassadorId: string;
  ambassadorName: string;
  sourcedStores: SourcedStore[];
  assignedStores: AssignedStore[];
  pipeline: PipelineStage[];
  onMessage?: (storeId: string) => void;
  onRefresh?: () => void;
}

const stageConfig: Record<string, { color: string; bgClass: string }> = {
  lead: { color: 'text-muted-foreground', bgClass: 'bg-muted' },
  contacted: { color: 'text-blue-400', bgClass: 'bg-blue-500/10' },
  interested: { color: 'text-amber-400', bgClass: 'bg-amber-500/10' },
  onboarded: { color: 'text-purple-400', bgClass: 'bg-purple-500/10' },
  active: { color: 'text-green-400', bgClass: 'bg-green-500/10' },
  dormant: { color: 'text-orange-400', bgClass: 'bg-orange-500/10' },
  lost: { color: 'text-red-400', bgClass: 'bg-red-500/10' },
};

const healthColors: Record<string, string> = {
  healthy: 'text-green-500 bg-green-500/10',
  at_risk: 'text-amber-500 bg-amber-500/10',
  dormant: 'text-red-500 bg-red-500/10',
};

export function AmbassadorStoresTab({
  ambassadorId,
  ambassadorName,
  sourcedStores,
  assignedStores,
  pipeline,
  onMessage,
  onRefresh,
}: AmbassadorStoresTabProps) {
  const navigate = useNavigate();
  const { can } = usePortalPermissions();
  const [showAssignModal, setShowAssignModal] = useState(false);
  
  // Only admins and VAs can assign stores
  const canAssignStores = can('admin_full_access') || can('assign_tasks');

  // Calculate health for each assigned store
  const assignedStoresWithHealth = useMemo(() => {
    return assignedStores.map(item => {
      const healthResult = calculateStoreHealth({
        lastVisitAt: item.lastVisit,
        lastOrderAt: item.lastOrder,
        expectedCadenceDays: DEFAULT_VISIT_CADENCE.daysInterval,
        healthStatusOverride: item.store.health_status,
      });
      return { ...item, healthResult };
    });
  }, [assignedStores]);

  // Generate alerts based on health calculations
  const alertSummary = useMemo(() => {
    return generateAmbassadorAlerts(
      assignedStoresWithHealth.map(item => ({
        store: item.store,
        healthResult: item.healthResult,
      }))
    );
  }, [assignedStoresWithHealth]);

  // Calculate summary stats
  const sourcedCount = sourcedStores.length;
  const assignedCount = assignedStores.length;
  const atRiskCount = assignedStoresWithHealth.filter(s => 
    s.healthResult.status === 'at_risk' || s.healthResult.status === 'dormant'
  ).length;
  const totalSourcedRevenue = sourcedStores.reduce((sum, s) => sum + s.lifetimeRevenue, 0);
  const totalCommissionEarned = sourcedStores.reduce((sum, s) => sum + s.commissionEarned, 0);

  // Count overdue visits
  const overdueVisitCount = assignedStoresWithHealth.filter(s => s.healthResult.visitOverdue).length;

  return (
    <div className="space-y-6">
      {/* Ambassador-Level Alerts */}
      {alertSummary.totalAlertCount > 0 && (
        <AmbassadorAlertsPanel
          alertSummary={alertSummary}
          onViewStore={(storeId) => navigate(`/stores/${storeId}`)}
          onAlertAction={(alert) => {
            // Navigate to store for action
            navigate(`/stores/${alert.storeId}`);
          }}
        />
      )}

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Stores Sourced</span>
            </div>
            <div className="text-2xl font-bold mt-1">{sourcedCount}</div>
            <div className="text-xs text-muted-foreground">Attribution credit</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-cyan-400" />
              <span className="text-sm text-muted-foreground">Stores Managed</span>
            </div>
            <div className="text-2xl font-bold mt-1">{assignedCount}</div>
            <div className="text-xs text-muted-foreground">
              {atRiskCount > 0 && <span className="text-amber-500">{atRiskCount} at risk</span>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-muted-foreground">Overdue Visits</span>
            </div>
            <div className={cn("text-2xl font-bold mt-1", overdueVisitCount > 0 && "text-amber-500")}>
              {overdueVisitCount}
            </div>
            <div className="text-xs text-muted-foreground">
              Cadence: {DEFAULT_VISIT_CADENCE.label}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Sourced Revenue</span>
            </div>
            <div className="text-2xl font-bold mt-1">${totalSourcedRevenue.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              <span className="text-sm text-muted-foreground">Commission Earned</span>
            </div>
            <div className="text-2xl font-bold mt-1">${totalCommissionEarned.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* SECTION 1: Stores Sourced */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Stores Sourced by {ambassadorName}
              </CardTitle>
              <CardDescription>
                Attribution credit — immutable record of stores brought into the ecosystem
              </CardDescription>
            </div>
            <Badge variant="outline">{sourcedCount} stores</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {sourcedStores.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Store className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No stores sourced yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Date Sourced</TableHead>
                  <TableHead>Current Manager</TableHead>
                  <TableHead>Lifetime Revenue</TableHead>
                  <TableHead>Commission Earned</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sourcedStores.map((item) => (
                  <TableRow
                    key={item.store.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/stores/${item.store.id}`)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Store className="h-4 w-4 text-primary" />
                        {item.store.store_name}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {[item.store.neighborhood, item.store.city].filter(Boolean).join(', ') || '—'}
                    </TableCell>
                    <TableCell>
                      {item.sourcedAt ? format(new Date(item.sourcedAt), 'MMM d, yyyy') : '—'}
                    </TableCell>
                    <TableCell>
                      {item.currentManagerId === ambassadorId ? (
                        <Badge variant="default" className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                          Self
                        </Badge>
                      ) : item.currentManager ? (
                        <span className="text-muted-foreground">{item.currentManager}</span>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell className="font-semibold">
                      ${item.lifetimeRevenue.toLocaleString()}
                    </TableCell>
                    <TableCell className="font-semibold text-green-500">
                      ${item.commissionEarned.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          healthColors[item.store.health_status || 'healthy'] || healthColors.healthy
                        )}
                      >
                        {item.store.health_status || item.store.status || 'active'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* SECTION 2: Stores Assigned (Operational Responsibility) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-cyan-400" />
                Stores Assigned to {ambassadorName}
              </CardTitle>
              <CardDescription className="flex items-center gap-2">
                Operational responsibility — current store management duties
                <Badge variant="outline" className="text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  {DEFAULT_VISIT_CADENCE.label} visit cadence
                </Badge>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {overdueVisitCount > 0 && (
                <Badge variant="outline" className="bg-amber-500/20 text-amber-500 border-amber-500/30">
                  <Clock className="h-3 w-3 mr-1" />
                  {overdueVisitCount} overdue
                </Badge>
              )}
              {atRiskCount > 0 && (
                <Badge variant="destructive" className="bg-red-500/20 text-red-400 border-red-500/30">
                  {atRiskCount} at risk
                </Badge>
              )}
              <Badge variant="outline">{assignedCount} stores</Badge>
              {canAssignStores && (
                <Button size="sm" onClick={() => setShowAssignModal(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Assign Store
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {assignedStoresWithHealth.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="mb-4">No stores currently assigned</p>
              {canAssignStores && (
                <Button onClick={() => setShowAssignModal(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Assign First Store
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store</TableHead>
                  <TableHead>Sourced By</TableHead>
                  <TableHead>Last Visit</TableHead>
                  <TableHead>Last Order</TableHead>
                  <TableHead>Health & SLA</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignedStoresWithHealth.map((item) => (
                  <TableRow 
                    key={item.store.id} 
                    className={cn(
                      "group",
                      item.healthResult.status === 'dormant' && "bg-red-500/5",
                      item.healthResult.status === 'at_risk' && "bg-amber-500/5"
                    )}
                  >
                    <TableCell className="font-medium">
                      <div
                        className="flex items-center gap-2 cursor-pointer hover:text-primary"
                        onClick={() => navigate(`/stores/${item.store.id}`)}
                      >
                        <Store className="h-4 w-4 text-cyan-400" />
                        {item.store.store_name}
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.sourcedById === ambassadorId ? (
                        <Badge variant="default" className="bg-primary/20 text-primary border-primary/30">
                          Self-Sourced
                        </Badge>
                      ) : item.sourcedBy ? (
                        <span className="text-muted-foreground">{item.sourcedBy}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {item.lastVisit ? (
                          <>
                            <span className="flex items-center gap-1 text-sm">
                              {format(new Date(item.lastVisit), 'MMM d, yyyy')}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(item.lastVisit), { addSuffix: true })}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">Never visited</span>
                        )}
                        {item.healthResult.visitOverdue && item.healthResult.visitOverdueDays > 0 && (
                          <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4 w-fit">
                            {item.healthResult.visitOverdueDays}d overdue
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {item.lastOrder ? (
                          <>
                            <span>{format(new Date(item.lastOrder), 'MMM d, yyyy')}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(item.lastOrder), { addSuffix: true })}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">No orders</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StoreHealthIndicator
                        healthResult={item.healthResult}
                        compact
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <AssignedStoreActions
                        storeId={item.store.id}
                        storeName={item.store.store_name}
                        ambassadorId={ambassadorId}
                        onViewStore={() => navigate(`/stores/${item.store.id}`)}
                        onMessage={onMessage ? () => onMessage(item.store.id) : undefined}
                        compact
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          
          {/* Health Rules Reference (Collapsible) */}
          <Collapsible className="mt-4">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                <Info className="h-3 w-3 mr-1" />
                View Health Rules
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <HealthRulesReference />
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* SECTION 3: Store Intake Pipeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5 text-amber-400" />
            Store Intake Pipeline (Sourcing Flow)
          </CardTitle>
          <CardDescription>
            Lead-to-active progression — tracks stores being onboarded by this ambassador
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Pipeline Stages */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {pipeline.map((stage) => {
              const config = stageConfig[stage.stage] || stageConfig.lead;
              return (
                <div
                  key={stage.stage}
                  className={cn(
                    'flex-shrink-0 p-3 rounded-lg border min-w-[120px]',
                    config.bgClass
                  )}
                >
                  <div className={cn('text-xs font-medium uppercase', config.color)}>
                    {stage.label}
                  </div>
                  <div className="text-2xl font-bold text-foreground mt-1">{stage.count}</div>
                </div>
              );
            })}
          </div>

          {/* Pipeline Details */}
          <div className="space-y-4">
            {pipeline.filter((s) => s.count > 0).map((stage) => {
              const config = stageConfig[stage.stage] || stageConfig.lead;
              return (
                <div key={stage.stage} className="border border-border/50 rounded-lg overflow-hidden">
                  <div className={cn('p-3 border-b border-border/50', config.bgClass)}>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={config.color}>
                        {stage.label}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {stage.count} {stage.count === 1 ? 'store' : 'stores'}
                      </span>
                    </div>
                  </div>
                  <div className="divide-y divide-border/50">
                    {stage.stores.slice(0, 5).map((store) => (
                      <div
                        key={store.id}
                        className="p-3 flex items-center justify-between hover:bg-muted/50 cursor-pointer"
                        onClick={() => navigate(`/stores/${store.id}`)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Store className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium">{store.store_name}</div>
                            <div className="text-sm text-muted-foreground">
                              {[store.neighborhood, store.city].filter(Boolean).join(', ') || '—'}
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    ))}
                    {stage.stores.length > 5 && (
                      <div className="p-3 text-center">
                        <Button variant="ghost" size="sm" className="text-xs">
                          View all {stage.stores.length} stores
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Assign Store Modal */}
      <AssignStoreToAmbassadorModal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        ambassadorId={ambassadorId}
        ambassadorName={ambassadorName}
        existingStoreIds={assignedStores.map(s => s.store.id)}
        onSuccess={onRefresh}
      />
    </div>
  );
}
