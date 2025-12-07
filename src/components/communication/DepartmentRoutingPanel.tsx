import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCommunicationIntelligence } from "@/hooks/useCommunicationIntelligence";
import { Users, Truck, Bike, CreditCard, Building2, Phone, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface DepartmentRoutingPanelProps {
  businessId?: string;
}

const DEPARTMENTS = [
  { id: "Customer Service", icon: Phone, color: "text-blue-500" },
  { id: "Sales", icon: Users, color: "text-green-500" },
  { id: "Drivers", icon: Truck, color: "text-orange-500" },
  { id: "Bikers", icon: Bike, color: "text-purple-500" },
  { id: "Billing", icon: CreditCard, color: "text-yellow-500" },
  { id: "Management", icon: Building2, color: "text-red-500" },
];

export default function DepartmentRoutingPanel({ businessId }: DepartmentRoutingPanelProps) {
  const { routingAssignments, routingLoading } = useCommunicationIntelligence(businessId);

  const getDepartmentStats = () => {
    const stats: Record<string, number> = {};
    DEPARTMENTS.forEach(d => stats[d.id] = 0);
    routingAssignments.forEach(r => {
      if (stats[r.department] !== undefined) {
        stats[r.department]++;
      }
    });
    return stats;
  };

  const stats = getDepartmentStats();

  if (routingLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading routing data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Department Overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {DEPARTMENTS.map(dept => {
          const Icon = dept.icon;
          const count = stats[dept.id] || 0;
          return (
            <Card key={dept.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardContent className="pt-4 text-center">
                <Icon className={cn("mx-auto mb-2", dept.color)} size={24} />
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs text-muted-foreground">{dept.id}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Routing Decisions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRight size={20} />
            Recent Routing Decisions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {routingAssignments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No routing assignments yet</p>
          ) : (
            <div className="space-y-3">
              {routingAssignments.slice(0, 10).map((routing) => {
                const dept = DEPARTMENTS.find(d => d.id === routing.department);
                const Icon = dept?.icon || Users;
                return (
                  <div 
                    key={routing.id} 
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2 rounded-full bg-background", dept?.color)}>
                        <Icon size={16} />
                      </div>
                      <div>
                        <p className="font-medium">Store #{routing.store_id?.slice(0, 8)}</p>
                        {routing.reason && (
                          <p className="text-xs text-muted-foreground">{routing.reason}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{routing.department}</Badge>
                      <Select defaultValue={routing.department}>
                        <SelectTrigger className="w-32 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DEPARTMENTS.map(d => (
                            <SelectItem key={d.id} value={d.id}>{d.id}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Routing Rules */}
      <Card>
        <CardHeader>
          <CardTitle>AI Routing Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 p-2 rounded bg-muted/30">
              <Badge variant="outline">Billing</Badge>
              <span className="text-muted-foreground">→</span>
              <span>Keywords: payment, invoice, refund, charge</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-muted/30">
              <Badge variant="outline">Drivers</Badge>
              <span className="text-muted-foreground">→</span>
              <span>Keywords: delivery, driver, late, missing</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-muted/30">
              <Badge variant="outline">Sales</Badge>
              <span className="text-muted-foreground">→</span>
              <span>Keywords: new, order, product, pricing</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-muted/30">
              <Badge variant="outline">Management</Badge>
              <span className="text-muted-foreground">→</span>
              <span>Negative sentiment &lt; -50 or escalation</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
