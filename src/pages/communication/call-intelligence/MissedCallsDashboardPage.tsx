import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CommunicationHubLayout } from "../CommunicationHubLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, formatDistanceToNow } from "date-fns";
import {
  PhoneMissed,
  Phone,
  PhoneOff,
  Clock,
  User,
  Users,
  Search,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Voicemail,
  Wrench,
  ArrowRight,
} from "lucide-react";
import { useCurrentBusiness } from "@/hooks/useCurrentBusiness";
import { Link } from "react-router-dom";

interface CallOutcome {
  id: string;
  business_id: string | null;
  call_sid: string | null;
  direction: string;
  caller_number: string | null;
  called_number: string | null;
  outcome: string;
  outcome_reason: string | null;
  resolution_path: any[];
  users_attempted: string[];
  ring_duration_seconds: number | null;
  fallback_used: string | null;
  route_type: string | null;
  is_business_hours: boolean | null;
  local_time_at_call: string | null;
  timezone: string | null;
  suggested_fix: string | null;
  created_at: string;
}

export default function MissedCallsDashboardPage() {
  const { currentBusiness } = useCurrentBusiness();
  const [searchTerm, setSearchTerm] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<string>("missed");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Fetch call outcomes
  const { data: callOutcomes, isLoading, refetch } = useQuery({
    queryKey: ["call-outcomes", currentBusiness?.id, outcomeFilter],
    queryFn: async () => {
      let query = supabase
        .from("call_outcomes")
        .select("*")
        .order("created_at", { ascending: false });

      if (currentBusiness?.id) {
        query = query.eq("business_id", currentBusiness.id);
      }

      if (outcomeFilter !== "all") {
        query = query.eq("outcome", outcomeFilter);
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data as CallOutcome[];
    },
    enabled: !!currentBusiness?.id,
  });

  const filteredOutcomes = callOutcomes?.filter(co => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      co.caller_number?.toLowerCase().includes(search) ||
      co.outcome_reason?.toLowerCase().includes(search)
    );
  });

  const stats = {
    total: callOutcomes?.length || 0,
    missed: callOutcomes?.filter(c => c.outcome === "missed").length || 0,
    voicemail: callOutcomes?.filter(c => c.outcome === "voicemail").length || 0,
    connected: callOutcomes?.filter(c => c.outcome === "connected").length || 0,
    failed: callOutcomes?.filter(c => c.outcome === "failed").length || 0,
  };

  const getOutcomeIcon = (outcome: string) => {
    switch (outcome) {
      case "connected":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "missed":
        return <PhoneMissed className="h-4 w-4 text-red-600" />;
      case "voicemail":
        return <Voicemail className="h-4 w-4 text-amber-600" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Phone className="h-4 w-4" />;
    }
  };

  const getOutcomeBadge = (outcome: string) => {
    switch (outcome) {
      case "connected":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Connected</Badge>;
      case "missed":
        return <Badge variant="destructive">Missed</Badge>;
      case "voicemail":
        return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">Voicemail</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">{outcome}</Badge>;
    }
  };

  const getSuggestedFixLink = (reason: string | null, suggestedFix: string | null) => {
    if (!reason && !suggestedFix) return null;

    const reasonLower = (reason || "").toLowerCase();
    
    if (reasonLower.includes("no callable") || reasonLower.includes("no phone")) {
      return { path: "/communication-hub/call-settings/user-settings", label: "User Call Settings" };
    }
    if (reasonLower.includes("after hours") || reasonLower.includes("closed")) {
      return { path: "/communication-hub/call-settings/after-hours", label: "After-Hours Routing" };
    }
    if (reasonLower.includes("route") || reasonLower.includes("routing")) {
      return { path: "/communication-hub/call-settings/routes", label: "Inbound Routes" };
    }
    if (reasonLower.includes("business hours")) {
      return { path: "/communication-hub/call-settings/business-hours", label: "Business Hours" };
    }

    return null;
  };

  return (
    <CommunicationHubLayout title="Missed Calls Dashboard" subtitle="Understand why calls were missed and how to fix it">
      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <Phone className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total Calls</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.connected}</p>
                <p className="text-sm text-muted-foreground">Connected</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                <PhoneMissed className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.missed}</p>
                <p className="text-sm text-muted-foreground">Missed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/20 rounded-lg">
                <Voicemail className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.voicemail}</p>
                <p className="text-sm text-muted-foreground">Voicemail</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-destructive/10 rounded-lg">
                <XCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.failed}</p>
                <p className="text-sm text-muted-foreground">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by phone or reason..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
          <SelectTrigger className="w-40">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter outcome" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Outcomes</SelectItem>
            <SelectItem value="missed">Missed</SelectItem>
            <SelectItem value="voicemail">Voicemail</SelectItem>
            <SelectItem value="connected">Connected</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Call Outcomes List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PhoneMissed className="h-5 w-5" />
            Call Outcomes
          </CardTitle>
          <CardDescription>
            Detailed breakdown of every call and why it ended the way it did
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading call outcomes...</div>
          ) : !filteredOutcomes?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No call outcomes found</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {filteredOutcomes.map((co) => {
                  const fixLink = getSuggestedFixLink(co.outcome_reason, co.suggested_fix);
                  const isExpanded = expandedRow === co.id;

                  return (
                    <Collapsible
                      key={co.id}
                      open={isExpanded}
                      onOpenChange={() => setExpandedRow(isExpanded ? null : co.id)}
                    >
                      <div
                        className={`p-4 rounded-lg border transition-colors ${
                          co.outcome === "missed" || co.outcome === "failed"
                            ? "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800"
                            : co.outcome === "voicemail"
                            ? "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800"
                            : "bg-muted/50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="icon" className="shrink-0">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                            </CollapsibleTrigger>

                            {getOutcomeIcon(co.outcome)}

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{co.caller_number || "Unknown"}</span>
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                <span className="text-muted-foreground">{co.called_number}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {formatDistanceToNow(new Date(co.created_at), { addSuffix: true })}
                                {co.is_business_hours !== null && (
                                  <>
                                    <span>•</span>
                                    <Badge variant="outline" className="text-xs">
                                      {co.is_business_hours ? "Business Hours" : "After Hours"}
                                    </Badge>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            {getOutcomeBadge(co.outcome)}
                          </div>
                        </div>

                        <CollapsibleContent className="mt-4 pt-4 border-t">
                          <div className="grid grid-cols-2 gap-4">
                            {/* Left: Reason & Resolution Path */}
                            <div className="space-y-3">
                              <div>
                                <label className="text-xs text-muted-foreground uppercase tracking-wide">
                                  Reason
                                </label>
                                <p className="font-medium text-sm mt-1">
                                  {co.outcome_reason || "No specific reason recorded"}
                                </p>
                              </div>

                              {co.users_attempted && co.users_attempted.length > 0 && (
                                <div>
                                  <label className="text-xs text-muted-foreground uppercase tracking-wide">
                                    Users Attempted
                                  </label>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Users className="h-4 w-4" />
                                    <span className="text-sm">{co.users_attempted.length} user(s)</span>
                                  </div>
                                </div>
                              )}

                              {co.ring_duration_seconds && (
                                <div>
                                  <label className="text-xs text-muted-foreground uppercase tracking-wide">
                                    Ring Duration
                                  </label>
                                  <p className="text-sm mt-1">{co.ring_duration_seconds} seconds</p>
                                </div>
                              )}

                              {co.fallback_used && (
                                <div>
                                  <label className="text-xs text-muted-foreground uppercase tracking-wide">
                                    Fallback Used
                                  </label>
                                  <p className="text-sm mt-1">{co.fallback_used}</p>
                                </div>
                              )}
                            </div>

                            {/* Right: Suggested Fix */}
                            <div>
                              {(co.suggested_fix || fixLink) && (
                                <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                                  <div className="flex items-start gap-2">
                                    <Wrench className="h-4 w-4 text-primary mt-0.5" />
                                    <div>
                                      <p className="font-medium text-sm">Suggested Fix</p>
                                      <p className="text-sm text-muted-foreground mt-1">
                                        {co.suggested_fix || co.outcome_reason}
                                      </p>
                                      {fixLink && (
                                        <Button asChild variant="link" className="px-0 mt-2 h-auto">
                                          <Link to={fixLink.path}>
                                            Go to {fixLink.label}
                                            <ArrowRight className="h-3 w-3 ml-1" />
                                          </Link>
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {co.local_time_at_call && co.timezone && (
                                <div className="mt-3">
                                  <label className="text-xs text-muted-foreground uppercase tracking-wide">
                                    Local Time
                                  </label>
                                  <p className="text-sm mt-1">
                                    {co.local_time_at_call} ({co.timezone})
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Resolution Path */}
                          {co.resolution_path && co.resolution_path.length > 0 && (
                            <div className="mt-4 pt-4 border-t">
                              <label className="text-xs text-muted-foreground uppercase tracking-wide">
                                Resolution Path
                              </label>
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                {co.resolution_path.map((step: any, idx: number) => (
                                  <React.Fragment key={idx}>
                                    <Badge variant="outline" className="text-xs">
                                      {step.step || step}
                                    </Badge>
                                    {idx < co.resolution_path.length - 1 && (
                                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                    )}
                                  </React.Fragment>
                                ))}
                              </div>
                            </div>
                          )}
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </CommunicationHubLayout>
  );
}
