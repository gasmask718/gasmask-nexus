import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Shield,
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Phone,
  MessageSquare,
  Mail,
  FileText,
  Download,
  Clock,
  User,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface ComplianceLog {
  id: string;
  business_name?: string;
  contact_id?: string;
  channel_type: string;
  compliance_type: string;
  action: string;
  source?: string;
  evidence?: string;
  logged_at: string;
}

const COMPLIANCE_TYPES = [
  { value: "opt-in", label: "Opt-In", icon: CheckCircle, color: "text-green-500" },
  { value: "opt-out", label: "Opt-Out", icon: XCircle, color: "text-red-500" },
  { value: "recording-consent", label: "Recording Consent", icon: Phone, color: "text-blue-500" },
  { value: "dnd", label: "Do Not Disturb", icon: AlertTriangle, color: "text-orange-500" },
];

export function ComplianceCenter() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("logs");

  const { data: complianceLogs, isLoading } = useQuery({
    queryKey: ['compliance-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communication_compliance_logs')
        .select('*')
        .order('logged_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as ComplianceLog[];
    },
  });

  const { data: deliveryStatus } = useQuery({
    queryKey: ['delivery-status-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communication_delivery_status')
        .select('status, channel_type')
        .limit(1000);
      if (error) throw error;
      
      const summary = {
        total: data.length,
        delivered: data.filter(d => d.status === 'delivered').length,
        failed: data.filter(d => d.status === 'failed').length,
        bounced: data.filter(d => d.status === 'bounced').length,
        byChannel: {
          sms: data.filter(d => d.channel_type === 'sms').length,
          email: data.filter(d => d.channel_type === 'email').length,
          call: data.filter(d => d.channel_type === 'call').length,
        }
      };
      return summary;
    },
  });

  const stats = {
    optIns: complianceLogs?.filter(l => l.compliance_type === 'opt-in' && l.action === 'granted').length || 0,
    optOuts: complianceLogs?.filter(l => l.compliance_type === 'opt-out').length || 0,
    recordingConsents: complianceLogs?.filter(l => l.compliance_type === 'recording-consent' && l.action === 'granted').length || 0,
    dndRequests: complianceLogs?.filter(l => l.compliance_type === 'dnd').length || 0,
  };

  const filteredLogs = complianceLogs?.filter(log => 
    log.compliance_type.toLowerCase().includes(search.toLowerCase()) ||
    log.source?.toLowerCase().includes(search.toLowerCase())
  );

  const getComplianceIcon = (type: string) => {
    const config = COMPLIANCE_TYPES.find(t => t.value === type);
    return config || COMPLIANCE_TYPES[0];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Compliance Center
          </h2>
          <p className="text-muted-foreground">Manage opt-ins, consents, and delivery health</p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <div className="text-2xl font-bold">{stats.optIns}</div>
                <p className="text-xs text-muted-foreground">Active Opt-Ins</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <div>
                <div className="text-2xl font-bold">{stats.optOuts}</div>
                <p className="text-xs text-muted-foreground">Opt-Outs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">{stats.recordingConsents}</div>
                <p className="text-xs text-muted-foreground">Recording Consents</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <div>
                <div className="text-2xl font-bold">{stats.dndRequests}</div>
                <p className="text-xs text-muted-foreground">DND Requests</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="logs">Compliance Logs</TabsTrigger>
          <TabsTrigger value="delivery">Delivery Health</TabsTrigger>
          <TabsTrigger value="policies">Retention Policies</TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Compliance Activity Log</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search logs..."
                    className="pl-10"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {isLoading ? (
                  <p className="text-center text-muted-foreground py-8">Loading...</p>
                ) : filteredLogs?.length ? (
                  <div className="space-y-2">
                    {filteredLogs.map((log) => {
                      const config = getComplianceIcon(log.compliance_type);
                      const Icon = config.icon;
                      return (
                        <div
                          key={log.id}
                          className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50"
                        >
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center bg-muted",
                          )}>
                            <Icon className={cn("h-5 w-5", config.color)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium capitalize">
                                {log.compliance_type.replace('-', ' ')}
                              </span>
                              <Badge variant={log.action === 'granted' ? 'default' : 'secondary'}>
                                {log.action}
                              </Badge>
                              <Badge variant="outline" className="uppercase text-xs">
                                {log.channel_type}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Source: {log.source || 'Unknown'} • Contact: {log.contact_id?.slice(0, 8) || 'N/A'}
                            </p>
                          </div>
                          <div className="text-right text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(log.logged_at), 'MMM d, h:mm a')}
                            </div>
                            {log.business_name && (
                              <span className="text-xs">{log.business_name}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No compliance logs found</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="delivery" className="mt-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Delivery Overview</CardTitle>
                <CardDescription>Message delivery success rates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Total Sent</span>
                    <span className="font-bold">{deliveryStatus?.total || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Delivered
                    </span>
                    <span className="font-bold text-green-600">{deliveryStatus?.delivered || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      Failed
                    </span>
                    <span className="font-bold text-red-600">{deliveryStatus?.failed || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      Bounced
                    </span>
                    <span className="font-bold text-orange-600">{deliveryStatus?.bounced || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>By Channel</CardTitle>
                <CardDescription>Messages sent per channel</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-green-500" />
                      SMS
                    </span>
                    <span className="font-bold">{deliveryStatus?.byChannel.sms || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-purple-500" />
                      Email
                    </span>
                    <span className="font-bold">{deliveryStatus?.byChannel.email || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-blue-500" />
                      Call
                    </span>
                    <span className="font-bold">{deliveryStatus?.byChannel.call || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="policies" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Data Retention Policies</CardTitle>
              <CardDescription>Configure how long communication data is retained</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Call Recordings</h4>
                    <p className="text-sm text-muted-foreground">Retain call recordings for compliance</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm">90 days</span>
                    <Switch defaultChecked />
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Message Logs</h4>
                    <p className="text-sm text-muted-foreground">SMS and email message history</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm">1 year</span>
                    <Switch defaultChecked />
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Consent Records</h4>
                    <p className="text-sm text-muted-foreground">Opt-in and consent documentation</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm">5 years</span>
                    <Switch defaultChecked />
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Analytics Data</h4>
                    <p className="text-sm text-muted-foreground">Aggregated communication metrics</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm">2 years</span>
                    <Switch defaultChecked />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
