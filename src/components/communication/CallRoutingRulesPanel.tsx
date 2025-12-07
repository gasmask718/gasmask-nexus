import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Route, Plus, AlertTriangle, TrendingDown, DollarSign, Truck, Shield } from "lucide-react";
import { useVoiceOrchestration } from "@/hooks/useVoiceOrchestration";
import { useBusiness } from "@/contexts/BusinessContext";

const CONDITION_TYPES = [
  { value: "intent", label: "Intent", icon: Route },
  { value: "sentiment", label: "Sentiment", icon: AlertTriangle },
  { value: "churn_risk", label: "Churn Risk", icon: TrendingDown },
  { value: "opportunity_score", label: "Opportunity Score", icon: DollarSign },
  { value: "delivery_issue", label: "Delivery Issue", icon: Truck },
];

const AGENT_TYPES = [
  { value: "customer_service", label: "Customer Service AI" },
  { value: "sales", label: "Sales AI" },
  { value: "retention", label: "Retention AI" },
  { value: "billing", label: "Billing AI" },
  { value: "dispatcher", label: "Dispatcher AI" },
  { value: "supervisor", label: "Supervisor AI" },
];

export function CallRoutingRulesPanel() {
  const { currentBusiness } = useBusiness();
  const { routingRules, rulesLoading, createRoutingRule } = useVoiceOrchestration(currentBusiness?.id);
  const [isOpen, setIsOpen] = useState(false);
  const [newRule, setNewRule] = useState({
    name: "",
    conditionType: "",
    conditionValue: "",
    agents: [] as string[],
    priority: 0,
  });

  const handleCreateRule = async () => {
    if (!newRule.name || !newRule.conditionType) return;

    await createRoutingRule({
      business_id: currentBusiness?.id || null,
      name: newRule.name,
      description: null,
      condition: { [newRule.conditionType]: newRule.conditionValue },
      action: { routeTo: newRule.agents, maxAgents: newRule.agents.length },
      priority: newRule.priority,
      is_active: true,
    });

    setIsOpen(false);
    setNewRule({
      name: "",
      conditionType: "",
      conditionValue: "",
      agents: [],
      priority: 0,
    });
  };

  const getConditionIcon = (condition: Record<string, unknown>) => {
    const type = Object.keys(condition)[0];
    const found = CONDITION_TYPES.find((c) => c.value === type);
    return found ? <found.icon className="h-4 w-4" /> : <Route className="h-4 w-4" />;
  };

  const formatCondition = (condition: Record<string, unknown>) => {
    const entries = Object.entries(condition);
    if (entries.length === 0) return "Any";
    const [key, value] = entries[0];
    return `${key.replace("_", " ")}: ${value}`;
  };

  const formatAction = (action: Record<string, unknown>) => {
    const agents = (action.routeTo as string[]) || [];
    return agents.map((a) => a.replace("_", " ")).join(", ");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Route className="h-5 w-5" />
          Call Routing Rules
        </CardTitle>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Rule
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Routing Rule</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Rule Name</Label>
                <Input
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  placeholder="e.g., Route billing issues to Billing AI"
                />
              </div>

              <div>
                <Label>Condition Type</Label>
                <Select
                  value={newRule.conditionType}
                  onValueChange={(v) => setNewRule({ ...newRule, conditionType: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select condition" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className="h-4 w-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Condition Value</Label>
                <Input
                  value={newRule.conditionValue}
                  onChange={(e) => setNewRule({ ...newRule, conditionValue: e.target.value })}
                  placeholder="e.g., billing_issue, > 70, negative"
                />
              </div>

              <div>
                <Label>Route to Agents (select multiple)</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {AGENT_TYPES.map((agent) => (
                    <label
                      key={agent.value}
                      className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-muted"
                    >
                      <input
                        type="checkbox"
                        checked={newRule.agents.includes(agent.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewRule({ ...newRule, agents: [...newRule.agents, agent.value] });
                          } else {
                            setNewRule({
                              ...newRule,
                              agents: newRule.agents.filter((a) => a !== agent.value),
                            });
                          }
                        }}
                      />
                      <span className="text-sm">{agent.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label>Priority (higher = more important)</Label>
                <Input
                  type="number"
                  value={newRule.priority}
                  onChange={(e) => setNewRule({ ...newRule, priority: parseInt(e.target.value) || 0 })}
                />
              </div>

              <Button onClick={handleCreateRule} className="w-full">
                Create Rule
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {rulesLoading ? (
          <div className="text-center py-4 text-muted-foreground">Loading rules...</div>
        ) : routingRules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="h-8 w-8 mx-auto mb-2" />
            <p>No routing rules configured</p>
            <p className="text-sm">Create rules to automatically route calls to the right AI agents</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-3">
              {routingRules.map((rule) => (
                <div
                  key={rule.id}
                  className="p-3 border rounded-lg flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      {getConditionIcon(rule.condition)}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{rule.name}</p>
                      <p className="text-xs text-muted-foreground">
                        When: {formatCondition(rule.condition)} → Route to: {formatAction(rule.action)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Priority: {rule.priority}</Badge>
                    <Switch checked={rule.is_active} />
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
