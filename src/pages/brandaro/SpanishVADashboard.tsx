import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Phone, MessageSquare, CheckCircle, XCircle, Clock, Send,
  BarChart3, FileText, Loader2, User, Building2, Globe2, Brain
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCall } from "@/components/communication/CallProvider";

interface Lead {
  id: string;
  business_name: string;
  phone: string;
  email?: string;
  status: string;
  intent_score?: number;
  region?: string;
  created_at: string;
}

interface CallNote {
  id: string;
  summary: string;
  objection?: string;
  next_step?: string;
  created_at: string;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  new: { label: "Nuevo", color: "bg-blue-500/20 text-blue-400" },
  contacted: { label: "Contactado", color: "bg-yellow-500/20 text-yellow-400" },
  interested: { label: "Interesado", color: "bg-emerald-500/20 text-emerald-400" },
  not_interested: { label: "No Interesado", color: "bg-red-500/20 text-red-400" },
  callback: { label: "Llamar Luego", color: "bg-orange-500/20 text-orange-400" },
  form_sent: { label: "Formulario Enviado", color: "bg-cyan-500/20 text-cyan-400" },
  form_completed: { label: "Formulario Completo", color: "bg-purple-500/20 text-purple-400" },
  closed: { label: "Cerrado", color: "bg-green-500/20 text-green-400" },
};

