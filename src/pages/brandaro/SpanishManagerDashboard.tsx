import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users, BarChart3, Target, TrendingUp, UserPlus, CheckCircle,
  Phone, FileText, Loader2, Building2, Globe2, ArrowRight
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function SpanishManagerDashboard() {
  const queryClient = useQueryClient();
  const [selectedVA, setSelectedVA] = useState<string>("all");
  const [assigningLeads, setAssigningLeads] = useState<Set<string>>(new Set());

  // Current user
  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  // Get team VAs under this manager
  const { data: teamVAs = [] } = useQuery({
    queryKey: ["manager-team", currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return [];
      const { data } = await (supabase as any)
        .from("brandaro_team_hierarchy")
        .select("va_id, status, profiles!brandaro_team_hierarchy_va_id_fkey(id, full_name, email)")
        .eq("manager_id", currentUser.id)
        .eq("status", "active");
      return (data || []).map((d: any) => ({
        id: d.va_id,
        name: d.profiles?.full_name || d.profiles?.email || "VA",
        email: d.profiles?.email,
      }));
    },
    enabled: !!currentUser?.id,
  });

  // Get all Spanish leads (manager sees all assigned to their team + unassigned)
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["manager-spanish-leads", currentUser?.id, selectedVA],
    queryFn: async () => {
      if (!currentUser?.id) return [];
      let query = (supabase as any)
        .from("brandaro_leads_master")
        .select("*")
        .eq("language", "spanish")
        .order("created_at", { ascending: false })
        .limit(200);

      if (selectedVA && selectedVA !== "all" && selectedVA !== "unassigned") {
        query = query.eq("assigned_va_id", selectedVA);
      } else if (selectedVA === "unassigned") {
        query = query.is("assigned_va_id", null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentUser?.id,
  });

  // Stats
  const totalLeads = leads.length;
  const unassigned = leads.filter((l: any) => !l.assigned_va_id).length;
  const interested = leads.filter((l: any) => l.status === "interested").length;
  const closed = leads.filter((l: any) => l.status === "closed").length;

  // VA performance stats
  const vaStats = teamVAs.map((va: any) => {
    const vaLeads = leads.filter((l: any) => l.assigned_va_id === va.id);
    return {
      ...va,
      total: vaLeads.length,
      contacted: vaLeads.filter((l: any) => l.status === "contacted").length,
      interested: vaLeads.filter((l: any) => l.status === "interested").length,
      closed: vaLeads.filter((l: any) => l.status === "closed").length,
      convRate: vaLeads.length > 0
        ? Math.round((vaLeads.filter((l: any) => l.status === "closed").length / vaLeads.length) * 100)
        : 0,
    };
  });

  // Assign lead to VA
  const assignLead = useMutation({
    mutationFn: async ({ leadId, vaId }: { leadId: string; vaId: string }) => {
      const { error } = await (supabase as any)
        .from("brandaro_leads_master")
        .update({ assigned_va_id: vaId, assigned_manager_id: currentUser?.id })
        .eq("id", leadId);
      if (error) throw error;

      // Log assignment
      await (supabase as any).from("brandaro_lead_assignments").insert({
        lead_id: leadId,
        assigned_by: currentUser?.id,
        assigned_to: vaId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manager-spanish-leads"] });
      toast.success("Lead asignado ✅");
    },
    onError: () => toast.error("Error al asignar lead"),
  });

  // Bulk assign unassigned leads
  const bulkAssign = useMutation({
    mutationFn: async (vaId: string) => {
      const unassignedLeads = leads.filter((l: any) => !l.assigned_va_id);
      for (const lead of unassignedLeads) {
        await (supabase as any)
          .from("brandaro_leads_master")
          .update({ assigned_va_id: vaId, assigned_manager_id: currentUser?.id })
          .eq("id", lead.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manager-spanish-leads"] });
      toast.success(`${unassigned} leads asignados`);
    },
  });

  const getVAName = (vaId: string) => {
    const va = teamVAs.find((v: any) => v.id === vaId);
    return va?.name || "Sin asignar";
  };

  const statusLabel: Record<string, string> = {
    new: "Nuevo", contacted: "Contactado", interested: "Interesado",
    not_interested: "No Interesado", callback: "Llamar Luego",
    form_sent: "Formulario", form_completed: "Completo", closed: "Cerrado",
  };

  const statusColor: Record<string, string> = {
    new: "bg-blue-500/20 text-blue-400", contacted: "bg-yellow-500/20 text-yellow-400",
    interested: "bg-emerald-500/20 text-emerald-400", closed: "bg-green-500/20 text-green-400",
    not_interested: "bg-red-500/20 text-red-400", callback: "bg-orange-500/20 text-orange-400",
    form_sent: "bg-cyan-500/20 text-cyan-400", form_completed: "bg-purple-500/20 text-purple-400",
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
          <Users className="h-5 w-5 text-amber-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Panel de Gerente — División Español</h1>
          <p className="text-sm text-muted-foreground">Asigna leads, monitorea VAs y controla el pipeline</p>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Leads", value: totalLeads, icon: Building2, color: "text-primary" },
          { label: "Sin Asignar", value: unassigned, icon: UserPlus, color: "text-amber-400" },
          { label: "Interesados", value: interested, icon: Target, color: "text-emerald-400" },
          { label: "Cerrados", value: closed, icon: CheckCircle, color: "text-green-400" },
        ].map((s) => (
          <Card key={s.label} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`h-4 w-4 ${s.color}`} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="leads" className="space-y-4">
        <TabsList className="grid grid-cols-3 w-full max-w-lg">
          <TabsTrigger value="leads">📋 Leads</TabsTrigger>
          <TabsTrigger value="team">👥 Equipo</TabsTrigger>
          <TabsTrigger value="performance">📊 Rendimiento</TabsTrigger>
        </TabsList>

        {/* LEADS TAB */}
        <TabsContent value="leads" className="space-y-4">
          {/* Filter + Bulk Actions */}
          <div className="flex flex-wrap gap-3 items-center">
            <Select value={selectedVA} onValueChange={setSelectedVA}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por VA" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los leads</SelectItem>
                <SelectItem value="unassigned">Sin asignar</SelectItem>
                {teamVAs.map((va: any) => (
                  <SelectItem key={va.id} value={va.id}>{va.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {unassigned > 0 && teamVAs.length > 0 && (
              <Select onValueChange={(vaId) => bulkAssign.mutate(vaId)}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder={`Asignar ${unassigned} leads a...`} />
                </SelectTrigger>
                <SelectContent>
                  {teamVAs.map((va: any) => (
                    <SelectItem key={va.id} value={va.id}>→ {va.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : leads.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="p-8 text-center">
                <Globe2 className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No hay leads en español todavía.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-md border border-border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Negocio</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Región</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Asignado a</TableHead>
                    <TableHead>Asignar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead: any) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">{lead.business_name || "—"}</TableCell>
                      <TableCell className="text-sm">{lead.phone || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{lead.region || "US"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColor[lead.status] || "bg-muted text-muted-foreground"}>
                          {statusLabel[lead.status] || lead.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {lead.assigned_va_id ? getVAName(lead.assigned_va_id) : (
                          <span className="text-amber-400 text-xs">Sin asignar</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select onValueChange={(vaId) => assignLead.mutate({ leadId: lead.id, vaId })}>
                          <SelectTrigger className="w-32 h-8 text-xs">
                            <SelectValue placeholder="Asignar" />
                          </SelectTrigger>
                          <SelectContent>
                            {teamVAs.map((va: any) => (
                              <SelectItem key={va.id} value={va.id}>{va.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* TEAM TAB */}
        <TabsContent value="team" className="space-y-4">
          {teamVAs.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="p-8 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No tienes VAs asignados a tu equipo.</p>
                <p className="text-xs text-muted-foreground mt-1">El administrador debe agregar VAs a tu equipo.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {vaStats.map((va: any) => (
                <Card key={va.id} className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{va.name}</p>
                        <p className="text-xs text-muted-foreground">{va.email}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      {[
                        { label: "Leads", value: va.total, color: "text-primary" },
                        { label: "Contactados", value: va.contacted, color: "text-yellow-400" },
                        { label: "Interesados", value: va.interested, color: "text-emerald-400" },
                        { label: "Cerrados", value: va.closed, color: "text-green-400" },
                      ].map((m) => (
                        <div key={m.label}>
                          <p className={`text-lg font-bold ${m.color}`}>{m.value}</p>
                          <p className="text-[10px] text-muted-foreground">{m.label}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <TrendingUp className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Tasa de cierre: </span>
                      <span className="text-xs font-bold text-foreground">{va.convRate}%</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* PERFORMANCE TAB */}
        <TabsContent value="performance">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-amber-400" />
                Tabla de Rendimiento del Equipo
              </CardTitle>
            </CardHeader>
            <CardContent>
              {vaStats.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">Sin datos de equipo</p>
              ) : (
                <div className="rounded-md border border-border overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>VA</TableHead>
                        <TableHead className="text-center">Leads</TableHead>
                        <TableHead className="text-center">Llamadas</TableHead>
                        <TableHead className="text-center">Interesados</TableHead>
                        <TableHead className="text-center">Cerrados</TableHead>
                        <TableHead className="text-center">% Cierre</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vaStats
                        .sort((a: any, b: any) => b.closed - a.closed)
                        .map((va: any) => (
                          <TableRow key={va.id}>
                            <TableCell className="font-medium">{va.name}</TableCell>
                            <TableCell className="text-center">{va.total}</TableCell>
                            <TableCell className="text-center">{va.contacted}</TableCell>
                            <TableCell className="text-center text-emerald-400">{va.interested}</TableCell>
                            <TableCell className="text-center text-green-400 font-bold">{va.closed}</TableCell>
                            <TableCell className="text-center">
                              <Badge className={va.convRate >= 20 ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}>
                                {va.convRate}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
