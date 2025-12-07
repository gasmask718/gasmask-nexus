import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCommunicationIntelligence } from "@/hooks/useCommunicationIntelligence";
import { AlertTriangle, CheckCircle, Clock, Building2, Phone, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface EscalationsPanelProps {
  businessId?: string;
}

const DEPARTMENTS = ["Customer Service", "Sales", "Drivers", "Bikers", "Billing", "Management"];

export default function EscalationsPanel({ businessId }: EscalationsPanelProps) {
  const { escalations, escalationsLoading, resolveEscalation } = useCommunicationIntelligence(businessId);
  const [filter, setFilter] = useState<string>("all");

  const filteredEscalations = filter === "all" 
    ? escalations 
    : escalations.filter(e => e.severity === filter);

  const severityIcon = (severity: string) => {
    switch (severity) {
      case "critical": return <AlertTriangle className="text-red-500" size={16} />;
      case "high": return <AlertTriangle className="text-orange-500" size={16} />;
      case "medium": return <Clock className="text-yellow-500" size={16} />;
      default: return <Clock className="text-muted-foreground" size={16} />;
    }
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case "complaint": return <MessageSquare size={14} />;
      case "billing": return <Building2 size={14} />;
      case "delivery": return <Phone size={14} />;
      default: return <AlertTriangle size={14} />;
    }
  };

  if (escalationsLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading escalations...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="text-orange-500" size={20} />
          <h2 className="text-lg font-semibold">Active Escalations</h2>
          <Badge variant="secondary">{escalations.length}</Badge>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredEscalations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="mx-auto mb-4 text-green-500" size={48} />
            <p className="text-muted-foreground">No active escalations</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredEscalations.map((escalation) => (
            <Card key={escalation.id} className={cn(
              "border-l-4",
              escalation.severity === "critical" && "border-l-red-500",
              escalation.severity === "high" && "border-l-orange-500",
              escalation.severity === "medium" && "border-l-yellow-500",
              escalation.severity === "low" && "border-l-muted"
            )}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {severityIcon(escalation.severity)}
                    <CardTitle className="text-base">
                      {escalation.store?.store_name || "Unknown Store"}
                    </CardTitle>
                    <Badge variant="outline" className="gap-1">
                      {typeIcon(escalation.escalation_type)}
                      {escalation.escalation_type.replace("_", " ")}
                    </Badge>
                  </div>
                  <Badge className={cn(
                    escalation.severity === "critical" && "bg-red-500",
                    escalation.severity === "high" && "bg-orange-500",
                    escalation.severity === "medium" && "bg-yellow-500",
                    escalation.severity === "low" && "bg-muted text-muted-foreground"
                  )}>
                    {escalation.severity}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {escalation.ai_notes && (
                  <p className="text-sm text-muted-foreground mb-4">{escalation.ai_notes}</p>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Created: {new Date(escalation.created_at).toLocaleDateString()}</span>
                    {escalation.assigned_department && (
                      <Badge variant="secondary">{escalation.assigned_department}</Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Select defaultValue={escalation.assigned_department || ""}>
                      <SelectTrigger className="w-36 h-8 text-xs">
                        <SelectValue placeholder="Assign dept" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEPARTMENTS.map(dept => (
                          <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => resolveEscalation(escalation.id)}
                    >
                      <CheckCircle size={14} className="mr-1" />
                      Resolve
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
