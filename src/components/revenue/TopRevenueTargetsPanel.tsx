import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Flame, AlertTriangle, Phone, MessageSquare, UserCheck, RefreshCw, Target } from "lucide-react";
import { useTopRevenueTargets, useRevenueEngineActions } from "@/hooks/useRevenueEngine";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

interface TopRevenueTargetsPanelProps {
  businessId?: string;
  verticalId?: string;
  limit?: number;
}

export function TopRevenueTargetsPanel({ businessId, verticalId, limit = 20 }: TopRevenueTargetsPanelProps) {
  const navigate = useNavigate();
  const { data: targets, isLoading } = useTopRevenueTargets(businessId, verticalId, limit);
  const { scoreAllStores, generateRecommendations, isLoading: actionsLoading } = useRevenueEngineActions();

  const getHeatColor = (heat: number) => {
    if (heat >= 80) return 'text-red-500';
    if (heat >= 60) return 'text-orange-500';
    if (heat >= 40) return 'text-yellow-500';
    return 'text-muted-foreground';
  };

  const getChurnBadge = (risk: number) => {
    if (risk >= 70) return <Badge variant="destructive">High Risk</Badge>;
    if (risk >= 50) return <Badge className="bg-orange-500">Medium</Badge>;
    return <Badge variant="secondary">Low</Badge>;
  };

  const handleRunEngine = async () => {
    await scoreAllStores.mutateAsync({ businessId, verticalId });
    await generateRecommendations.mutateAsync({ businessId, verticalId });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Top Priority Stores
        </CardTitle>
        <Button 
          variant="outline" 
          size="sm"
          onClick={handleRunEngine}
          disabled={actionsLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${actionsLoading ? 'animate-spin' : ''}`} />
          Run Engine
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : targets && targets.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Store</TableHead>
                <TableHead>Heat</TableHead>
                <TableHead>Churn Risk</TableHead>
                <TableHead>Last Order</TableHead>
                <TableHead>Predicted Next</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {targets.map((target: any) => (
                <TableRow 
                  key={target.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/stores/${target.store_id}`)}
                >
                  <TableCell>
                    <div>
                      <div className="font-medium">{target.store_master?.name || 'Unknown'}</div>
                      <div className="text-xs text-muted-foreground">
                        {target.store_master?.city}, {target.store_master?.state}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Flame className={`h-4 w-4 ${getHeatColor(target.heat_score || 0)}`} />
                      <span className={`font-bold ${getHeatColor(target.heat_score || 0)}`}>
                        {Math.round(target.heat_score || 0)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className={`h-4 w-4 ${target.churn_risk >= 70 ? 'text-red-500' : 'text-muted-foreground'}`} />
                      {getChurnBadge(target.churn_risk || 0)}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {target.last_order_at ? format(new Date(target.last_order_at), 'MMM d') : '-'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {target.predicted_next_order_at ? format(new Date(target.predicted_next_order_at), 'MMM d') : '-'}
                  </TableCell>
                  <TableCell>
                    {target.heat_score >= 80 ? (
                      <Phone className="h-4 w-4 text-green-500" />
                    ) : target.churn_risk >= 70 ? (
                      <UserCheck className="h-4 w-4 text-red-500" />
                    ) : (
                      <MessageSquare className="h-4 w-4 text-blue-500" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">No revenue data yet.</p>
            <Button onClick={handleRunEngine} disabled={actionsLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${actionsLoading ? 'animate-spin' : ''}`} />
              Run Revenue Engine
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
