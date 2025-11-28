import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Factory, Box, Wrench, AlertTriangle, Plus, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { GRABBA_BRANDS, getBrandConfig } from "@/config/grabbaBrands";

export default function GrabbaProduction() {
  const queryClient = useQueryClient();
  const [brandFilter, setBrandFilter] = useState<string>("all");

  // Fetch production batches
  const { data: batches, isLoading: loadingBatches } = useQuery({
    queryKey: ["grabba-production-batches", brandFilter],
    queryFn: async () => {
      let query = supabase
        .from("production_batches")
        .select(`*, office:production_offices(name)`)
        .order("created_at", { ascending: false })
        .limit(50);

      if (brandFilter !== "all") {
        query = query.eq("brand", brandFilter);
      }

      const { data } = await query;
      return data || [];
    },
  });

  // Fetch production offices
  const { data: offices } = useQuery({
    queryKey: ["grabba-production-offices"],
    queryFn: async () => {
      const { data } = await supabase.from("production_offices").select("*").eq("active", true);
      return data || [];
    },
  });

  // Fetch tools issued
  const { data: tools } = useQuery({
    queryKey: ["grabba-tools-issued"],
    queryFn: async () => {
      const { data } = await supabase
        .from("production_tools_issued")
        .select(`*, office:production_offices(name)`)
        .is("returned_at", null)
        .order("issued_at", { ascending: false });
      return data || [];
    },
  });

  // Fetch machine service logs
  const { data: serviceTickets } = useQuery({
    queryKey: ["grabba-machine-service"],
    queryFn: async () => {
      const { data } = await supabase
        .from("machine_service_logs")
        .select(`*, office:production_offices(name)`)
        .in("status", ["open", "in_progress"])
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Calculate stats
  const todayBatches = batches?.filter(b => 
    new Date(b.created_at).toDateString() === new Date().toDateString()
  ) || [];
  const todayBoxes = todayBatches.reduce((sum, b) => sum + (b.boxes_produced || 0), 0);
  const totalBoxes7Days = batches?.filter(b => 
    new Date(b.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  ).reduce((sum, b) => sum + (b.boxes_produced || 0), 0) || 0;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Factory className="h-8 w-8 text-primary" />
              Grabba Production Center
            </h1>
            <p className="text-muted-foreground mt-1">
              Monitor boxes made, tools issued, machinery health, and production office performance
            </p>
          </div>
          <Select value={brandFilter} onValueChange={setBrandFilter}>
            <SelectTrigger className="w-48">
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
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-green-500/10 to-green-900/5 border-green-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-green-400">
                <Box className="h-5 w-5" />
                <span className="text-sm">Boxes Today</span>
              </div>
              <div className="text-3xl font-bold text-foreground mt-2">{todayBoxes}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-900/5 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-400">
                <Box className="h-5 w-5" />
                <span className="text-sm">Boxes (7 Days)</span>
              </div>
              <div className="text-3xl font-bold text-foreground mt-2">{totalBoxes7Days}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-900/5 border-amber-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-amber-400">
                <Wrench className="h-5 w-5" />
                <span className="text-sm">Tools Outstanding</span>
              </div>
              <div className="text-3xl font-bold text-foreground mt-2">{tools?.length || 0}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-500/10 to-red-900/5 border-red-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="h-5 w-5" />
                <span className="text-sm">Open Service Tickets</span>
              </div>
              <div className="text-3xl font-bold text-foreground mt-2">{serviceTickets?.length || 0}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="batches" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="batches">Production Batches</TabsTrigger>
            <TabsTrigger value="tools">Tools Issued</TabsTrigger>
            <TabsTrigger value="service">Machine Service</TabsTrigger>
          </TabsList>

          <TabsContent value="batches">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Recent Production Batches</CardTitle>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" /> Log Batch
                </Button>
              </CardHeader>
              <CardContent>
                {loadingBatches ? (
                  <p className="text-muted-foreground">Loading batches...</p>
                ) : batches?.length === 0 ? (
                  <p className="text-muted-foreground">No production batches found</p>
                ) : (
                  <div className="space-y-3">
                    {batches?.map(batch => {
                      const config = getBrandConfig(batch.brand);
                      return (
                        <div key={batch.id} className={`p-4 rounded-xl border bg-gradient-to-br ${config.gradient}`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <Badge className={config.pill}>{config.label}</Badge>
                                <span className="text-sm text-muted-foreground">{batch.office?.name || 'Unknown Office'}</span>
                              </div>
                              <div className="text-sm text-muted-foreground mt-1">
                                {batch.shift_label && <span className="mr-3">Shift: {batch.shift_label}</span>}
                                {batch.produced_by && <span>By: {batch.produced_by}</span>}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-bold text-foreground">{batch.boxes_produced} boxes</div>
                              <div className="text-sm text-muted-foreground">{batch.tubes_total} tubes</div>
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

          <TabsContent value="tools">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Outstanding Tools</CardTitle>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" /> Issue Tool
                </Button>
              </CardHeader>
              <CardContent>
                {tools?.length === 0 ? (
                  <p className="text-muted-foreground">No outstanding tools</p>
                ) : (
                  <div className="space-y-3">
                    {tools?.map(tool => (
                      <div key={tool.id} className="p-4 rounded-xl border border-border/50 bg-card/30 flex items-center justify-between">
                        <div>
                          <div className="font-medium text-foreground">{tool.tool_name}</div>
                          <div className="text-sm text-muted-foreground">
                            Qty: {tool.quantity} • Issued to: {tool.issued_to || 'Unknown'} • {tool.office?.name}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(tool.issued_at), "MMM d, yyyy")}
                          </div>
                          <Button size="sm" variant="outline" className="mt-2">
                            <CheckCircle className="h-3 w-3 mr-1" /> Mark Returned
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="service">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Machine Service Tickets</CardTitle>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" /> New Ticket
                </Button>
              </CardHeader>
              <CardContent>
                {serviceTickets?.length === 0 ? (
                  <p className="text-muted-foreground">No open service tickets</p>
                ) : (
                  <div className="space-y-3">
                    {serviceTickets?.map(ticket => (
                      <div key={ticket.id} className="p-4 rounded-xl border border-border/50 bg-card/30">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">{ticket.machine_name}</span>
                              <Badge variant={ticket.status === 'open' ? 'destructive' : 'secondary'}>
                                {ticket.status}
                              </Badge>
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
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
