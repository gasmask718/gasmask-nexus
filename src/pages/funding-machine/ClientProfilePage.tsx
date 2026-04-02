import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  User, Building2, Target, Shield, CreditCard, TrendingUp,
  CheckCircle, Clock, AlertTriangle, ArrowLeft, RefreshCw,
  ExternalLink, FileText, Send
} from "lucide-react";
import DocumentVault from "@/components/funding-machine/DocumentVault";
import ScoreSimulator from "@/components/funding-machine/ScoreSimulator";

const DFS_DIMENSIONS = [
  { key: 'personal_credit_tu', label: 'Personal Credit (TU)', max: 10 },
  { key: 'personal_credit_eq', label: 'Personal Credit (EQ)', max: 10 },
  { key: 'personal_credit_ex', label: 'Personal Credit (EX)', max: 10 },
  { key: 'business_credit_age', label: 'Business Credit Age', max: 8 },
  { key: 'tradeline_density', label: 'Tradeline Density', max: 8 },
  { key: 'derogatory_count', label: 'Derogatory Items', max: 10 },
  { key: 'utilization_ratio', label: 'Utilization Ratio', max: 8 },
  { key: 'public_records', label: 'Public Records', max: 6 },
  { key: 'inquiry_velocity', label: 'Inquiry Velocity', max: 6 },
  { key: 'entity_quality', label: 'Entity Structure', max: 8 },
  { key: 'ein_age', label: 'EIN Age', max: 6 },
  { key: 'banking_history', label: 'Banking History', max: 10 },
  { key: 'revenue_docs', label: 'Revenue Documentation', max: 5 },
  { key: 'industry_risk', label: 'Industry Risk Profile', max: 5 },
];

const INFRA_GUIDES: Record<string, { description: string; providers?: string[]; url?: string }> = {
  business_address: {
    description: 'Set up a virtual office or mailbox with a real street address. This address will be used on LLC, EIN, bank accounts, and all applications.',
    providers: ['iPostal1', 'Anytime Mailbox', 'Alliance Virtual Offices', 'Opus Virtual Offices', 'Regus'],
    url: 'https://www.ipostal1.com',
  },
  entity_formation: {
    description: 'Form an LLC or corporation in your target state. Use the business address from Step 1 on all formation documents.',
    providers: ['Northwest Registered Agents', 'IncFile', 'LegalZoom'],
  },
  ein_registration: {
    description: 'Apply for an EIN at irs.gov/businesses. Download the confirmation letter immediately and store it in your document vault.',
    url: 'https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online',
  },
  duns_number: {
    description: 'Register at dnb.com to establish your D&B file. Required for Tier 1 vendor tradelines. Allow 30 days for activation.',
    url: 'https://www.dnb.com/duns-number/get-a-duns.html',
  },
  business_banking: {
    description: 'Open Mercury or Relay as primary business checking. Fund with minimum $500 on day one. These banks are directly verified by Bluevine and Fundbox.',
    providers: ['Mercury', 'Relay', 'Novo'],
    url: 'https://mercury.com',
  },
  directory_411: {
    description: 'List your business phone in the 411 directory. Lenders verify this during underwriting.',
    url: 'https://www.listyourself.net',
  },
  website_email: {
    description: 'Set up a professional domain email and basic business website. Lenders Google every business during underwriting.',
    providers: ['Google Domains', 'Namecheap', 'Squarespace', 'Wix'],
  },
};