export default function SpanishVADashboard() {
  const queryClient = useQueryClient();
  const { initiateCall } = useCall();
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [coachingOpen, setCoachingOpen] = useState(false);
  const [noteForm, setNoteForm] = useState({ summary: "", objection: "", next_step: "" });
  const [coaching, setCoaching] = useState<string | null>(null);
  const [loadingCoaching, setLoadingCoaching] = useState(false);

  // Get current user
  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  // Fetch only assigned leads for this VA
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["va-assigned-leads", currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return [];
      const { data, error } = await (supabase as any)
        .from("brandaro_leads_master")
        .select("*")
        .eq("assigned_va_id", currentUser.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Lead[];
    },
    enabled: !!currentUser?.id,
  });

  // Fetch call notes for selected lead
  const { data: notes = [] } = useQuery({
    queryKey: ["va-call-notes", selectedLead?.id],
    queryFn: async () => {
      if (!selectedLead?.id) return [];
      const { data } = await (supabase as any)
        .from("brandaro_va_call_notes")
        .select("*")
        .eq("lead_id", selectedLead.id)
        .order("created_at", { ascending: false });
      return (data || []) as CallNote[];
    },
    enabled: !!selectedLead?.id,
  });

  // Performance stats
  const { data: stats } = useQuery({
    queryKey: ["va-stats", currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return { total: 0, interested: 0, forms: 0, closed: 0 };
      const all = leads;
      return {
        total: all.length,
        interested: all.filter((l: Lead) => l.status === "interested").length,
        forms: all.filter((l: Lead) => ["form_sent", "form_completed"].includes(l.status)).length,
        closed: all.filter((l: Lead) => l.status === "closed").length,
      };
    },
    enabled: leads.length >= 0,
  });

  // Update lead status
  const updateStatus = useMutation({
    mutationFn: async ({ leadId, status }: { leadId: string; status: string }) => {
      const { error } = await (supabase as any)
        .from("brandaro_leads_master")
        .update({ status })
        .eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["va-assigned-leads"] });
      const label = STATUS_MAP[status]?.label || status;
      toast.success(`Estado actualizado: ${label}`);
    },
    onError: () => toast.error("Error al actualizar estado"),
  });

  // Save call note
  const saveNote = useMutation({
    mutationFn: async () => {
      if (!selectedLead || !currentUser) return;
      const { error } = await (supabase as any)
        .from("brandaro_va_call_notes")
        .insert({
          lead_id: selectedLead.id,
          va_id: currentUser.id,
          summary: noteForm.summary,
          objection: noteForm.objection || null,
          next_step: noteForm.next_step || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["va-call-notes"] });
      setNoteForm({ summary: "", objection: "", next_step: "" });
      setNoteOpen(false);
      toast.success("Nota guardada ✅");
    },
    onError: () => toast.error("Error al guardar nota"),
  });

  // Request AI coaching
  const requestCoaching = async () => {
    if (!selectedLead) return;
    setLoadingCoaching(true);
    setCoachingOpen(true);
    try {
      const { data, error } = await supabase.functions.invoke("brandaro-va-coaching", {
        body: {
          lead_id: selectedLead.id,
          notes: notes.map((n: CallNote) => n.summary).join("\n"),
          language: "spanish",
        },
      });
      if (error) throw error;
      setCoaching(data?.coaching || "No hay recomendaciones disponibles.");
    } catch {
      setCoaching("Error al obtener coaching. Intenta de nuevo.");
    } finally {
      setLoadingCoaching(false);
    }
  };

  const statCards = [
    { label: "Total Leads", value: stats?.total || 0, icon: Building2, accent: "text-primary" },
    { label: "Interesados", value: stats?.interested || 0, icon: CheckCircle, accent: "text-emerald-400" },
    { label: "Formularios", value: stats?.forms || 0, icon: FileText, accent: "text-cyan-400" },
    { label: "Cerrados", value: stats?.closed || 0, icon: BarChart3, accent: "text-amber-400" },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
          <Globe2 className="h-5 w-5 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Panel de Ventas</h1>
          <p className="text-sm text-muted-foreground">Tu centro de operaciones — leads, llamadas y resultados</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((s) => (
          <Card key={s.label} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`h-4 w-4 ${s.accent}`} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className={`text-2xl font-bold ${s.accent}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="leads" className="space-y-4">
        <TabsList className="grid grid-cols-2 w-full max-w-md">
          <TabsTrigger value="leads">📋 Mis Leads</TabsTrigger>
          <TabsTrigger value="performance">📊 Rendimiento</TabsTrigger>
        </TabsList>

        {/* Leads Tab */}
        <TabsContent value="leads" className="space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : leads.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="p-8 text-center">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No tienes leads asignados todavía.</p>
                <p className="text-xs text-muted-foreground mt-1">Tu administrador te asignará leads pronto.</p>
              </CardContent>
            </Card>
          ) : (
            leads.map((lead: Lead) => (
              <Card
                key={lead.id}
                className={`bg-card border-border cursor-pointer transition-all hover:border-primary/50 ${
                  selectedLead?.id === lead.id ? "ring-1 ring-primary" : ""
                }`}
                onClick={() => setSelectedLead(lead)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-foreground">{lead.business_name || "Sin Nombre"}</h3>
                      <p className="text-sm text-muted-foreground">{lead.phone}</p>
                      {lead.region && (
                        <span className="text-xs text-muted-foreground">📍 {lead.region}</span>
                      )}
                    </div>
                    <Badge className={STATUS_MAP[lead.status]?.color || "bg-muted text-muted-foreground"}>
                      {STATUS_MAP[lead.status]?.label || lead.status}
                    </Badge>
                  </div>

                  {selectedLead?.id === lead.id && (
                    <div className="mt-3 pt-3 border-t border-border space-y-3">
                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`tel:${lead.phone}`);
                            updateStatus.mutate({ leadId: lead.id, status: "contacted" });
                          }}
                        >
                          <Phone className="h-3 w-3 mr-1" /> Llamar
                        </Button>
                        <Button
                          size="sm"
                          className="text-xs bg-emerald-600 hover:bg-emerald-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateStatus.mutate({ leadId: lead.id, status: "interested" });
                          }}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" /> Interesado
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateStatus.mutate({ leadId: lead.id, status: "not_interested" });
                          }}
                        >
                          <XCircle className="h-3 w-3 mr-1" /> No Interesado
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateStatus.mutate({ leadId: lead.id, status: "callback" });
                          }}
                        >
                          <Clock className="h-3 w-3 mr-1" /> Llamar Luego
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateStatus.mutate({ leadId: lead.id, status: "form_sent" });
                          }}
                        >
                          <Send className="h-3 w-3 mr-1" /> Enviar Formulario
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setNoteOpen(true);
                          }}
                        >
                          <MessageSquare className="h-3 w-3 mr-1" /> Agregar Nota
                        </Button>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs w-full border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          requestCoaching();
                        }}
                      >
                        <Brain className="h-3 w-3 mr-1" /> 🤖 Coaching IA
                      </Button>

                      {/* Recent Notes */}
                      {notes.length > 0 && (
                        <div className="space-y-2 mt-2">
                          <p className="text-xs font-medium text-muted-foreground">Notas recientes:</p>
                          {notes.slice(0, 3).map((n: CallNote) => (
                            <div key={n.id} className="text-xs bg-muted/50 rounded p-2">
                              <p className="text-foreground">{n.summary}</p>
                              {n.objection && <p className="text-orange-400 mt-1">⚠️ {n.objection}</p>}
                              {n.next_step && <p className="text-cyan-400 mt-1">→ {n.next_step}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-cyan-400" />
                Tu Rendimiento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "Llamadas Realizadas", value: stats?.total || 0, max: 50, color: "bg-primary" },
                { label: "Interesados", value: stats?.interested || 0, max: 20, color: "bg-emerald-500" },
                { label: "Formularios Enviados", value: stats?.forms || 0, max: 15, color: "bg-cyan-500" },
                { label: "Ventas Cerradas", value: stats?.closed || 0, max: 10, color: "bg-amber-500" },
              ].map((bar) => (
                <div key={bar.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">{bar.label}</span>
                    <span className="font-bold text-foreground">{bar.value}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${bar.color} rounded-full transition-all`}
                      style={{ width: `${Math.min((bar.value / bar.max) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Note Dialog */}
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>📝 Agregar Nota de Llamada</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-muted-foreground">Resumen de la conversación *</label>
              <Textarea
                placeholder="¿Qué pasó en la llamada?"
                value={noteForm.summary}
                onChange={(e) => setNoteForm({ ...noteForm, summary: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Objeción (si hubo)</label>
              <Input
                placeholder="Ej: No tiene presupuesto, no está interesado..."
                value={noteForm.objection}
                onChange={(e) => setNoteForm({ ...noteForm, objection: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Próximo paso</label>
              <Input
                placeholder="Ej: Llamar el lunes, enviar más info..."
                value={noteForm.next_step}
                onChange={(e) => setNoteForm({ ...noteForm, next_step: e.target.value })}
              />
            </div>
            <Button
              className="w-full"
              disabled={!noteForm.summary || saveNote.isPending}
              onClick={() => saveNote.mutate()}
            >
              {saveNote.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Guardar Nota
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Coaching Dialog */}
      <Dialog open={coachingOpen} onOpenChange={setCoachingOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>🤖 Coaching IA — Recomendaciones</DialogTitle>
          </DialogHeader>
          {loadingCoaching ? (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-400 mb-3" />
              <p className="text-sm text-muted-foreground">Analizando tus notas...</p>
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm">
              {coaching}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
