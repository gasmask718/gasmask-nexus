import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Settings, Key, User, Globe, ArrowLeft, Save, CheckCircle, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function FundingMachineSettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [postgridKey, setPostgridKey] = useState("");
  const [operatorPhone, setOperatorPhone] = useState("");
  const [operatorEmail, setOperatorEmail] = useState("");

  const { data: settings = [], isLoading } = useQuery({
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

  const isPostgridConfigured = !!getSetting("postgrid_api_key");

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
          <p className="text-muted-foreground">Configure API keys, operator preferences, and client portal</p>
        </div>
      </div>

      {/* API Keys */}
      <Card className="border-amber-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-amber-500" />
            API Keys
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>PostGrid API Key</Label>
              {isPostgridConfigured ? (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                  <CheckCircle className="h-3 w-3 mr-1" /> Configured
                </Badge>
              ) : (
                <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                  <XCircle className="h-3 w-3 mr-1" /> Not Configured
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder={isPostgridConfigured ? "••••••••••••" : "Enter PostGrid API key"}
                value={postgridKey}
                onChange={(e) => setPostgridKey(e.target.value)}
              />
              <Button
                onClick={() => saveMutation.mutate({ key: "postgrid_api_key", value: postgridKey })}
                disabled={!postgridKey}
                className="bg-gradient-to-r from-amber-600 to-yellow-500 text-black"
              >
                <Save className="h-4 w-4 mr-1" /> Save
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Sign up at <a href="https://postgrid.com" target="_blank" rel="noopener noreferrer" className="text-amber-400 underline">postgrid.com</a> to get your API key. Required for certified mail dispatch.
            </p>
          </div>
        </CardContent>
      </Card>

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
