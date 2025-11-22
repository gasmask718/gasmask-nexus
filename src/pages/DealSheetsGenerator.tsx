import { useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Mail, MessageSquare, Share2, Download } from "lucide-react";

export default function DealSheetsGenerator() {
  const [leadId, setLeadId] = useState("");
  const [loading, setLoading] = useState(false);
  const [dealSheet, setDealSheet] = useState<any>(null);
  const { toast } = useToast();

  const generateDealSheet = async () => {
    if (!leadId) {
      toast({
        title: "Lead ID Required",
        description: "Please enter a lead ID to generate a deal sheet",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-deal-sheet-ai', {
        body: { lead_id: leadId }
      });

      if (error) throw error;

      setDealSheet(data);
      toast({
        title: "Deal Sheet Generated!",
        description: "Marketing materials have been created successfully",
      });
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

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold">Deal Sheets Generator</h1>
          <p className="text-muted-foreground">
            Create professional marketing materials for your wholesale deals
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Generate New Deal Sheet</CardTitle>
            <CardDescription>Enter a lead ID to create marketing materials</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Enter Lead ID"
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
            />
            <Button onClick={generateDealSheet} disabled={loading}>
              <FileText className="mr-2 h-4 w-4" />
              Generate Deal Sheet
            </Button>
          </CardContent>
        </Card>

        {dealSheet && (
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Email Template
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Subject:</h4>
                    <p className="text-sm">{dealSheet.marketing_preview?.email_subject}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Body:</h4>
                    <Textarea
                      value={dealSheet.marketing_preview?.email_body}
                      readOnly
                      rows={8}
                    />
                  </div>
                  <Button size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Copy Email
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  SMS Pitch
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={dealSheet.marketing_preview?.sms_pitch}
                  readOnly
                  rows={4}
                />
                <Button size="sm" className="mt-4">
                  <Download className="mr-2 h-4 w-4" />
                  Copy SMS
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="h-5 w-5" />
                  Social Media Post
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={dealSheet.marketing_preview?.social_post}
                  readOnly
                  rows={4}
                />
                <Button size="sm" className="mt-4">
                  <Download className="mr-2 h-4 w-4" />
                  Copy Post
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Executive Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={dealSheet.marketing_preview?.executive_summary}
                  readOnly
                  rows={8}
                />
                <Button size="sm" className="mt-4">
                  <Download className="mr-2 h-4 w-4" />
                  Generate PDF
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}