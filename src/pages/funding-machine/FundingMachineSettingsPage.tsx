import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Key, User, Globe, ArrowLeft, Save, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DfsWeightsCard } from "@/components/funding-machine/DfsWeightsCard";

export default function FundingMachineSettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [operatorPhone, setOperatorPhone] = useState("");
  const [operatorEmail, setOperatorEmail] = useState("");

  const { data: settings = [] } = useQuery({
    queryKey: ["funding-machine-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funding_machine_settings")
        .select("*");
      if (error) throw error;
      return data || [];
    },
  });

  const getSetting = (key: string) => settings.find((s: any) => s.setting_key === key)?.setting_value || "";

  // The mail runtime reads POSTGRID_API_KEY from the edge-function environment,
  // never from the database. Ask the runtime itself rather than inferring state
  // from a settings row it does not consult.
  const {
    data: postgrid,
    isFetching: checkingPostgrid,
    refetch: recheckPostgrid,
  } = useQuery({
    queryKey: ["postgrid-health"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("funding-postgrid", {
        body: { ping: true },
      });
      if (error) throw error;
      return data as { configured: boolean; mode?: string; reason?: string };
    },
    retry: false,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { error } = await supabase
        .from("funding_machine_settings")
        .upsert({ setting_key: key, setting_value: value, updated_at: new Date().toISOString() }, { onConflict: "setting_key" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funding-machine-settings"] });
      toast.success("Setting saved");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate("/funding-machine")} size="icon">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Funding Machine Settings</h1>
          <p className="text-muted-foreground">Configure integrations, scoring weights, and client portal</p>
        </div>
      </div>

      {/* Integrations */}
      <Card className="border-amber-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-amber-500" />
            Integrations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>PostGrid — certified mail</Label>
              <div className="flex items-center gap-2">
                {postgrid?.configured ? (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Connected{postgrid.mode ? ` (${postgrid.mode})` : ""}
                  </Badge>
                ) : (
                  <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                    <XCircle className="h-3 w-3 mr-1" /> Not configured
                  </Badge>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => recheckPostgrid()}
                  disabled={checkingPostgrid}
                  aria-label="Re-check PostGrid connection"
                >
                  <RefreshCw className={`h-4 w-4 ${checkingPostgrid ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {postgrid?.configured
                ? "Dispute letters are mailed certified with return receipt, and tracking numbers are written back to the mailing log."
                : postgrid?.reason
                  ? `${postgrid.reason}. The API key is stored as a backend secret, not in this page — ask your developer to set POSTGRID_API_KEY.`
                  : "Checking connection…"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Fundability score weights */}
      <DfsWeightsCard />


      {/* Operator Settings */}
      <Card className="border-amber-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-amber-500" />
            Operator Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Operator Phone Number (Twilio SMS alerts)</Label>
            <div className="flex gap-2">
              <Input
                placeholder={getSetting("operator_phone") || "+1 (555) 000-0000"}
                value={operatorPhone}
                onChange={(e) => setOperatorPhone(e.target.value)}
              />
              <Button onClick={() => saveMutation.mutate({ key: "operator_phone", value: operatorPhone })} disabled={!operatorPhone} variant="outline">
                <Save className="h-4 w-4 mr-1" /> Save
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Operator Email</Label>
            <div className="flex gap-2">
              <Input
                placeholder={getSetting("operator_email") || "operator@domain.com"}
                value={operatorEmail}
                onChange={(e) => setOperatorEmail(e.target.value)}
              />
              <Button onClick={() => saveMutation.mutate({ key: "operator_email", value: operatorEmail })} disabled={!operatorEmail} variant="outline">
                <Save className="h-4 w-4 mr-1" /> Save
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Client Portal */}
      <Card className="border-amber-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-amber-500" />
            Client Portal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Portal URL</Label>
            <Input value={`${window.location.origin}/portal`} readOnly className="bg-muted/30" />
            <p className="text-xs text-muted-foreground">Share this URL with clients. They authenticate with their email via magic link.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