export default function ClientProfilePage() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: client, isLoading } = useQuery({
    queryKey: ['funding-client', clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from('funding_clients').select('*').eq('id', clientId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: dfsScores = [] } = useQuery({
    queryKey: ['funding-dfs', clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from('funding_dfs_scores').select('*').eq('client_id', clientId).order('scored_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: checklist = [] } = useQuery({
    queryKey: ['funding-checklist', clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from('funding_infrastructure_checklist').select('*').eq('client_id', clientId).order('step_order');
      if (error) throw error;
      return data || [];
    },
  });

  const toggleStep = useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: string }) => {
      const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
      const { error } = await supabase.from('funding_infrastructure_checklist').update({
        status: newStatus,
        completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funding-checklist', clientId] });
      toast.success('Step updated');
    },
  });

  const latestDFS = dfsScores[0];
  const completedSteps = checklist.filter(s => s.status === 'completed').length;

  if (isLoading) return (
    <div className="flex items-center justify-center h-screen">
      <RefreshCw className="h-8 w-8 animate-spin text-amber-500" />
    </div>
  );

  if (!client) return (
    <div className="p-6 text-center">
      <p className="text-muted-foreground">Client not found</p>
      <Button onClick={() => navigate('/funding-machine')} className="mt-4">Back to Dashboard</Button>
    </div>
  );

  const sendPortalInvite = async () => {
    if (!client?.email) { toast.error('Client email required'); return; }
    try {
      await supabase.from('funding_clients').update({ portal_invite_sent_at: new Date().toISOString() }).eq('id', clientId);
      toast.success(`Portal invite will be sent to ${client.email}`);
      queryClient.invalidateQueries({ queryKey: ['funding-client', clientId] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/funding-machine')} size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{client.first_name} {client.last_name}</h1>
            <p className="text-muted-foreground">{client.business_name || 'No business entity'} • {client.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={sendPortalInvite} className="border-amber-500/30 text-amber-400">
            <Send className="h-3 w-3 mr-1" /> Send Portal Invite
          </Button>
          <Badge variant="outline" className={
            client.status === 'active' ? 'border-emerald-500/30 text-emerald-500 text-lg px-4 py-1' :
            'border-amber-500/30 text-amber-500 text-lg px-4 py-1'
          }>
            {client.status}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">
            <FileText className="h-3 w-3 mr-1" /> Documents
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* DFS Score */}
          <Card className="border-amber-500/20 bg-gradient-to-br from-background to-amber-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-amber-500" />
                Dynasty Fundability Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-8 mb-6">
                <div className="text-center">
                  <div className="text-6xl font-bold text-amber-400">{latestDFS?.total_score || 0}</div>
                  <div className="text-sm text-muted-foreground">of 100</div>
                </div>
                <div className="flex-1 grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-sm text-muted-foreground">Current Ceiling</p>
                    <p className="text-xl font-bold text-amber-400">${Number(client.current_funding_ceiling || 0).toLocaleString()}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-sm text-muted-foreground">Projected Ceiling</p>
                    <p className="text-xl font-bold text-emerald-400">${Number(client.projected_funding_ceiling || 0).toLocaleString()}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-sm text-muted-foreground">Target Amount</p>
                    <p className="text-xl font-bold">${Number(client.target_funding_amount || 0).toLocaleString()}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-sm text-muted-foreground">Monthly Revenue</p>
                    <p className="text-xl font-bold">${Number(client.monthly_revenue || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Dimension Breakdown */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {DFS_DIMENSIONS.map(dim => {
                  const value = latestDFS ? (latestDFS as any)[dim.key] || 0 : 0;
                  const pct = (value / dim.max) * 100;
                  return (
                    <div key={dim.key} className="p-3 rounded-lg bg-muted/20">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">{dim.label}</span>
                        <span className="text-xs font-bold">{value}/{dim.max}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Score Simulator */}
          <ScoreSimulator clientId={clientId!} />

          {/* Infrastructure Checklist */}
          <Card className="border-amber-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-amber-500" />
                Business Infrastructure ({completedSteps}/{checklist.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {checklist.map((item) => {
                  const guide = INFRA_GUIDES[item.step_key];
                  const isComplete = item.status === 'completed';
                  return (
                    <div key={item.id} className={`p-4 rounded-lg border transition-all ${
                      isComplete ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border/50 bg-muted/10'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => toggleStep.mutate({ id: item.id, currentStatus: item.status })}
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                              isComplete ? 'border-emerald-500 bg-emerald-500' : 'border-muted-foreground hover:border-amber-500'
                            }`}
                          >
                            {isComplete && <CheckCircle className="h-4 w-4 text-white" />}
                          </button>
                          <div>
                            <p className={`font-medium ${isComplete ? 'line-through text-muted-foreground' : ''}`}>
                              Step {item.step_order}: {item.step_label}
                            </p>
                            {guide && !isComplete && (
                              <p className="text-sm text-muted-foreground mt-1">{guide.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {guide?.url && !isComplete && (
                            <a href={guide.url} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="sm">
                                <ExternalLink className="h-3 w-3 mr-1" /> Open
                              </Button>
                            </a>
                          )}
                          {isComplete && item.completed_at && (
                            <span className="text-xs text-muted-foreground">
                              {new Date(item.completed_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      {guide?.providers && !isComplete && (
                        <div className="mt-2 ml-9 flex gap-2 flex-wrap">
                          {guide.providers.map(p => (
                            <Badge key={p} variant="outline" className="text-xs border-amber-500/30 text-amber-400">{p}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Quick Action Buttons */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={() => navigate(`/funding-machine/credit-repair?client=${clientId}`)}>
              <Shield className="h-4 w-4 mr-2" /> Credit Repair
            </Button>
            <Button variant="outline" className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10" onClick={() => navigate(`/funding-machine/business-builder?client=${clientId}`)}>
              <Building2 className="h-4 w-4 mr-2" /> Business Builder
            </Button>
            <Button variant="outline" className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10" onClick={() => navigate(`/funding-machine/bureau-intel?client=${clientId}`)}>
              <CreditCard className="h-4 w-4 mr-2" /> Bureau Intel
            </Button>
            <Button variant="outline" className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10" onClick={() => navigate(`/funding-machine/funding-matrix?client=${clientId}`)}>
              <Target className="h-4 w-4 mr-2" /> Funding Matrix
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="documents">
          <DocumentVault clientId={clientId!} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
