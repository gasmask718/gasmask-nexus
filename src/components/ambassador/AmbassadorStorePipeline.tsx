import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Store, ChevronRight, Plus, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { AmbassadorPipelineStage, AmbassadorStore } from "@/hooks/useAmbassadorIntelligence";

interface AmbassadorStorePipelineProps {
  pipeline: AmbassadorPipelineStage[];
  onAddStore?: () => void;
  onStoreClick?: (storeId: string) => void;
}

export function AmbassadorStorePipeline({ 
  pipeline, 
  onAddStore,
  onStoreClick 
}: AmbassadorStorePipelineProps) {
  const navigate = useNavigate();
  
  const stageConfig: Record<string, { color: string; label: string; description: string }> = {
    lead: { color: 'gray', label: 'Lead', description: 'New potential stores' },
    contacted: { color: 'blue', label: 'Contacted', description: 'Initial outreach made' },
    interested: { color: 'amber', label: 'Interested', description: 'Showing interest' },
    onboarded: { color: 'purple', label: 'Onboarded', description: 'Setup complete' },
    active: { color: 'green', label: 'Active', description: 'Actively ordering' },
    dormant: { color: 'orange', label: 'Dormant', description: 'No recent activity' },
    lost: { color: 'red', label: 'Lost', description: 'No longer a customer' },
  };

  const totalStores = pipeline.reduce((sum, stage) => sum + stage.count, 0);
  const activeStores = pipeline.find(s => s.stage === 'active')?.count || 0;
  const atRiskStores = (pipeline.find(s => s.stage === 'dormant')?.count || 0) + 
                       (pipeline.find(s => s.stage === 'lost')?.count || 0);

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5 text-cyan-400" />
            Store Pipeline
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {totalStores} total stores • {activeStores} active • {atRiskStores} at risk
          </p>
        </div>
        <Button size="sm" onClick={onAddStore} className="gap-2">
          <Plus className="h-4 w-4" /> Add Store
        </Button>
      </CardHeader>
      <CardContent>
        {/* Pipeline Funnel View */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {pipeline.map((stage) => {
            const config = stageConfig[stage.stage] || { 
              color: 'gray', 
              label: stage.stage, 
              description: '' 
            };
            const widthPercent = totalStores > 0 
              ? Math.max(10, (stage.count / totalStores) * 100) 
              : 10;
            
            return (
              <div
                key={stage.stage}
                className={`flex-shrink-0 p-3 rounded-lg border cursor-pointer hover:border-${config.color}-500/50 transition-colors`}
                style={{ 
                  minWidth: '120px',
                  backgroundColor: `hsl(var(--${config.color}-500) / 0.1)`,
                  borderColor: `hsl(var(--${config.color}-500) / 0.2)`,
                }}
              >
                <div className={`text-xs text-${config.color}-400 font-medium uppercase`}>
                  {config.label}
                </div>
                <div className="text-2xl font-bold text-foreground mt-1">
                  {stage.count}
                </div>
                <div className="text-xs text-muted-foreground">
                  {config.description}
                </div>
              </div>
            );
          })}
        </div>

        {/* Stage Details */}
        <div className="space-y-4">
          {pipeline.filter(s => s.count > 0).map((stage) => {
            const config = stageConfig[stage.stage] || { 
              color: 'gray', 
              label: stage.stage, 
              description: '' 
            };
            
            return (
              <div key={stage.stage} className="border border-border/50 rounded-lg overflow-hidden">
                <div 
                  className={`p-3 bg-${config.color}-500/10 border-b border-border/50 flex items-center justify-between`}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-${config.color}-400 border-${config.color}-500/30`}>
                      {config.label}
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
                      className="p-3 flex items-center justify-between hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => onStoreClick?.(store.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-cyan-500/10">
                          <Store className="h-4 w-4 text-cyan-400" />
                        </div>
                        <div>
                          <div className="font-medium">{store.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {store.commissionRate}% commission • Since {new Date(store.assignmentDate).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ))}
                  
                  {stage.stores.length > 5 && (
                    <div className="p-3 text-center text-sm text-muted-foreground">
                      +{stage.stores.length - 5} more stores
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {pipeline.every(s => s.count === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No stores in pipeline yet</p>
              <Button variant="outline" className="mt-4" onClick={onAddStore}>
                <Plus className="h-4 w-4 mr-2" /> Add First Store
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
