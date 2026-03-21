import { useState, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AgentConfig {
  id: string;
  name: string;
  type: 'arabic_specialist' | 'english_standard' | 'spanish_specialist' | 'general';
  language: string;
  greeting_style: string;
  max_concurrent: number;
  active_calls: number;
  color: string;
}

export interface ActiveCallSession {
  session_id: string;
  lead_id: string;
  store_name: string;
  phone: string;
  agent: AgentConfig;
  elevenlabs_call_id: string | null;
  started_at: string;
  status: 'dialing' | 'connected' | 'completed' | 'failed' | 'no_answer';
  duration_seconds: number;
  language_detected: string | null;
  transcript_preview: string | null;
  outcome: string | null;
}

const DEFAULT_AGENTS: AgentConfig[] = [
  {
    id: 'arabic-1',
    name: 'Arabic Specialist',
    type: 'arabic_specialist',
    language: 'arabic',
    greeting_style: 'Salam alaikum',
    max_concurrent: 3,
    active_calls: 0,
    color: 'green',
  },
  {
    id: 'english-1',
    name: 'English Standard',
    type: 'english_standard',
    language: 'english',
    greeting_style: 'Good morning / afternoon',
    max_concurrent: 5,
    active_calls: 0,
    color: 'blue',
  },
  {
    id: 'spanish-1',
    name: 'Spanish Specialist',
    type: 'spanish_specialist',
    language: 'spanish',
    greeting_style: 'Hola, buenos días',
    max_concurrent: 2,
    active_calls: 0,
    color: 'amber',
  },
  {
    id: 'general-1',
    name: 'General Agent',
    type: 'general',
    language: 'english',
    greeting_style: 'Hi there',
    max_concurrent: 5,
    active_calls: 0,
    color: 'purple',
  },
];

export function useCallCenterSession() {
  const [sessions, setSessions] = useState<ActiveCallSession[]>([]);
  const [agents, setAgents] = useState<AgentConfig[]>(DEFAULT_AGENTS);
  const [isRunning, setIsRunning] = useState(false);
  const [totalCallsToday, setTotalCallsToday] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [totalInterested, setTotalInterested] = useState(0);
  const queueRef = useRef<any[]>([]);
  const runningRef = useRef(false);

  const activeSessions = useMemo(
    () => sessions.filter(s => s.status === 'dialing' || s.status === 'connected'),
    [sessions]
  );

  const completedSessions = useMemo(
    () => sessions.filter(s => s.status === 'completed' || s.status === 'failed' || s.status === 'no_answer'),
    [sessions]
  );

  const getTotalActiveCalls = useCallback(
    () => activeSessions.length,
    [activeSessions]
  );

  const getTotalMaxConcurrent = useCallback(
    () => agents.reduce((sum, a) => sum + a.max_concurrent, 0),
    [agents]
  );

  const selectAgentForLead = useCallback((lead: any, availableAgents: AgentConfig[]): AgentConfig | null => {
    const lang = (lead.language_detected || '').toLowerCase();

    if (lang === 'arabic') {
      const a = availableAgents.find(a => a.type === 'arabic_specialist' && a.active_calls < a.max_concurrent);
      if (a) return a;
    }
    if (lang === 'spanish') {
      const a = availableAgents.find(a => a.type === 'spanish_specialist' && a.active_calls < a.max_concurrent);
      if (a) return a;
    }

    return availableAgents
      .filter(a => a.active_calls < a.max_concurrent)
      .sort((a, b) => {
        if (a.type === 'english_standard') return -1;
        if (b.type === 'english_standard') return 1;
        return a.active_calls - b.active_calls;
      })[0] || null;
  }, []);

  const launchCall = useCallback(async (lead: any, agent: AgentConfig) => {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const newSession: ActiveCallSession = {
      session_id: sessionId,
      lead_id: lead.id,
      store_name: lead.store_name || lead.name || 'Unknown',
      phone: lead.phone,
      agent,
      elevenlabs_call_id: null,
      started_at: new Date().toISOString(),
      status: 'dialing',
      duration_seconds: 0,
      language_detected: lead.language_detected || null,
      transcript_preview: null,
      outcome: null,
    };

    setSessions(prev => [...prev, newSession]);
    setAgents(prev => prev.map(a =>
      a.id === agent.id ? { ...a, active_calls: a.active_calls + 1 } : a
    ));

    try {
      const { data, error } = await supabase.functions.invoke('initiate-call', {
        body: {
          lead_id: lead.id,
          phone: lead.phone,
          store_name: lead.store_name || lead.name,
          contact_name: lead.contact_name || lead.name,
          language: lead.language_detected || agent.language,
          agent_type: agent.type,
          session_id: sessionId,
        },
      });

      if (error) throw error;

      setSessions(prev => prev.map(s =>
        s.session_id === sessionId
          ? { ...s, elevenlabs_call_id: data?.call_id || null, status: 'connected' }
          : s
      ));
      setTotalCallsToday(prev => prev + 1);
    } catch (e: any) {
      setSessions(prev => prev.map(s =>
        s.session_id === sessionId ? { ...s, status: 'failed' } : s
      ));
      console.error('Call launch failed:', e.message);
    } finally {
      setAgents(prev => prev.map(a =>
        a.id === agent.id ? { ...a, active_calls: Math.max(0, a.active_calls - 1) } : a
      ));
    }
  }, []);

  const startCallCenterSession = useCallback(async (leads: any[]) => {
    if (!leads.length) return;
    queueRef.current = [...leads];
    runningRef.current = true;
    setIsRunning(true);
    toast.success(`Call center session started — ${leads.length} leads in queue`);

    const processQueue = async () => {
      while (runningRef.current && queueRef.current.length > 0) {
        const maxConcurrent = agents.reduce((sum, a) => sum + a.max_concurrent, 0);
        // Check active from sessions state - use ref-safe approach
        const slotsAvailable = Math.max(0, maxConcurrent - 3); // conservative

        if (slotsAvailable <= 0) {
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }

        const callsToLaunch = Math.min(slotsAvailable, queueRef.current.length, 3);

        for (let i = 0; i < callsToLaunch; i++) {
          const lead = queueRef.current.shift();
          if (!lead) break;
          const agent = selectAgentForLead(lead, agents);
          if (agent) {
            launchCall(lead, agent);
          }
        }

        await new Promise(r => setTimeout(r, 1500));
      }

      if (queueRef.current.length === 0) {
        runningRef.current = false;
        setIsRunning(false);
        toast.info('Call center session completed — queue empty');
      }
    };

    processQueue();
  }, [agents, selectAgentForLead, launchCall]);

  const stopSession = useCallback(() => {
    runningRef.current = false;
    setIsRunning(false);
    queueRef.current = [];
    toast.info('Call center session stopped');
  }, []);

  const updateSessionOutcome = useCallback((sessionId: string, outcome: string, transcript?: string) => {
    setSessions(prev => prev.map(s =>
      s.session_id === sessionId
        ? { ...s, status: 'completed', outcome, transcript_preview: transcript?.slice(0, 120) || null }
        : s
    ));
    if (outcome === 'answered' || outcome === 'interested') setTotalAnswered(p => p + 1);
    if (outcome === 'interested') setTotalInterested(p => p + 1);
  }, []);

  return {
    sessions,
    activeSessions,
    completedSessions,
    agents,
    setAgents,
    isRunning,
    totalCallsToday,
    totalAnswered,
    totalInterested,
    getTotalActiveCalls,
    getTotalMaxConcurrent,
    startCallCenterSession,
    stopSession,
    updateSessionOutcome,
    queueLength: queueRef.current.length,
  };
}
