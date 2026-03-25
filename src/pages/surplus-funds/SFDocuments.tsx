import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileCheck, Send, Eye, Download, CheckCircle, AlertCircle } from 'lucide-react';

export default function SFDocuments() {
  const { data: cases = [] } = useQuery({
    queryKey: ['sf-doc-cases'],
    queryFn: async () => {
      const { data } = await supabase
        .from('surplus_funds_cases')
        .select('id, client_name, property_address, state, status, created_at')
        .order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  const templates = [
    {
      name: 'Contingency Agreement',
      description: 'Client authorizes Dynasty Surplus Recovery to pursue recovery of surplus funds. Includes fee percentage and authorization clauses.',
      status: 'setup_needed' as const,
    },
    {
      name: 'Client Authorization Letter',
      description: 'Authorizes you to act as the client\'s recovery agent with courts and trustees.',
      status: 'setup_needed' as const,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-amber-500">📄 Floor 5 — Documents & Contracts</h1>
        <p className="text-sm text-muted-foreground">DocuSign integration center for surplus funds agreements</p>
      </div>

      {/* DocuSign Status */}
      <Card className="border-amber-500/20">
        <CardContent className="pt-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            <div>
              <p className="font-medium">DocuSign Integration</p>
              <p className="text-sm text-muted-foreground">Configure DocuSign API keys to enable automated contract sending</p>
            </div>
          </div>
          <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500">Setup Needed</Badge>
        </CardContent>
      </Card>

      {/* Templates */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Contract Templates</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {templates.map(t => (
            <Card key={t.name} className="border-amber-500/20">
              <CardHeader>
                <CardTitle className="text-sm flex items-center justify-between">
                  {t.name}
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500 text-xs">
                    Setup Needed
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">{t.description}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled><Send className="h-3 w-3 mr-1" />Test Send</Button>
                  <Button size="sm" variant="outline" disabled><Eye className="h-3 w-3 mr-1" />View</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Contingency Agreement Preview */}
      <Card className="border-amber-500/20">
        <CardHeader><CardTitle className="text-sm">Contingency Agreement Template Preview</CardTitle></CardHeader>
        <CardContent>
          <div className="bg-muted/30 rounded-lg p-4 text-sm space-y-3 font-mono">
            <p className="font-bold text-center">CONTINGENCY AGREEMENT</p>
            <p>This Contingency Agreement is entered into between <span className="text-amber-500">[CLIENT_NAME]</span> ("Client") and Dynasty Surplus Recovery LLC ("Recovery Agent") on <span className="text-amber-500">[DATE]</span>.</p>
            <p>Client authorizes Recovery Agent to pursue recovery of surplus funds in the amount of approximately $<span className="text-amber-500">[SURPLUS_AMOUNT]</span> arising from the foreclosure sale of <span className="text-amber-500">[PROPERTY_ADDRESS]</span>, <span className="text-amber-500">[COUNTY]</span> County, <span className="text-amber-500">[STATE]</span>, Court Case #<span className="text-amber-500">[CASE_NUMBER]</span>.</p>
            <p><strong>COMPENSATION:</strong> Client agrees to pay Recovery Agent <span className="text-amber-500">[FEE_PCT]</span>% of all funds recovered as compensation. No fee is owed unless funds are successfully recovered.</p>
            <p><strong>AUTHORIZATION:</strong> Client authorizes Recovery Agent to work with licensed counsel to file all necessary court documents, communicate with trustees and court clerks, and take all actions necessary to recover the surplus funds.</p>
          </div>
        </CardContent>
      </Card>

      {/* Sent Documents */}
      <Card className="border-amber-500/20">
        <CardHeader><CardTitle className="text-sm">Sent Documents</CardTitle></CardHeader>
        <CardContent>
          {cases.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No documents sent yet. Create cases from qualified leads to start sending agreements.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-3 text-left">Client</th>
                  <th className="p-3 text-left">Document</th>
                  <th className="p-3 text-left">Sent</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {cases.slice(0, 10).map((c: any) => (
                  <tr key={c.id} className="border-b border-border/50 hover:bg-accent/30">
                    <td className="p-3 font-medium">{c.client_name}</td>
                    <td className="p-3 text-muted-foreground">Contingency Agreement</td>
                    <td className="p-3 text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</td>
                    <td className="p-3">
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500 text-xs">Pending Setup</Badge>
                    </td>
                    <td className="p-3">
                      <Button size="sm" variant="ghost" disabled><Download className="h-3 w-3" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
