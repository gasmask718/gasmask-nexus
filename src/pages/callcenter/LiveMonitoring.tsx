import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, Users, Activity, Clock } from "lucide-react";
import CallCenterLayout from "./CallCenterLayout";

export default function LiveMonitoring() {
  // Placeholder data for live monitoring
  const activeCalls = [
    { id: 1, agent: "AI Agent - GasMask Support", caller: "+1 (555) 123-4567", duration: "2:34", status: "active" },
    { id: 2, agent: "AI Agent - Wholesale Closer", caller: "+1 (555) 987-6543", duration: "0:47", status: "active" },
    { id: 3, agent: "Human - Sarah Johnson", caller: "+1 (555) 456-7890", duration: "5:12", status: "escalated" },
  ];

  const agentStatus = [
    { name: "GasMask Support AI", status: "active", calls: 12, sentiment: 4.2 },
    { name: "Wholesale AI Closer", status: "active", calls: 8, sentiment: 4.5 },
    { name: "VIP Concierge AI", status: "idle", calls: 5, sentiment: 4.8 },
    { name: "Sarah Johnson (Human)", status: "busy", calls: 3, sentiment: 4.1 },
    { name: "Mike Chen (Human)", status: "available", calls: 7, sentiment: 4.3 },
  ];

  return (
    <CallCenterLayout title="Live Monitoring">
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Calls</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">3</div>
              <p className="text-xs text-muted-foreground">2 AI, 1 Human</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Agents Available</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">4</div>
              <p className="text-xs text-muted-foreground">3 AI, 1 Human</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Queue Length</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">7</div>
              <p className="text-xs text-muted-foreground">Avg wait: 1.2 min</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Handle Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">3:24</div>
              <p className="text-xs text-muted-foreground">Down 12% today</p>
            </CardContent>
          </Card>
        </div>

        {/* Active Calls */}
        <Card>
          <CardHeader>
            <CardTitle>Active Calls</CardTitle>
            <CardDescription>Real-time call monitoring</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeCalls.map((call) => (
                <div key={call.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">{call.agent}</p>
                    <p className="text-sm text-muted-foreground">{call.caller}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-medium">{call.duration}</p>
                      <p className="text-xs text-muted-foreground">Duration</p>
                    </div>
                    <Badge variant={call.status === "escalated" ? "destructive" : "default"}>
                      {call.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Agent Status */}
        <Card>
          <CardHeader>
            <CardTitle>Agent Status</CardTitle>
            <CardDescription>Current availability and performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {agentStatus.map((agent, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{agent.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {agent.calls} calls today · Avg sentiment: {agent.sentiment}/5.0
                    </p>
                  </div>
                  <Badge
                    variant={
                      agent.status === "active" || agent.status === "busy"
                        ? "default"
                        : agent.status === "available"
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {agent.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </CallCenterLayout>
  );
}
