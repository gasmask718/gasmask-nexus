import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  Factory, Box, Wrench, AlertTriangle, Plus, CheckCircle, Building2,
  TrendingUp, Calendar, Search, Zap, BarChart3, Clock
} from "lucide-react";
import { format, startOfWeek, endOfWeek, subWeeks, differenceInDays } from "date-fns";
import { GRABBA_BRANDS, getBrandConfig, GrabbaBrand, GRABBA_BRAND_CONFIG } from "@/config/grabbaBrands";
import { useGrabbaBrand } from "@/contexts/GrabbaBrandContext";
import { BrandFilterBar } from "@/components/grabba/BrandFilterBar";

// ═══════════════════════════════════════════════════════════════════════════════
// FLOOR 6 — GRABBA PRODUCTION & MACHINERY
// Box output, tools, machinery service, and office performance for Grabba
// ═══════════════════════════════════════════════════════════════════════════════

export default function GrabbaProduction() {
  const { selectedBrand, setSelectedBrand, getBrandQuery } = useGrabbaBrand();
  const [search, setSearch] = useState("");

  // ─────────────────────────────────────────────────────────────────────────────
  // FETCH PRODUCTION BATCHES (BOX PRODUCTION LOGS)
  // ─────────────────────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────────────────────
  // FETCH PRODUCTION OFFICES
  // ─────────────────────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────────────────────
  // FETCH TOOLS ISSUED
  // ─────────────────────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────────────────────
  // FETCH MACHINE SERVICE LOGS
  // ─────────────────────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────────────────────
  // CALCULATE STATS
  // ─────────────────────────────────────────────────────────────────────────────
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const todayBatches = batches?.filter(b => new Date(b.created_at) >= todayStart) || [];
  const todayBoxes = todayBatches.reduce((sum, b) => sum + (b.boxes_produced || 0), 0);
  const todayTubes = todayBatches.reduce((sum, b) => sum + (b.tubes_total || 0), 0);

  // Last 7 days
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last7DaysBatches = batches?.filter(b => new Date(b.created_at) >= sevenDaysAgo) || [];
  const totalBoxes7Days = last7DaysBatches.reduce((sum, b) => sum + (b.boxes_produced || 0), 0);
  const totalTubes7Days = last7DaysBatches.reduce((sum, b) => sum + (b.tubes_total || 0), 0);

  // This week vs last week comparison
  const thisWeekStart = startOfWeek(now);
  const thisWeekEnd = endOfWeek(now);
  const lastWeekStart = startOfWeek(subWeeks(now, 1));
  const lastWeekEnd = endOfWeek(subWeeks(now, 1));

  const thisWeekBoxes = batches?.filter(b => {
    const date = new Date(b.created_at);
    return date >= thisWeekStart && date <= thisWeekEnd;
  }).reduce((sum, b) => sum + (b.boxes_produced || 0), 0) || 0;

  const lastWeekBoxes = batches?.filter(b => {
    const date = new Date(b.created_at);
    return date >= lastWeekStart && date <= lastWeekEnd;
  }).reduce((sum, b) => sum + (b.boxes_produced || 0), 0) || 0;

  const weekOverWeekChange = lastWeekBoxes > 0 
    ? Math.round(((thisWeekBoxes - lastWeekBoxes) / lastWeekBoxes) * 100) 
    : 0;

  // Office-by-office output
  const officeOutput = offices?.map(office => {
    const officeBatches = batches?.filter(b => b.office_id === office.id) || [];
    const totalBoxes = officeBatches.reduce((sum, b) => sum + (b.boxes_produced || 0), 0);
    const totalTubes = officeBatches.reduce((sum, b) => sum + (b.tubes_total || 0), 0);
    const batchCount = officeBatches.length;
    const avgBoxesPerBatch = batchCount > 0 ? Math.round(totalBoxes / batchCount) : 0;
    return { ...office, totalBoxes, totalTubes, batchCount, avgBoxesPerBatch };
  }).sort((a, b) => b.totalBoxes - a.totalBoxes) || [];

  // Brand breakdown
  const brandOutput: Record<GrabbaBrand, { boxes: number; tubes: number; batches: number }> = {} as any;
  GRABBA_BRANDS.forEach(brand => {
    const brandBatches = batches?.filter(b => b.brand === brand) || [];
    brandOutput[brand] = {
      boxes: brandBatches.reduce((sum, b) => sum + (b.boxes_produced || 0), 0),
      tubes: brandBatches.reduce((sum, b) => sum + (b.tubes_total || 0), 0),
      batches: brandBatches.length,
    };
  });
  const totalAllBoxes = Object.values(brandOutput).reduce((sum, b) => sum + b.boxes, 0);

  // Outstanding tools
  const outstandingTools = tools?.filter(t => !t.returned_at) || [];
  const openTickets = serviceTickets?.filter(t => t.status === 'open' || t.status === 'in_progress') || [];

  // Filter batches by search
  const filteredBatches = batches?.filter(b => 
    !search || 
    b.office?.name?.toLowerCase().includes(search.toLowerCase()) ||
    b.produced_by?.toLowerCase().includes(search.toLowerCase()) ||
    b.shift_label?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        {/* HEADER */}
        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
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

        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        {/* WEEKLY PRODUCTION INSIGHTS */}
        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
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
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={weekOverWeekChange >= 0 ? "default" : "destructive"}>
                      {weekOverWeekChange >= 0 ? "+" : ""}{weekOverWeekChange}% vs last week
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      (Last week: {lastWeekBoxes.toLocaleString()})
                    </span>
                  </div>
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

        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        {/* KPI CARDS */}
        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
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
              <div className="text-xs text-muted-foreground">{totalTubes7Days} tubes</div>
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

        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        {/* TABS */}
        {/* ═══════════════════════════════════════════════════════════════════════════════ */}
        <Tabs defaultValue="batches" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="batches">Box Production Logs</TabsTrigger>
            <TabsTrigger value="offices">Office-by-Office</TabsTrigger>
            <TabsTrigger value="tools">Tools Issued</TabsTrigger>
            <TabsTrigger value="service">Machinery Service</TabsTrigger>
            <TabsTrigger value="brand">Brand Breakdown</TabsTrigger>
          </TabsList>

          {/* ─────────────────────────────────────────────────────────────────────────────
              BOX PRODUCTION LOGS TAB
          ───────────────────────────────────────────────────────────────────────────── */}
          <TabsContent value="batches">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Box className="h-5 w-5 text-primary" />
                    Box Production Logs
                  </CardTitle>
                  <CardDescription>Recent production batches across all offices</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search batches..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Button size="sm" className="gap-2">
                    <Plus className="h-4 w-4" /> Log Batch
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingBatches ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : filteredBatches?.length === 0 ? (
                  <div className="text-center py-8">
                    <Box className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No production batches found</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {filteredBatches?.map(batch => {
                      const config = getBrandConfig(batch.brand);
                      return (
                        <div key={batch.id} className={`p-4 rounded-xl border ${config.gradient}`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <Badge className={config.pill}>{config.label}</Badge>
                                <span className="text-sm text-muted-foreground">{batch.office?.name || 'Unknown Office'}</span>
                              </div>
                              <div className="text-sm text-muted-foreground mt-1 flex items-center gap-3">
                                {batch.shift_label && <span>Shift: {batch.shift_label}</span>}
                                {batch.produced_by && <span>By: {batch.produced_by}</span>}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-bold text-foreground">{batch.boxes_produced} boxes</div>
                              <div className="text-sm text-muted-foreground">{batch.tubes_total?.toLocaleString()} tubes</div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {format(new Date(batch.created_at), "MMM d, yyyy h:mm a")}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─────────────────────────────────────────────────────────────────────────────
              OFFICE-BY-OFFICE TAB
          ───────────────────────────────────────────────────────────────────────────── */}
          <TabsContent value="offices">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  Office-by-Office Output
                </CardTitle>
                <CardDescription>Production performance by office location</CardDescription>
              </CardHeader>
              <CardContent>
                {officeOutput.length === 0 ? (
                  <div className="text-center py-8">
                    <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No office data available</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {officeOutput.map((office, i) => {
                      const maxBoxes = officeOutput[0]?.totalBoxes || 1;
                      const percentage = (office.totalBoxes / maxBoxes) * 100;
                      
                      return (
                        <div key={office.id} className="p-4 rounded-xl border border-border/50 bg-card/30">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <span className={`text-2xl font-bold ${i < 3 ? 'text-primary' : 'text-muted-foreground'}`}>
                                #{i + 1}
                              </span>
                              <div>
                                <div className="font-medium text-foreground">{office.name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {office.batchCount} batches • {office.avgBoxesPerBatch} avg boxes/batch
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-bold text-foreground">{office.totalBoxes.toLocaleString()} boxes</div>
                              <div className="text-sm text-muted-foreground">{office.totalTubes.toLocaleString()} tubes</div>
                            </div>
                          </div>
                          <Progress value={percentage} className="h-2" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─────────────────────────────────────────────────────────────────────────────
              TOOLS ISSUED TAB
          ───────────────────────────────────────────────────────────────────────────── */}
          <TabsContent value="tools">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-amber-500" />
                    Tools Issued Logs
                  </CardTitle>
                  <CardDescription>Track tools checked out to workers</CardDescription>
                </div>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" /> Issue Tool
                </Button>
              </CardHeader>
              <CardContent>
                {tools?.length === 0 ? (
                  <div className="text-center py-8">
                    <Wrench className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No tools issued</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {tools?.map(tool => (
                      <div key={tool.id} className={`p-4 rounded-xl border ${!tool.returned_at ? 'border-amber-500/20 bg-amber-500/5' : 'border-border/50 bg-card/30'} flex items-center justify-between`}>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{tool.tool_name}</span>
                            {!tool.returned_at && <Badge variant="secondary">Outstanding</Badge>}
                            {tool.returned_at && <Badge variant="outline">Returned</Badge>}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            Qty: {tool.quantity} • Issued to: {tool.issued_to || 'Unknown'} • {tool.office?.name}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground">
                            Issued: {format(new Date(tool.issued_at), "MMM d, yyyy")}
                          </div>
                          {tool.returned_at ? (
                            <div className="text-xs text-green-500">
                              Returned: {format(new Date(tool.returned_at), "MMM d, yyyy")}
                            </div>
                          ) : (
                            <Button size="sm" variant="outline" className="mt-2">
                              <CheckCircle className="h-3 w-3 mr-1" /> Mark Returned
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─────────────────────────────────────────────────────────────────────────────
              MACHINERY SERVICE TAB
          ───────────────────────────────────────────────────────────────────────────── */}
          <TabsContent value="service">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    Machinery Service Logs
                  </CardTitle>
                  <CardDescription>Machine maintenance and repair tickets</CardDescription>
                </div>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" /> New Ticket
                </Button>
              </CardHeader>
              <CardContent>
                {serviceTickets?.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-2" />
                    <p className="text-muted-foreground">All machines running smoothly!</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {serviceTickets?.map(ticket => {
                      const daysOpen = ticket.created_at 
                        ? differenceInDays(new Date(), new Date(ticket.created_at)) 
                        : 0;
                      const isOpen = ticket.status === 'open' || ticket.status === 'in_progress';
                      
                      return (
                        <div key={ticket.id} className={`p-4 rounded-xl border ${isOpen ? 'border-red-500/20 bg-red-500/5' : 'border-border/50 bg-card/30'}`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-foreground">{ticket.machine_name}</span>
                                <Badge variant={ticket.status === 'open' ? 'destructive' : ticket.status === 'in_progress' ? 'secondary' : 'default'}>
                                  {ticket.status}
                                </Badge>
                                {isOpen && daysOpen > 0 && (
                                  <Badge variant="outline" className="text-xs">
                                    <Clock className="h-3 w-3 mr-1" /> {daysOpen} days
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground mt-1">{ticket.office?.name}</div>
                              <p className="text-sm text-foreground mt-2">{ticket.issue_description}</p>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-muted-foreground">
                                {format(new Date(ticket.created_at), "MMM d, yyyy")}
                              </div>
                              {ticket.serviced_by && (
                                <div className="text-sm text-muted-foreground">Assigned: {ticket.serviced_by}</div>
                              )}
                              {ticket.resolved_at && (
                                <div className="text-xs text-green-500 mt-1">
                                  Resolved: {format(new Date(ticket.resolved_at), "MMM d")}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─────────────────────────────────────────────────────────────────────────────
              BRAND BREAKDOWN TAB
          ───────────────────────────────────────────────────────────────────────────── */}
          <TabsContent value="brand">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Production by Brand
                </CardTitle>
                <CardDescription>Output breakdown across Grabba brands</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {GRABBA_BRANDS.map(brand => {
                    const config = GRABBA_BRAND_CONFIG[brand];
                    const data = brandOutput[brand];
                    const percentage = totalAllBoxes > 0 ? (data.boxes / totalAllBoxes) * 100 : 0;
                    
                    return (
                      <div key={brand} className={`p-4 rounded-xl border ${config.gradient}`}>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xl">{config.icon}</span>
                          <span className="font-medium text-foreground">{config.label}</span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Boxes</span>
                            <span className="font-bold text-foreground">{data.boxes.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Tubes</span>
                            <span className="font-bold text-foreground">{data.tubes.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Batches</span>
                            <span className="font-medium text-foreground">{data.batches}</span>
                          </div>
                          <Progress value={percentage} className="h-2 mt-2" />
                          <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}% of total</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
