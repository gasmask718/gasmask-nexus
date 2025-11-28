import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Phone, Mail, Search, Send, Clock, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { useSearchParams } from "react-router-dom";
import { GRABBA_BRANDS, getBrandConfig } from "@/config/grabbaBrands";

export default function GrabbaCommunication() {
  const [searchParams] = useSearchParams();
  const companyFilter = searchParams.get("company") || "";
  
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch communication logs with related data
  const { data: logs, isLoading } = useQuery({
    queryKey: ["grabba-communication-logs", brandFilter, channelFilter, companyFilter],
    queryFn: async () => {
      let query = supabase
        .from("communication_logs")
        .select(`
          *,
          companies (
            id, name, type, neighborhood, boro, default_phone, default_email
          ),
          stores (
            id, name, neighborhood, boro
          ),
          crm_contacts (
            id, first_name, last_name, phone, email
          ),
          grabba_drivers (
            id, name, phone
          ),
          wholesalers (
            id, name, contact_name, phone
          ),
          ambassadors (
            id, user_id, tracking_code
          )
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (channelFilter !== "all") {
        query = query.eq("channel", channelFilter);
      }

      const { data } = await query;
      return data || [];
    },
  });

  // Fetch companies for dropdown
  const { data: companies } = useQuery({
    queryKey: ["grabba-companies-list"],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("id, name").limit(100);
      return data || [];
    },
  });

  const getContactName = (log: any) => {
    if (log.companies?.name) return log.companies.name;
    if (log.stores?.name) return log.stores.name;
    if (log.crm_contacts) {
      const c = log.crm_contacts;
      return [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Unknown Contact';
    }
    if (log.grabba_drivers?.name) return log.grabba_drivers.name;
    if (log.wholesalers?.name) return log.wholesalers.name;
    if (log.ambassadors?.tracking_code) return `Ambassador: ${log.ambassadors.tracking_code}`;
    return log.contact_id || 'Unknown';
  };

  const filteredLogs = logs?.filter(log => {
    const contactName = getContactName(log);
    const matchesSearch = !searchQuery || 
      log.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contactName?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'sms': return <MessageSquare className="h-4 w-4" />;
      case 'call': return <Phone className="h-4 w-4" />;
      case 'email': return <Mail className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
        return <Badge className="bg-green-500/20 text-green-300 border-green-500/40"><CheckCircle className="h-3 w-3 mr-1" /> {status}</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/20 text-red-300 border-red-500/40"><XCircle className="h-3 w-3 mr-1" /> {status}</Badge>;
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" /> {status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <MessageSquare className="h-8 w-8 text-primary" />
            Grabba Communication Center
          </h1>
          <p className="text-muted-foreground mt-1">
            Text, call, and email center powered by AI – focused on Grabba accounts
          </p>
        </div>

        <Tabs defaultValue="logs" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="logs">Recent Communications</TabsTrigger>
            <TabsTrigger value="campaigns">Campaign Builder</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>

          <TabsContent value="logs" className="space-y-6">
            {/* Filters */}
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search messages..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  <Select value={brandFilter} onValueChange={setBrandFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by brand" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Brands</SelectItem>
                      {GRABBA_BRANDS.map(brand => (
                        <SelectItem key={brand} value={brand}>
                          {getBrandConfig(brand).label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={channelFilter} onValueChange={setChannelFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by channel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Channels</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="call">Call</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button className="gap-2">
                    <Send className="h-4 w-4" />
                    New Message
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Logs List */}
            <div className="grid gap-3">
              {isLoading ? (
                <Card className="p-8 text-center text-muted-foreground">Loading communications...</Card>
              ) : filteredLogs?.length === 0 ? (
                <Card className="p-8 text-center text-muted-foreground">No communications found</Card>
              ) : (
                filteredLogs?.map(log => (
                  <Card key={log.id} className="bg-card/50 backdrop-blur border-border/50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-lg ${log.direction === 'inbound' ? 'bg-blue-500/20' : 'bg-green-500/20'}`}>
                            {getChannelIcon(log.channel)}
                          </div>
                        <div>
                            <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">
                                {getContactName(log)}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {log.direction}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                              {log.summary || 'No summary'}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          {getStatusBadge(log.delivery_status || 'pending')}
                          <span className="text-sm text-muted-foreground">
                            {log.created_at ? format(new Date(log.created_at), "MMM d, h:mm a") : ''}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="campaigns">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle>Campaign Builder</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-foreground">Campaign Name</label>
                    <Input placeholder="e.g. Restock Reminder - December" className="mt-1" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Channel</label>
                    <Select>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select channel" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground">Template</label>
                  <Select>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select a template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="welcome">First Order Welcome</SelectItem>
                      <SelectItem value="restock">Restock Reminder</SelectItem>
                      <SelectItem value="payment">Payment Reminder</SelectItem>
                      <SelectItem value="new_flavor">New Flavor Notification</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground">Recipients</label>
                  <p className="text-sm text-muted-foreground">Upload CSV or select from CRM segment</p>
                  <div className="flex gap-4 mt-2">
                    <Button variant="outline">Upload CSV</Button>
                    <Button variant="outline">Select from CRM</Button>
                  </div>
                </div>

                <Button className="w-full gap-2">
                  <Send className="h-4 w-4" />
                  Preview & Send Campaign
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates">
            <div className="grid gap-4 md:grid-cols-2">
              {[
                { name: "First Order Welcome", desc: "Welcome new customers with onboarding info" },
                { name: "Restock Reminder", desc: "Remind stores when inventory is low" },
                { name: "Payment Reminder", desc: "Friendly payment reminders for outstanding balances" },
                { name: "New Flavor Notification", desc: "Announce new products and flavors" },
              ].map(template => (
                <Card key={template.name} className="bg-card/50 backdrop-blur border-border/50">
                  <CardContent className="p-4">
                    <h3 className="font-medium text-foreground">{template.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{template.desc}</p>
                    <Button variant="outline" size="sm" className="mt-3">Edit Template</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
