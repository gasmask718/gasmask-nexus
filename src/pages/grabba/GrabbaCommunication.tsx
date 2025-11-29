import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MessageSquare, Phone, Mail, Search, Send, Clock, CheckCircle, XCircle, FileText, Plus } from "lucide-react";
import { format } from "date-fns";
import { useSearchParams, Link } from "react-router-dom";
import { GRABBA_BRAND_IDS, getBrandConfig, GRABBA_BRAND_CONFIG, type GrabbaBrand } from "@/config/grabbaSkyscraper";
import { useGrabbaBrand } from "@/contexts/GrabbaBrandContext";
import { BrandFilterBar } from "@/components/grabba/BrandFilterBar";
import { EntityModal, ExportButton } from "@/components/crud";
import { DeleteConfirmModal } from "@/components/crud/DeleteConfirmModal";
import { GlobalAddButton } from "@/components/crud/GlobalAddButton";
import { TableRowActions } from "@/components/crud/TableRowActions";
import { DataTablePagination } from "@/components/crud/DataTablePagination";
import { useCrudOperations } from "@/hooks/useCrudOperations";
import { communicationLogFields } from "@/config/entityFieldConfigs";

export default function GrabbaCommunication() {
  const [searchParams] = useSearchParams();
  const companyFilter = searchParams.get("company") || "";
  
  const { selectedBrand, setSelectedBrand, getBrandQuery } = useGrabbaBrand();
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<any>(null);
  const [deletingItem, setDeletingItem] = useState<{ id: string; name: string } | null>(null);

  // CRUD operations
  const logCrud = useCrudOperations({
    table: "communication_logs",
    queryKey: ["grabba-communication-logs"],
    successMessages: {
      create: "Communication logged",
      update: "Log updated",
      delete: "Log deleted"
    }
  });

  // Fetch communication logs
  const { data: logs, isLoading } = useQuery({
    queryKey: ["grabba-communication-logs", selectedBrand, channelFilter, companyFilter],
    queryFn: async () => {
      const brandsToQuery = getBrandQuery();
      const { data } = await supabase
        .from("communication_logs")
        .select("*")
        .in("brand", brandsToQuery)
        .order("created_at", { ascending: false })
        .limit(500);

      let result = (data || []) as any[];
      
      if (channelFilter !== "all") {
        result = result.filter(r => r.channel === channelFilter);
      }
      if (companyFilter) {
        result = result.filter(r => r.company_id === companyFilter);
      }

      return result;
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

  // Calculate stats
  const totalLogs = logs?.length || 0;
  const smsCount = logs?.filter(l => l.channel === 'sms').length || 0;
  const callCount = logs?.filter(l => l.channel === 'call').length || 0;
  const emailCount = logs?.filter(l => l.channel === 'email').length || 0;

  const filteredLogs = logs?.filter((log: any) => {
    const text = searchQuery?.toLowerCase() || "";
    if (!text) return true;

    const fields = [
      log.summary,
      log.full_message,
      log.message_content,
      log.channel,
      log.direction,
      log.brand,
      log.recipient_phone,
      log.recipient_email,
    ];

    return fields.some(f =>
      typeof f === "string" && f.toLowerCase().includes(text)
    );
  }) || [];

  const paginatedLogs = filteredLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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

  // Handlers
  const handleCreate = async (data: Record<string, any>) => {
    await logCrud.create({ ...data, brand: selectedBrand === 'all' ? 'grabba' : selectedBrand });
    setCreateModalOpen(false);
  };

  const handleUpdate = async (data: Record<string, any>) => {
    if (editingLog) {
      await logCrud.update({ id: editingLog.id, ...data });
      setEditingLog(null);
    }
  };

  const handleDelete = async () => {
    if (deletingItem) {
      await logCrud.remove(deletingItem.id);
      setDeletingItem(null);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <MessageSquare className="h-8 w-8 text-primary" />
              Grabba Communication Center
            </h1>
            <p className="text-muted-foreground mt-1">
              Floor 2 — Communications: All SMS, calls, email, and AI messaging for Grabba operations.
            </p>
          </div>
          <BrandFilterBar
            selectedBrand={selectedBrand}
            onBrandChange={setSelectedBrand}
            variant="compact"
          />
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-900/5 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-400">
                <MessageSquare className="h-4 w-4" />
                <span className="text-xs">Total Communications</span>
              </div>
              <div className="text-2xl font-bold text-foreground mt-1">{totalLogs}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-green-900/5 border-green-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-green-400">
                <MessageSquare className="h-4 w-4" />
                <span className="text-xs">SMS Messages</span>
              </div>
              <div className="text-2xl font-bold text-foreground mt-1">{smsCount}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-900/5 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-purple-400">
                <Phone className="h-4 w-4" />
                <span className="text-xs">Calls</span>
              </div>
              <div className="text-2xl font-bold text-foreground mt-1">{callCount}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-900/5 border-amber-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-amber-400">
                <Mail className="h-4 w-4" />
                <span className="text-xs">Emails</span>
              </div>
              <div className="text-2xl font-bold text-foreground mt-1">{emailCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Nav Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link to="/grabba/text-center">
            <Card className="bg-card/50 backdrop-blur border-border/50 hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/20">
                  <MessageSquare className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="font-medium">Text Center</p>
                  <p className="text-xs text-muted-foreground">Send SMS</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link to="/grabba/email-center">
            <Card className="bg-card/50 backdrop-blur border-border/50 hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <Mail className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="font-medium">Email Center</p>
                  <p className="text-xs text-muted-foreground">Send Emails</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link to="/grabba/call-center">
            <Card className="bg-card/50 backdrop-blur border-border/50 hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <Phone className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="font-medium">Call Center</p>
                  <p className="text-xs text-muted-foreground">Voice Calls</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link to="/grabba/communication-logs">
            <Card className="bg-card/50 backdrop-blur border-border/50 hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20">
                  <FileText className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="font-medium">All Logs</p>
                  <p className="text-xs text-muted-foreground">Full History</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        <Tabs defaultValue="logs" className="space-y-6">
          <div className="flex items-center justify-between">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="logs">Recent Communications</TabsTrigger>
              <TabsTrigger value="campaigns">Campaign Builder</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              <Select value={channelFilter} onValueChange={setChannelFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Channels</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => setCreateModalOpen(true)} size="sm" className="gap-2">
                <Plus className="h-4 w-4" /> Log Communication
              </Button>
            </div>
          </div>

          <TabsContent value="logs" className="space-y-6">
            {/* Filters */}
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search messages..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Logs Table */}
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle>Communication Logs</CardTitle>
                <CardDescription>{filteredLogs.length} total communications</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Channel</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead>Summary</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedLogs.map((log: any) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getChannelIcon(log.channel)}
                            <span className="capitalize">{log.channel}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{log.direction}</Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {log.summary || log.message_content || 'No summary'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.brand}</Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(log.delivery_status || 'pending')}</TableCell>
                        <TableCell>
                          {log.created_at ? format(new Date(log.created_at), "MMM d, h:mm a") : '-'}
                        </TableCell>
                        <TableCell>
                          <TableRowActions
                            actions={[
                              { type: 'view', onClick: () => setEditingLog(log) },
                              { type: 'delete', onClick: () => setDeletingItem({ id: log.id, name: log.summary || 'Communication' }) }
                            ]}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <DataTablePagination
                  currentPage={currentPage}
                  totalPages={Math.ceil(filteredLogs.length / pageSize)}
                  pageSize={pageSize}
                  totalItems={filteredLogs.length}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={setPageSize}
                />
              </CardContent>
            </Card>
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

      {/* Modals */}
      <EntityModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        title="Log Communication"
        fields={communicationLogFields}
        onSubmit={handleCreate}
        mode="create"
      />

      <EntityModal
        open={!!editingLog}
        onOpenChange={(open) => !open && setEditingLog(null)}
        title="View/Edit Communication"
        fields={communicationLogFields}
        defaultValues={editingLog || {}}
        onSubmit={handleUpdate}
        mode="edit"
      />

      <DeleteConfirmModal
        open={!!deletingItem}
        onOpenChange={(open) => !open && setDeletingItem(null)}
        title="Delete Communication Log"
        itemName={deletingItem?.name}
        onConfirm={handleDelete}
      />

      <GlobalAddButton
        label="Log Communication"
        onClick={() => setCreateModalOpen(true)}
        variant="floating"
      />
    </div>
  );
}
