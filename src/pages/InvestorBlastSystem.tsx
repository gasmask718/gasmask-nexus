import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Send, Users, Eye, CheckCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function InvestorBlastSystem() {
  const [dealSheetId, setDealSheetId] = useState("");
  const [leadId, setLeadId] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchEmailLogs();
  }, []);

  const fetchEmailLogs = async () => {
    const { data } = await supabase
      .from("investor_email_logs")
      .select("*")
      .order("sent_at", { ascending: false })
      .limit(50);
    
    if (data) setEmailLogs(data);
  };

  const blastInvestors = async () => {
    if (!dealSheetId || !leadId) {
      toast({
        title: "Missing Information",
        description: "Please enter both Deal Sheet ID and Lead ID",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('blast-investors-ai', {
        body: { deal_sheet_id: dealSheetId, lead_id: leadId }
      });

      if (error) throw error;

      toast({
        title: "Investors Contacted!",
        description: `Deal sent to ${data.investors_contacted} matching investors`,
      });

      fetchEmailLogs();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (log: any) => {
    if (log.responded_at) {
      return <Badge className="bg-green-500"><CheckCircle className="mr-1 h-3 w-3" /> Responded</Badge>;
    }
    if (log.clicked_at) {
      return <Badge className="bg-blue-500"><Eye className="mr-1 h-3 w-3" /> Clicked</Badge>;
    }
    if (log.opened_at) {
      return <Badge className="bg-yellow-500"><Eye className="mr-1 h-3 w-3" /> Opened</Badge>;
    }
    return <Badge variant="outline">Sent</Badge>;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold">Investor Blast System</h1>
          <p className="text-muted-foreground">
            Distribute deals to thousands of investors automatically
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Send Deal to Investors</CardTitle>
            <CardDescription>Enter deal information to blast matching investors</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                placeholder="Deal Sheet ID"
                value={dealSheetId}
                onChange={(e) => setDealSheetId(e.target.value)}
              />
              <Input
                placeholder="Lead ID"
                value={leadId}
                onChange={(e) => setLeadId(e.target.value)}
              />
            </div>
            <Button onClick={blastInvestors} disabled={loading}>
              <Send className="mr-2 h-4 w-4" />
              Blast Investors
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Email Campaign Results
            </CardTitle>
            <CardDescription>Track investor engagement and responses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {emailLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{log.investor_email}</p>
                    <p className="text-sm text-muted-foreground">
                      Sent: {new Date(log.sent_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(log)}
                    {log.interest_level && (
                      <Badge variant="outline">{log.interest_level}</Badge>
                    )}
                  </div>
                </div>
              ))}

              {emailLogs.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No email campaigns yet. Send your first blast!
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}