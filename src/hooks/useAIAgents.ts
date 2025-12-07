import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type AgentRole = 'customer_service' | 'sales' | 'retention' | 'billing' | 'dispatcher' | 'supervisor';
export type AssignmentStatus = 'pending' | 'in_progress' | 'completed' | 'escalated' | 'failed';
export type SupervisionDecision = 'approve' | 'reject' | 'modify' | 'escalate' | 'auto-correct';

export interface AIAgent {
  id: string;
  business_id: string | null;
  name: string;
  role: AgentRole;
  persona_id: string | null;
  active: boolean;
  capabilities: string[];
  description: string | null;
  success_rate: number;
  tasks_completed: number;
  created_at: string;
}

export interface AgentAssignment {
  id: string;
  agent_id: string;
  business_id: string | null;
  store_id: string | null;
  contact_id: string | null;
  message_id: string | null;
  task_type: string;
  status: AssignmentStatus;
  priority: string;
  ai_notes: string | null;
  result: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  agent?: AIAgent;
  store?: { id: string; store_name: string } | null;
}

export interface SupervisionLog {
  id: string;
  supervisor_id: string;
  agent_id: string;
  assignment_id: string | null;
  decision: SupervisionDecision;
  notes: string | null;
  created_at: string;
  supervisor?: AIAgent;
  agent?: AIAgent;
}

export interface AgentStoreMemory {
  id: string;
  agent_id: string;
  store_id: string;
  memory_type: string;
  memory_value: Record<string, unknown>;
  confidence: number;
  updated_at: string;
}

export interface AgentHandoff {
  id: string;
  from_agent_id: string;
  to_agent_id: string;
  assignment_id: string | null;
  reason: string;
  context: Record<string, unknown> | null;
  accepted: boolean;
  created_at: string;
  from_agent?: AIAgent;
  to_agent?: AIAgent;
}

export function useAIAgents(businessId?: string) {
  const queryClient = useQueryClient();

  // Fetch all agents
  const { data: agents = [], isLoading: agentsLoading } = useQuery({
    queryKey: ["ai-agents", businessId],
    queryFn: async () => {
      let query = supabase
        .from("ai_agents")
        .select("*")
        .order("role", { ascending: true });

      if (businessId) {
        query = query.or(`business_id.eq.${businessId},business_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AIAgent[];
    },
  });

  // Fetch active assignments
  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ["agent-assignments", businessId],
    queryFn: async () => {
      let query = supabase
        .from("agent_assignments")
        .select(`
          *,
          agent:ai_agents(*),
          store:store_master(id, store_name)
        `)
        .in("status", ["pending", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(50);

      if (businessId) {
        query = query.eq("business_id", businessId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AgentAssignment[];
    },
    refetchInterval: 5000,
  });

  // Fetch supervision logs
  const { data: supervisionLogs = [] } = useQuery({
    queryKey: ["supervision-logs", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_supervision_logs")
        .select(`
          *,
          supervisor:ai_agents!agent_supervision_logs_supervisor_id_fkey(*),
          agent:ai_agents!agent_supervision_logs_agent_id_fkey(*)
        `)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as SupervisionLog[];
    },
  });

  // Fetch handoff logs
  const { data: handoffLogs = [] } = useQuery({
    queryKey: ["handoff-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_handoff_logs")
        .select(`
          *,
          from_agent:ai_agents!agent_handoff_logs_from_agent_id_fkey(*),
          to_agent:ai_agents!agent_handoff_logs_to_agent_id_fkey(*)
        `)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as AgentHandoff[];
    },
  });

  // Toggle agent active status
  const toggleAgentMutation = useMutation({
    mutationFn: async ({ agentId, active }: { agentId: string; active: boolean }) => {
      const { error } = await supabase
        .from("ai_agents")
        .update({ active })
        .eq("id", agentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-agents"] });
      toast.success("Agent status updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Create assignment
  const createAssignmentMutation = useMutation({
    mutationFn: async (assignment: Partial<AgentAssignment>) => {
      const { data, error } = await supabase
        .from("agent_assignments")
        .insert({
          agent_id: assignment.agent_id!,
          business_id: assignment.business_id,
          store_id: assignment.store_id,
          task_type: assignment.task_type!,
          priority: assignment.priority || "medium",
          ai_notes: assignment.ai_notes,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-assignments"] });
      toast.success("Assignment created");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Update assignment status
  const updateAssignmentMutation = useMutation({
    mutationFn: async ({ id, status, result }: { id: string; status: AssignmentStatus; result?: Record<string, unknown> }) => {
      const updates: Record<string, unknown> = { status };
      if (status === "in_progress") updates.started_at = new Date().toISOString();
      if (status === "completed" || status === "failed") updates.completed_at = new Date().toISOString();
      if (result) updates.result = result;

      const { error } = await supabase
        .from("agent_assignments")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-assignments"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Create handoff
  const createHandoffMutation = useMutation({
    mutationFn: async (handoff: { from_agent_id: string; to_agent_id: string; assignment_id?: string; reason: string }) => {
      const { error } = await supabase
        .from("agent_handoff_logs")
        .insert(handoff);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["handoff-logs"] });
      toast.success("Task handed off");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Log supervision decision
  const logSupervisionMutation = useMutation({
    mutationFn: async (log: { supervisor_id: string; agent_id: string; assignment_id?: string; decision: SupervisionDecision; notes?: string }) => {
      const { error } = await supabase
        .from("agent_supervision_logs")
        .insert(log);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supervision-logs"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Stats
  const activeAgents = agents.filter(a => a.active);
  const supervisorAgent = agents.find(a => a.role === "supervisor");
  const pendingAssignments = assignments.filter(a => a.status === "pending");
  const inProgressAssignments = assignments.filter(a => a.status === "in_progress");

  return {
    agents,
    agentsLoading,
    assignments,
    assignmentsLoading,
    supervisionLogs,
    handoffLogs,
    toggleAgent: toggleAgentMutation.mutate,
    createAssignment: createAssignmentMutation.mutateAsync,
    updateAssignment: updateAssignmentMutation.mutate,
    createHandoff: createHandoffMutation.mutateAsync,
    logSupervision: logSupervisionMutation.mutateAsync,
    stats: {
      totalAgents: agents.length,
      activeAgents: activeAgents.length,
      hasSupervisor: !!supervisorAgent?.active,
      pendingTasks: pendingAssignments.length,
      inProgressTasks: inProgressAssignments.length,
      totalHandoffs: handoffLogs.length,
    },
  };
}
