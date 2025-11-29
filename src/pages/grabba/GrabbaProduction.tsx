import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { 
  Factory, Box, Wrench, AlertTriangle, Plus, CheckCircle, Building2,
  TrendingUp, Calendar, Search, Zap, BarChart3, Clock
} from "lucide-react";
import { format, startOfWeek, endOfWeek, subWeeks } from "date-fns";
import { GRABBA_BRAND_IDS, getBrandConfig, type GrabbaBrand, GRABBA_BRAND_CONFIG } from "@/config/grabbaSkyscraper";
import { useGrabbaBrand } from "@/contexts/GrabbaBrandContext";
import { BrandFilterBar } from "@/components/grabba/BrandFilterBar";
import { EntityModal, FieldConfig } from "@/components/crud/EntityModal";
import { DeleteConfirmModal } from "@/components/crud/DeleteConfirmModal";
import { GlobalAddButton } from "@/components/crud/GlobalAddButton";
import { TableRowActions } from "@/components/crud/TableRowActions";
import { DataTablePagination } from "@/components/crud/DataTablePagination";
import { useCrudOperations } from "@/hooks/useCrudOperations";
import { productionBatchFields } from "@/config/entityFieldConfigs";

export default function GrabbaProduction() {
  const { selectedBrand, setSelectedBrand, getBrandQuery } = useGrabbaBrand();
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<any>(null);
  const [deletingItem, setDeletingItem] = useState<{ id: string; name: string } | null>(null);

  // CRUD operations
  const batchCrud = useCrudOperations({
    table: "production_batches",
    queryKey: ["grabba-production-batches"],
    successMessages: {
      create: "Production batch created",
      update: "Batch updated",
      delete: "Batch deleted"
    }
  });

  // Fetch production batches
  const { data: batches, isLoading: loadingBatches } = useQuery({
    queryKey: ["grabba-production-batches", selectedBrand],
    queryFn: async () => {
      const brandsToQuery = getBrandQuery();
      const { data } = await supabase
        .from("production_batches")
        .select(`*, office:production_offices(id, name)`)
        .in("brand", brandsToQuery)
        .order("created_at", { ascending: false })
        .limit(100);
      return data || [];
    },
  });

  // Fetch offices
  const { data: offices } = useQuery({
    queryKey: ["grabba-production-offices"],
    queryFn: async () => {
      const { data } = await supabase
        .from("production_offices")
        .select("*")
        .eq("active", true)
        .order("name");
      return data || [];
    },
  });

  // Fetch tools
  const { data: tools } = useQuery({
    queryKey: ["grabba-tools-issued"],
    queryFn: async () => {
      const { data } = await supabase
        .from("production_tools_issued")
        .select(`*, office:production_offices(name)`)
        .order("issued_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  // Fetch service tickets
  const { data: serviceTickets } = useQuery({
    queryKey: ["grabba-machine-service"],
    queryFn: async () => {
      const { data } = await supabase
        .from("machine_service_logs")
        .select(`*, office:production_offices(name)`)
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  // Calculate stats
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const todayBatches = batches?.filter(b => new Date(b.created_at) >= todayStart) || [];
  const todayBoxes = todayBatches.reduce((sum, b) => sum + (b.boxes_produced || 0), 0);
  const todayTubes = todayBatches.reduce((sum, b) => sum + (b.tubes_total || 0), 0);

  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last7DaysBatches = batches?.filter(b => new Date(b.created_at) >= sevenDaysAgo) || [];
  const totalBoxes7Days = last7DaysBatches.reduce((sum, b) => sum + (b.boxes_produced || 0), 0);

  const thisWeekStart = startOfWeek(now);
  const lastWeekStart = startOfWeek(subWeeks(now, 1));
  const lastWeekEnd = endOfWeek(subWeeks(now, 1));

  const thisWeekBoxes = batches?.filter(b => new Date(b.created_at) >= thisWeekStart)
    .reduce((sum, b) => sum + (b.boxes_produced || 0), 0) || 0;

  const lastWeekBoxes = batches?.filter(b => {
    const date = new Date(b.created_at);
    return date >= lastWeekStart && date <= lastWeekEnd;
  }).reduce((sum, b) => sum + (b.boxes_produced || 0), 0) || 0;

  const weekOverWeekChange = lastWeekBoxes > 0 
    ? Math.round(((thisWeekBoxes - lastWeekBoxes) / lastWeekBoxes) * 100) 
    : 0;

  const officeOutput = offices?.map(office => {
    const officeBatches = batches?.filter(b => b.office_id === office.id) || [];
    const totalBoxes = officeBatches.reduce((sum, b) => sum + (b.boxes_produced || 0), 0);
    return { ...office, totalBoxes, batchCount: officeBatches.length };
  }).sort((a, b) => b.totalBoxes - a.totalBoxes) || [];

  const outstandingTools = tools?.filter(t => !t.returned_at) || [];
  const openTickets = serviceTickets?.filter(t => t.status === 'open' || t.status === 'in_progress') || [];

  // Filter and paginate
  const filteredBatches = batches?.filter(b => 
    !search || 
    b.office?.name?.toLowerCase().includes(search.toLowerCase()) ||
    b.produced_by?.toLowerCase().includes(search.toLowerCase()) ||
    b.shift_label?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const paginatedBatches = filteredBatches.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Handlers
  const handleCreate = async (data: Record<string, any>) => {
    await batchCrud.create(data);
    setCreateModalOpen(false);
  };

  const handleUpdate = async (data: Record<string, any>) => {
    if (editingBatch) {
      await batchCrud.update({ id: editingBatch.id, ...data });
      setEditingBatch(null);
    }
  };

  const handleDelete = async () => {
    if (deletingItem) {
      await batchCrud.remove(deletingItem.id);
      setDeletingItem(null);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Factory className="h-8 w-8 text-primary" />
              Grabba Production Center
            </h1>
            <p className="text-muted-foreground mt-1">
              Floor 6 — Box output, tools, machinery service, and office performance
            </p>
          </div>
          <BrandFilterBar
            selectedBrand={selectedBrand}
            onBrandChange={setSelectedBrand}
            variant="default"
          />
        </div>

        {/* Weekly Insights */}
        <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/20">
                  <TrendingUp className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Weekly Production Insights</p>
                  <p className="text-4xl font-bold text-foreground">
                    {thisWeekBoxes.toLocaleString()} boxes
                  </p>
                  <Badge variant={weekOverWeekChange >= 0 ? "default" : "destructive"}>
                    {weekOverWeekChange >= 0 ? "+" : ""}{weekOverWeekChange}% vs last week
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-500">{todayBoxes}</p>
                  <p className="text-xs text-muted-foreground">Today's Output</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-500">{totalBoxes7Days}</p>
                  <p className="text-xs text-muted-foreground">7-Day Total</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-500">{offices?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Active Offices</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-gradient-to-br from-green-500/10 to-green-900/5 border-green-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-green-400">
                <Box className="h-4 w-4" />
                <span className="text-xs">Boxes Today</span>
              </div>
              <div className="text-2xl font-bold text-foreground mt-1">{todayBoxes}</div>
              <div className="text-xs text-muted-foreground">{todayTubes} tubes</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-900/5 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-400">
                <Calendar className="h-4 w-4" />
                <span className="text-xs">7-Day Output</span>
              </div>
              <div className="text-2xl font-bold text-foreground mt-1">{totalBoxes7Days}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-900/5 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-purple-400">
                <Building2 className="h-4 w-4" />
                <span className="text-xs">Active Offices</span>
              </div>
              <div className="text-2xl font-bold text-foreground mt-1">{offices?.length || 0}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-900/5 border-amber-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-amber-400">
                <Wrench className="h-4 w-4" />
                <span className="text-xs">Tools Outstanding</span>
              </div>
              <div className="text-2xl font-bold text-foreground mt-1">{outstandingTools.length}</div>
            </CardContent>
          </Card>

          <Card className={`bg-gradient-to-br ${openTickets.length > 0 ? 'from-red-500/10 to-red-900/5 border-red-500/20' : 'from-emerald-500/10 to-emerald-900/5 border-emerald-500/20'}`}>
            <CardContent className="p-4">
              <div className={`flex items-center gap-2 ${openTickets.length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                <AlertTriangle className="h-4 w-4" />
                <span className="text-xs">Open Service Tickets</span>
              </div>
              <div className="text-2xl font-bold text-foreground mt-1">{openTickets.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="batches" className="space-y-6">
          <div className="flex items-center justify-between">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="batches">Production Logs</TabsTrigger>
              <TabsTrigger value="offices">Office Output</TabsTrigger>
              <TabsTrigger value="tools">Tools Issued</TabsTrigger>
              <TabsTrigger value="service">Service Tickets</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <Button onClick={() => setCreateModalOpen(true)} size="sm" className="gap-2">
                <Plus className="h-4 w-4" /> Log Production
              </Button>
            </div>
          </div>

          {/* Batches Tab */}
          <TabsContent value="batches">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Box className="h-5 w-5 text-primary" />
                  Production Logs
                </CardTitle>
                <CardDescription>{filteredBatches.length} total batches</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Batch #</TableHead>
                      <TableHead>Office</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead>Boxes</TableHead>
                      <TableHead>Tubes</TableHead>
                      <TableHead>Producer</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedBatches.map((batch: any) => (
                      <TableRow key={batch.id}>
                        <TableCell className="font-medium">{batch.batch_number || batch.id.slice(0,8)}</TableCell>
                        <TableCell>{batch.office?.name || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{batch.brand}</Badge>
                        </TableCell>
                        <TableCell>{batch.boxes_produced || 0}</TableCell>
                        <TableCell>{batch.tubes_total || (batch.boxes_produced || 0) * 100}</TableCell>
                        <TableCell>{batch.produced_by || '-'}</TableCell>
                        <TableCell>
                          {batch.created_at ? format(new Date(batch.created_at), "MMM d, h:mm a") : '-'}
                        </TableCell>
                        <TableCell>
                          <TableRowActions
                            actions={[
                              { type: 'edit', onClick: () => setEditingBatch(batch) },
                              { type: 'delete', onClick: () => setDeletingItem({ id: batch.id, name: batch.batch_number || 'Batch' }) }
                            ]}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <DataTablePagination
                  currentPage={currentPage}
                  totalPages={Math.ceil(filteredBatches.length / pageSize)}
                  pageSize={pageSize}
                  totalItems={filteredBatches.length}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={setPageSize}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Offices Tab */}
          <TabsContent value="offices">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle>Office-by-Office Output</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {officeOutput.map((office: any) => (
                    <Card key={office.id} className="bg-muted/30">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{office.name}</span>
                          <Badge variant="outline">{office.batchCount} batches</Badge>
                        </div>
                        <p className="text-2xl font-bold">{office.totalBoxes.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">total boxes produced</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tools Tab */}
          <TabsContent value="tools">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-primary" />
                  Tools Issued
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tool</TableHead>
                      <TableHead>Office</TableHead>
                      <TableHead>Issued To</TableHead>
                      <TableHead>Issued Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tools?.map((tool: any) => (
                      <TableRow key={tool.id}>
                        <TableCell className="font-medium">{tool.tool_name}</TableCell>
                        <TableCell>{tool.office?.name || 'N/A'}</TableCell>
                        <TableCell>{tool.issued_to || '-'}</TableCell>
                        <TableCell>
                          {tool.issued_at ? format(new Date(tool.issued_at), "MMM d") : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={tool.returned_at ? 'default' : 'secondary'}>
                            {tool.returned_at ? 'Returned' : 'Outstanding'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Service Tab */}
          <TabsContent value="service">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Service Tickets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Machine</TableHead>
                      <TableHead>Office</TableHead>
                      <TableHead>Issue</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {serviceTickets?.map((ticket: any) => (
                      <TableRow key={ticket.id}>
                        <TableCell className="font-medium">{ticket.machine_name}</TableCell>
                        <TableCell>{ticket.office?.name || 'N/A'}</TableCell>
                        <TableCell className="max-w-xs truncate">{ticket.issue_description}</TableCell>
                        <TableCell>
                          <Badge variant={ticket.status === 'resolved' ? 'default' : ticket.status === 'in_progress' ? 'secondary' : 'destructive'}>
                            {ticket.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {ticket.created_at ? format(new Date(ticket.created_at), "MMM d") : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      <EntityModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        title="Log Production Batch"
        fields={productionBatchFields}
        onSubmit={handleCreate}
        mode="create"
      />

      <EntityModal
        open={!!editingBatch}
        onOpenChange={(open) => !open && setEditingBatch(null)}
        title="Edit Production Batch"
        fields={productionBatchFields}
        defaultValues={editingBatch || {}}
        onSubmit={handleUpdate}
        mode="edit"
      />

      <DeleteConfirmModal
        open={!!deletingItem}
        onOpenChange={(open) => !open && setDeletingItem(null)}
        title="Delete Production Batch"
        itemName={deletingItem?.name}
        onConfirm={handleDelete}
      />

      <GlobalAddButton
        label="Log Production"
        onClick={() => setCreateModalOpen(true)}
        variant="floating"
      />
    </div>
  );
}
