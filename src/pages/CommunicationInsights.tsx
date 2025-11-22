import { useState } from "react";
import Layout from "@/components/Layout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  TrendingUp,
  Users,
  MessageSquare,
  Phone,
  Mail,
  Flame,
  Calendar,
  Target,
  BarChart3,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { BulkCommunicationLogModal } from "@/components/communication/BulkCommunicationLogModal";
import { CommunicationLogModal } from "@/components/CommunicationLogModal";

interface AtRiskEntity {
  id: string;
  name: string;
  type: "store" | "wholesaler" | "influencer";
  city: string;
  lastContactDate: string | null;
  daysSinceLastContact: number;
  riskLevel: "high" | "medium";
}

interface HotLead {
  id: string;
  name: string;
  type: "store" | "wholesaler" | "influencer";
  lastContactDate: string;
  commCount: number;
  mainChannel: string;
}

export default function CommunicationInsights() {
  const navigate = useNavigate();
  const [selectedEntity, setSelectedEntity] = useState<{ type: string; id: string; name: string } | null>(null);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkPrefilter, setBulkPrefilter] = useState<{
    entityType: "store" | "wholesaler" | "influencer";
    entityIds: string[];
  } | null>(null);

  // Fetch all communications (last 30 days)
  const { data: recentComms } = useQuery({
    queryKey: ["recent-communications-insights"],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from("communication_events")
        .select("*")
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch all entities
  const { data: stores } = useQuery({
    queryKey: ["stores-insights"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, address_city, address_state, status")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: wholesalers } = useQuery({
    queryKey: ["wholesalers-insights"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wholesale_hubs")
        .select("id, name, address_city, address_state, rating")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: influencers } = useQuery({
    queryKey: ["influencers-insights"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("influencers")
        .select("id, name, city, platform, followers")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Calculate Global KPIs
  const totalComms = recentComms?.length || 0;
  const last7Days = recentComms?.filter((c) => {
    const date = new Date(c.created_at);
    const now = new Date();
    return (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24) <= 7;
  })?.length || 0;

  const uniqueEntitiesContacted = new Set(
    recentComms?.map((c) => `${c.linked_entity_type}-${c.linked_entity_id}`)
  ).size;

  const totalEntities = (stores?.length || 0) + (wholesalers?.length || 0) + (influencers?.length || 0);

  // Calculate at-risk accounts
  const atRiskAccounts: AtRiskEntity[] = [];

  const calculateDaysSince = (entityType: string, entityId: string) => {
    const entityComms = recentComms?.filter(
      (c) => c.linked_entity_type === entityType && c.linked_entity_id === entityId
    );
    if (!entityComms || entityComms.length === 0) return 999;
    const lastComm = entityComms[0];
    const now = new Date();
    const lastDate = new Date(lastComm.created_at);
    return Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
  };

  stores?.forEach((store) => {
    const daysSince = calculateDaysSince("store", store.id);
    if (daysSince >= 14) {
      atRiskAccounts.push({
        id: store.id,
        name: store.name,
        type: "store",
        city: store.address_city || store.address_state || "Unknown",
        lastContactDate: null,
        daysSinceLastContact: daysSince,
        riskLevel: daysSince >= 30 ? "high" : "medium",
      });
    }
  });

  wholesalers?.forEach((hub) => {
    const daysSince = calculateDaysSince("wholesaler", hub.id);
    if (daysSince >= 14) {
      atRiskAccounts.push({
        id: hub.id,
        name: hub.name,
        type: "wholesaler",
        city: hub.address_city || hub.address_state || "Unknown",
        lastContactDate: null,
        daysSinceLastContact: daysSince,
        riskLevel: daysSince >= 30 ? "high" : "medium",
      });
    }
  });

  influencers?.forEach((inf) => {
    const daysSince = calculateDaysSince("influencer", inf.id);
    if (daysSince >= 14) {
      atRiskAccounts.push({
        id: inf.id,
        name: inf.name,
        type: "influencer",
        city: inf.city || "Unknown",
        lastContactDate: null,
        daysSinceLastContact: daysSince,
        riskLevel: daysSince >= 30 ? "high" : "medium",
      });
    }
  });

  atRiskAccounts.sort((a, b) => b.daysSinceLastContact - a.daysSinceLastContact);

  // Calculate hot leads (entities with >= 3 comms in last 7 days)
  const hotLeads: HotLead[] = [];
  const entityCommCounts = new Map<string, { count: number; channels: string[] }>();

  recentComms
    ?.filter((c) => {
      const date = new Date(c.created_at);
      const now = new Date();
      return (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24) <= 7;
    })
    .forEach((c) => {
      const key = `${c.linked_entity_type}-${c.linked_entity_id}`;
      if (!entityCommCounts.has(key)) {
        entityCommCounts.set(key, { count: 0, channels: [] });
      }
      const entry = entityCommCounts.get(key)!;
      entry.count++;
      if (c.channel) entry.channels.push(c.channel);
    });

  entityCommCounts.forEach((value, key) => {
    if (value.count >= 3) {
      const [type, id] = key.split("-");
      let entity: any = null;
      let entityName = "";

      if (type === "store") {
        entity = stores?.find((s) => s.id === id);
        entityName = entity?.name || "Unknown Store";
      } else if (type === "wholesaler") {
        entity = wholesalers?.find((w) => w.id === id);
        entityName = entity?.name || "Unknown Wholesaler";
      } else if (type === "influencer") {
        entity = influencers?.find((i) => i.id === id);
        entityName = entity?.name || "Unknown Influencer";
      }

      if (entity) {
        const mainChannel = value.channels.sort(
          (a, b) =>
            value.channels.filter((c) => c === b).length - value.channels.filter((c) => c === a).length
        )[0] || "sms";

        hotLeads.push({
          id,
          name: entityName,
          type: type as "store" | "wholesaler" | "influencer",
          lastContactDate: new Date().toISOString(),
          commCount: value.count,
          mainChannel,
        });
      }
    }
  });

  // Calculate channel effectiveness
  const channelBreakdown = recentComms?.reduce((acc: Record<string, number>, comm) => {
    const channel = comm.channel || "unknown";
    acc[channel] = (acc[channel] || 0) + 1;
    return acc;
  }, {}) || {};

  // Calculate health score
  const contactedLast14Days = new Set(
    recentComms
      ?.filter((c) => {
        const date = new Date(c.created_at);
        const now = new Date();
        return (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24) <= 14;
      })
      .map((c) => `${c.linked_entity_type}-${c.linked_entity_id}`)
  ).size;

  const coveragePercent = totalEntities > 0 ? (contactedLast14Days / totalEntities) * 100 : 0;
  const atRiskPercent = totalEntities > 0 ? (atRiskAccounts.length / totalEntities) * 100 : 0;

  let healthScore = 100;
  if (coveragePercent < 50) healthScore -= 30;
  else if (coveragePercent < 70) healthScore -= 15;
  if (atRiskPercent > 30) healthScore -= 25;
  else if (atRiskPercent > 15) healthScore -= 10;

  healthScore = Math.max(0, Math.min(100, healthScore));

  const healthColor = healthScore >= 70 ? "green" : healthScore >= 40 ? "yellow" : "red";
  const healthExplanation =
    coveragePercent < 50
      ? "Coverage is low. Many entities have not been contacted recently."
      : atRiskPercent > 30
      ? "Too many at-risk accounts. Increase outreach frequency."
      : "Coverage is strong. Maintain regular contact schedule.";

  // Smart filters
  const noContact30Days = atRiskAccounts.filter((a) => a.daysSinceLastContact >= 30);
  const newEntities14Days: AtRiskEntity[] = []; // Would need created_at field to calculate this

  const handleOpenBulkWithFilter = (filter: "noContact30" | "highRatingWholesalers") => {
    if (filter === "noContact30") {
      const storeIds = noContact30Days.filter((a) => a.type === "store").map((a) => a.id);
      setBulkPrefilter({ entityType: "store", entityIds: storeIds });
      setBulkModalOpen(true);
    } else if (filter === "highRatingWholesalers") {
      const highRatingIds =
        wholesalers
          ?.filter((w) => {
            const daysSince = calculateDaysSince("wholesaler", w.id);
            return (w.rating || 0) >= 4 && daysSince >= 14;
          })
          .map((w) => w.id) || [];
      setBulkPrefilter({ entityType: "wholesaler", entityIds: highRatingIds });
      setBulkModalOpen(true);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-primary" />
            Communication Insights
          </h1>
          <p className="text-muted-foreground">
            Global communication health, at-risk accounts, and outreach strategy
          </p>
        </div>

        {/* Global KPIs */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Communications</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalComms}</div>
              <p className="text-xs text-muted-foreground">Last 30 days ({last7Days} in 7d)</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Entities Contacted</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{uniqueEntitiesContacted}</div>
              <p className="text-xs text-muted-foreground">
                {Math.round(coveragePercent)}% coverage (14d)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">At-Risk Accounts</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{atRiskAccounts.length}</div>
              <p className="text-xs text-muted-foreground">No contact 14+ days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Health Score</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                {healthScore}
                <Badge variant={healthColor === "green" ? "default" : healthColor === "yellow" ? "secondary" : "destructive"}>
                  {healthColor.toUpperCase()}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{healthExplanation}</p>
            </CardContent>
          </Card>
        </div>

        {/* At-Risk Accounts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              At-Risk Accounts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all">
              <TabsList>
                <TabsTrigger value="all">All ({atRiskAccounts.length})</TabsTrigger>
                <TabsTrigger value="stores">
                  Stores ({atRiskAccounts.filter((a) => a.type === "store").length})
                </TabsTrigger>
                <TabsTrigger value="wholesalers">
                  Wholesalers ({atRiskAccounts.filter((a) => a.type === "wholesaler").length})
                </TabsTrigger>
                <TabsTrigger value="influencers">
                  Influencers ({atRiskAccounts.filter((a) => a.type === "influencer").length})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="all" className="space-y-2">
                {atRiskAccounts.slice(0, 10).map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{account.name}</span>
                        <Badge variant="outline" className="text-xs capitalize">
                          {account.type}
                        </Badge>
                        <Badge
                          variant={account.riskLevel === "high" ? "destructive" : "secondary"}
                          className="text-xs"
                        >
                          {account.riskLevel === "high" ? "HIGH RISK" : "MEDIUM RISK"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {account.city} • {account.daysSinceLastContact} days since contact
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setSelectedEntity({
                            type: account.type,
                            id: account.id,
                            name: account.name,
                          })
                        }
                      >
                        Quick Log
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => navigate(`/${account.type === "store" ? "stores" : account.type === "wholesaler" ? "wholesale" : "influencers"}/${account.id}`)}
                      >
                        Open Profile
                      </Button>
                    </div>
                  </div>
                ))}
              </TabsContent>
              <TabsContent value="stores" className="space-y-2">
                {atRiskAccounts
                  .filter((a) => a.type === "store")
                  .slice(0, 10)
                  .map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{account.name}</span>
                          <Badge
                            variant={account.riskLevel === "high" ? "destructive" : "secondary"}
                            className="text-xs"
                          >
                            {account.riskLevel === "high" ? "HIGH RISK" : "MEDIUM RISK"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {account.city} • {account.daysSinceLastContact} days since contact
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setSelectedEntity({
                              type: account.type,
                              id: account.id,
                              name: account.name,
                            })
                          }
                        >
                          Quick Log
                        </Button>
                        <Button size="sm" onClick={() => navigate(`/stores/${account.id}`)}>
                          Open Profile
                        </Button>
                      </div>
                    </div>
                  ))}
              </TabsContent>
              <TabsContent value="wholesalers" className="space-y-2">
                {atRiskAccounts
                  .filter((a) => a.type === "wholesaler")
                  .slice(0, 10)
                  .map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{account.name}</span>
                          <Badge
                            variant={account.riskLevel === "high" ? "destructive" : "secondary"}
                            className="text-xs"
                          >
                            {account.riskLevel === "high" ? "HIGH RISK" : "MEDIUM RISK"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {account.city} • {account.daysSinceLastContact} days since contact
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setSelectedEntity({
                              type: account.type,
                              id: account.id,
                              name: account.name,
                            })
                          }
                        >
                          Quick Log
                        </Button>
                        <Button size="sm" onClick={() => navigate(`/wholesale/${account.id}`)}>
                          Open Profile
                        </Button>
                      </div>
                    </div>
                  ))}
              </TabsContent>
              <TabsContent value="influencers" className="space-y-2">
                {atRiskAccounts
                  .filter((a) => a.type === "influencer")
                  .slice(0, 10)
                  .map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{account.name}</span>
                          <Badge
                            variant={account.riskLevel === "high" ? "destructive" : "secondary"}
                            className="text-xs"
                          >
                            {account.riskLevel === "high" ? "HIGH RISK" : "MEDIUM RISK"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {account.city} • {account.daysSinceLastContact} days since contact
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setSelectedEntity({
                              type: account.type,
                              id: account.id,
                              name: account.name,
                            })
                          }
                        >
                          Quick Log
                        </Button>
                        <Button size="sm" onClick={() => navigate(`/influencers/${account.id}`)}>
                          Open Profile
                        </Button>
                      </div>
                    </div>
                  ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Hot Leads */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              Hot Leads ({hotLeads.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {hotLeads.slice(0, 8).map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Flame className="h-4 w-4 text-orange-500" />
                      <span className="font-medium">{lead.name}</span>
                      <Badge variant="outline" className="text-xs capitalize">
                        {lead.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {lead.commCount} communications (7d) • Main channel: {lead.mainChannel}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => navigate(`/${lead.type === "store" ? "stores" : lead.type === "wholesaler" ? "wholesale" : "influencers"}/${lead.id}`)}
                  >
                    Open Profile
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Channel Effectiveness */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Channel Effectiveness (30d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(channelBreakdown)
                .sort((a, b) => b[1] - a[1])
                .map(([channel, count]) => (
                  <div key={channel} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {channel === "call" && <Phone className="h-4 w-4 text-muted-foreground" />}
                      {channel === "sms" && <MessageSquare className="h-4 w-4 text-muted-foreground" />}
                      {channel === "email" && <Mail className="h-4 w-4 text-muted-foreground" />}
                      <span className="capitalize font-medium">{channel}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-sm text-muted-foreground">{count} messages</div>
                      <Badge variant="secondary">{Math.round((count / totalComms) * 100)}%</Badge>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* Smart Bulk Targeting */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Smart Bulk Targeting
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-4 border rounded-lg flex items-center justify-between">
              <div>
                <div className="font-medium">No Contact in 30+ Days</div>
                <div className="text-sm text-muted-foreground">{noContact30Days.length} entities</div>
              </div>
              <Button size="sm" onClick={() => handleOpenBulkWithFilter("noContact30")}>
                Load into Bulk Log
              </Button>
            </div>

            <div className="p-4 border rounded-lg flex items-center justify-between">
              <div>
                <div className="font-medium">High-Rating Wholesalers (Low Contact)</div>
                <div className="text-sm text-muted-foreground">
                  {
                    wholesalers?.filter((w) => {
                      const daysSince = calculateDaysSince("wholesaler", w.id);
                      return (w.rating || 0) >= 4 && daysSince >= 14;
                    }).length
                  }{" "}
                  wholesalers
                </div>
              </div>
              <Button size="sm" onClick={() => handleOpenBulkWithFilter("highRatingWholesalers")}>
                Load into Bulk Log
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Weekly Outreach Plan */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Weekly Outreach Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {atRiskAccounts.slice(0, 15).map((account, idx) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{account.name}</span>
                      <Badge variant="outline" className="text-xs capitalize">
                        {account.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Suggested: {idx < 5 ? "Today" : idx < 10 ? "Tomorrow" : "This Week"} • Channel: SMS
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setSelectedEntity({ type: account.type, id: account.id, name: account.name })
                    }
                  >
                    Quick Log
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      {selectedEntity && (
        <CommunicationLogModal
          open={!!selectedEntity}
          onOpenChange={(open) => !open && setSelectedEntity(null)}
          entityType={selectedEntity.type as "store" | "wholesaler" | "influencer"}
          entityId={selectedEntity.id}
          entityName={selectedEntity.name}
        />
      )}

      <BulkCommunicationLogModal open={bulkModalOpen} onOpenChange={setBulkModalOpen} />
    </Layout>
  );
}
