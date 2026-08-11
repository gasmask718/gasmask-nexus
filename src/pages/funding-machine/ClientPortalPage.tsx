import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  TrendingUp, CheckCircle, Clock, Flame, Mail,
  FileText, ArrowRight, LogOut, Loader2
} from "lucide-react";
import DocumentVault from "@/components/funding-machine/DocumentVault";
import { FUNDING_CLIENT_SAFE_COLUMNS } from '@/lib/funding/pii';

const PIPELINE_PHASES = [
  "Infrastructure Setup",
  "Credit Repair",
  "Business Credit Building",
  "Card Stacking",
  "Loan Applications",
  "Funded",
];

export default function ClientPortalPage() {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [sendingLink, setSendingLink] = useState(false);
  const [linkSent, setLinkSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Canonical identity link: the server derives the funding client from the
  // verified JWT (user id / sign-in email). The browser never supplies an id.
  const { data: claimedClientId, isLoading: claiming } = useQuery({
    queryKey: ["portal-claim", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("claim_funding_portal_account" as any);
      if (error) throw error;
      return (data as string | null) ?? null;
    },
  });

  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ["portal-client", claimedClientId],
    enabled: !!claimedClientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funding_clients")
        .select(FUNDING_CLIENT_SAFE_COLUMNS)
        .eq("id", claimedClientId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Client-visible updates (internal staff notes are never exposed here)
  const { data: updates = [] } = useQuery({
    queryKey: ["portal-updates", client?.id],
    enabled: !!client?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_status_updates" as any)
        .select("*")
        .eq("client_id", client!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const { data: applications = [] } = useQuery({
    queryKey: ["portal-applications", client?.id],
    enabled: !!client?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funding_applications")
        .select("id,lender_name,product_type,requested_amount,approved_amount,status,application_date,updated_at")
        .eq("client_id", client!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: statusHistory = [] } = useQuery({
    queryKey: ["portal-status-history", client?.id],
    enabled: !!client?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funding_application_status_history" as any)
        .select("id,application_id,previous_status,new_status,client_display_status,message,created_at")
        .eq("client_id", client!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const { data: businessProfile } = useQuery({
    queryKey: ["portal-business", client?.id],
    enabled: !!client?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grant_business_profiles" as any)
        .select("id,business_name,entity_type,ein,business_address,business_city,business_state,industry,naics_code,annual_revenue,years_in_business")
        .eq("funding_client_id", client!.id)
        .maybeSingle();
      if (error) return null;
      return data as any;
    },
  });


  const { data: dfsScores = [] } = useQuery({
    queryKey: ["portal-dfs", client?.id],
    enabled: !!client?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("funding_dfs_scores").select("*").eq("client_id", client!.id).order("scored_at", { ascending: false }).limit(1);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: checklist = [] } = useQuery({
    queryKey: ["portal-checklist", client?.id],
    enabled: !!client?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("funding_infrastructure_checklist").select("*").eq("client_id", client!.id).order("step_order");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["portal-tasks", client?.id],
    enabled: !!client?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("funding_task_cards").select("*").eq("client_id", client!.id).eq("status", "pending").order("funding_impact_score", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const completeTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from("funding_task_cards").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-tasks", client?.id] });
      toast.success("Task completed!");
    },
  });

  const handleMagicLink = async () => {
    setSendingLink(true);
    try {
      // Check if client exists
      const { data: clientCheck } = await supabase.from("funding_clients").select("id").eq("email", email).maybeSingle();
      if (!clientCheck) {
        toast.error("No portal access found for this email. Contact your funding specialist.");
        setSendingLink(false);
        return;
      }
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/funding-machine/portal` },
      });
      if (error) throw error;
      setLinkSent(true);
      toast.success("Magic link sent! Check your email.");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSendingLink(false);
    }
  };

  const handlePortalSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    queryClient.clear();
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
    </div>
  );

  // Login Screen
  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-amber-500/20">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <Flame className="h-12 w-12 text-amber-500 mx-auto" />
            </div>
            <CardTitle className="text-2xl">Dynasty Funding Machine</CardTitle>
            <p className="text-muted-foreground">Enter your email to access your funding portal</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {linkSent ? (
              <div className="text-center py-6">
                <Mail className="h-12 w-12 text-amber-500 mx-auto mb-4" />
                <p className="font-medium">Check your email!</p>
                <p className="text-sm text-muted-foreground mt-2">We sent a magic link to <strong>{email}</strong>. Click the link to access your portal.</p>
                <Button variant="ghost" className="mt-4" onClick={() => setLinkSent(false)}>Try different email</Button>
              </div>
            ) : (
              <>
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleMagicLink()}
                />
                <Button
                  onClick={handleMagicLink}
                  disabled={!email || sendingLink}
                  className="w-full bg-gradient-to-r from-amber-600 to-yellow-500 text-black"
                >
                  {sendingLink ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Mail className="h-4 w-4 mr-1" />}
                  Send Magic Link
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // No client found
  if (clientLoading) return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
    </div>
  );

  if (!client) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-red-500/20">
        <CardContent className="py-12 text-center">
          <p className="font-medium">No funding account found for this email.</p>
          <p className="text-sm text-muted-foreground mt-2">Contact your funding specialist for access.</p>
          <Button variant="outline" className="mt-4" onClick={handlePortalSignOut}>Sign Out</Button>
        </CardContent>
      </Card>
    </div>
  );

  const latestDFS = dfsScores[0];
  const completedSteps = checklist.filter((s: any) => s.status === "completed").length;

  // Determine current phase
  const getCurrentPhase = () => {
    if (!client) return 0;
    const status = (client as any).pipeline_phase;
    const idx = PIPELINE_PHASES.findIndex(p => p.toLowerCase().replace(/\s+/g, "_") === status);
    return idx >= 0 ? idx : 0;
  };
  const currentPhase = getCurrentPhase();

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Portal Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Welcome, {client.first_name}</h1>
          <p className="text-muted-foreground">Your Dynasty Funding Machine Portal</p>
        </div>
        <Button variant="ghost" size="sm" onClick={handlePortalSignOut}>
          <LogOut className="h-4 w-4 mr-1" /> Sign Out
        </Button>
      </div>

      {/* DFS Score */}
      <Card className="border-amber-500/20 bg-gradient-to-br from-background to-amber-500/5">
        <CardContent className="p-6 text-center">
          <p className="text-sm text-muted-foreground mb-2">Dynasty Fundability Score</p>
          <div className="relative w-32 h-32 mx-auto mb-3">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              <circle cx="60" cy="60" r="50" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/20" />
              <circle cx="60" cy="60" r="50" fill="none" stroke="currentColor" strokeWidth="8" className="text-amber-500"
                strokeDasharray={`${(latestDFS?.total_score || 0) * 3.14} 314`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl font-bold text-amber-400">{latestDFS?.total_score || 0}</span>
            </div>
          </div>
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
            {PIPELINE_PHASES[currentPhase]}
          </Badge>
        </CardContent>
      </Card>

      {/* Infrastructure Checklist */}
      <Card className="border-amber-500/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-amber-500" />
            Infrastructure Checklist ({completedSteps}/{checklist.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {checklist.map((item: any) => (
            <div key={item.id} className={`flex items-center justify-between p-3 rounded-lg border ${item.status === "completed" ? "border-emerald-500/30 bg-emerald-500/5" : "border-border/30"}`}>
              <div className="flex items-center gap-3">
                {item.status === "completed" ? (
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Clock className="h-4 w-4 text-muted-foreground" />
                )}
                <span className={`text-sm ${item.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                  Step {item.step_order}: {item.step_label}
                </span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Pending Tasks */}
      <Card className="border-amber-500/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-amber-500" />
            Pending Tasks ({tasks.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No pending tasks. Great job!</p>
          ) : tasks.slice(0, 10).map((task: any) => (
            <Card key={task.id} className="border-border/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-sm">{task.title}</p>
                  <Badge variant="outline" className="text-xs">{task.category}</Badge>
                </div>
                {task.rationale && <p className="text-xs italic text-muted-foreground mb-2">{task.rationale}</p>}
                <Button size="sm" variant="outline" onClick={() => completeTask.mutate(task.id)} className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
                  <CheckCircle className="h-3 w-3 mr-1" /> Mark Complete
                </Button>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      {/* Document Upload */}
      <Card className="border-amber-500/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-amber-500" />
            Document Vault
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentVault clientId={client.id} />
        </CardContent>
      </Card>

      {/* Pipeline Timeline */}
      <Card className="border-amber-500/20">
        <CardHeader>
          <CardTitle className="text-lg">Funding Pipeline Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1">
            {PIPELINE_PHASES.map((phase, idx) => {
              const isActive = idx === currentPhase;
              const isComplete = idx < currentPhase;
              return (
                <div key={phase} className={`flex items-center gap-3 p-3 rounded-lg ${isActive ? "bg-amber-500/10 border border-amber-500/30" : isComplete ? "bg-emerald-500/5" : "bg-muted/10"}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isActive ? "bg-amber-500 text-black" : isComplete ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
                    {isComplete ? <CheckCircle className="h-4 w-4" /> : idx + 1}
                  </div>
                  <span className={`text-sm ${isActive ? "font-bold text-amber-400" : isComplete ? "text-emerald-400" : "text-muted-foreground"}`}>
                    {phase}
                  </span>
                  {isActive && <ArrowRight className="h-4 w-4 text-amber-500 ml-auto" />}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
