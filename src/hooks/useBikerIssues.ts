import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BikerIssue {
  id: string;
  business_id?: string;
  location_id?: string;
  reported_by_biker_id?: string;
  issue_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved' | 'dismissed';
  assigned_biker_id?: string;
  description?: string;
  photos?: string[];
  escalated: boolean;
  due_at?: string;
  escalates_at?: string;
  created_at: string;
  updated_at: string;
  location?: {
    id: string;
    name: string;
    address?: string;
    city?: string;
    boro?: string;
  };
  reporter?: {
    id: string;
    full_name: string;
  };
  assignee?: {
    id: string;
    full_name: string;
  };
}

export interface IssueEvent {
  id: string;
  issue_id: string;
  actor_user_id?: string;
  action: 'created' | 'assigned' | 'status_changed' | 'escalated' | 'resolved' | 'comment_added';
  notes?: string;
  old_value?: string;
  new_value?: string;
  created_at: string;
  actor?: {
    name: string;
  };
}

export function useBikerIssues(filters?: {
  status?: string;
  severity?: string;
  locationId?: string;
  bikerId?: string;
}) {
  return useQuery({
    queryKey: ['biker-issues', filters],
    queryFn: async () => {
      let query = supabase
        .from('biker_issues')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.severity) {
        query = query.eq('severity', filters.severity);
      }
      if (filters?.locationId) {
        query = query.eq('location_id', filters.locationId);
      }
      if (filters?.bikerId) {
        query = query.or(`reported_by_biker_id.eq.${filters.bikerId},assigned_biker_id.eq.${filters.bikerId}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as BikerIssue[];
    }
  });
}

export function useBikerIssue(issueId: string) {
  return useQuery({
    queryKey: ['biker-issue', issueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('biker_issues')
        .select('*')
        .eq('id', issueId)
        .single();
      if (error) throw error;
      return data as BikerIssue;
    },
    enabled: !!issueId
  });
}

export function useIssueEvents(issueId: string) {
  return useQuery({
    queryKey: ['issue-events', issueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('issue_events')
        .select('*')
        .eq('issue_id', issueId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as IssueEvent[];
    },
    enabled: !!issueId
  });
}

export function useCreateIssue() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (issue: Partial<BikerIssue>) => {
      const { data, error } = await supabase
        .from('biker_issues')
        .insert(issue as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['biker-issues'] });
      toast.success('Issue created');
    },
    onError: () => toast.error('Failed to create issue')
  });
}

export function useUpdateIssue() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<BikerIssue> & { id: string }) => {
      const { data, error } = await supabase
        .from('biker_issues')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['biker-issues'] });
      queryClient.invalidateQueries({ queryKey: ['biker-issue', variables.id] });
      toast.success('Issue updated');
    },
    onError: () => toast.error('Failed to update issue')
  });
}

export function useAddIssueEvent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (event: Omit<IssueEvent, 'id' | 'created_at' | 'actor'>) => {
      const { data, error } = await supabase
        .from('issue_events')
        .insert(event)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['issue-events', variables.issue_id] });
    }
  });
}

export function useAssignIssue() {
  const queryClient = useQueryClient();
  const addEvent = useAddIssueEvent();
  
  return useMutation({
    mutationFn: async ({ issueId, bikerId, userId }: { issueId: string; bikerId: string; userId?: string }) => {
      const { data: oldIssue } = await supabase
        .from('biker_issues')
        .select('assigned_biker_id')
        .eq('id', issueId)
        .single();
      
      const { error } = await supabase
        .from('biker_issues')
        .update({ 
          assigned_biker_id: bikerId,
          status: 'in_progress',
          updated_at: new Date().toISOString()
        })
        .eq('id', issueId);
      if (error) throw error;
      
      // Create event
      await addEvent.mutateAsync({
        issue_id: issueId,
        actor_user_id: userId,
        action: 'assigned',
        old_value: oldIssue?.assigned_biker_id || null,
        new_value: bikerId,
        notes: 'Biker assigned to issue'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['biker-issues'] });
      toast.success('Biker assigned to issue');
    },
    onError: () => toast.error('Failed to assign biker')
  });
}

export function useEscalateIssue() {
  const queryClient = useQueryClient();
  const addEvent = useAddIssueEvent();
  
  return useMutation({
    mutationFn: async ({ issueId, userId, notes }: { issueId: string; userId?: string; notes?: string }) => {
      const { error } = await supabase
        .from('biker_issues')
        .update({ 
          escalated: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', issueId);
      if (error) throw error;
      
      await addEvent.mutateAsync({
        issue_id: issueId,
        actor_user_id: userId,
        action: 'escalated',
        notes: notes || 'Issue escalated manually'
      });
      
      // Create internal notification
      await supabase.from('internal_notifications').insert({
        target_role: 'admin',
        title: 'Issue Escalated',
        message: notes || 'An issue requires immediate attention',
        entity_type: 'issue',
        entity_id: issueId
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['biker-issues'] });
      toast.success('Issue escalated');
    },
    onError: () => toast.error('Failed to escalate issue')
  });
}

export function useResolveIssue() {
  const queryClient = useQueryClient();
  const addEvent = useAddIssueEvent();
  
  return useMutation({
    mutationFn: async ({ issueId, userId, notes }: { issueId: string; userId?: string; notes?: string }) => {
      const { error } = await supabase
        .from('biker_issues')
        .update({ 
          status: 'resolved',
          updated_at: new Date().toISOString()
        })
        .eq('id', issueId);
      if (error) throw error;
      
      await addEvent.mutateAsync({
        issue_id: issueId,
        actor_user_id: userId,
        action: 'resolved',
        notes: notes || 'Issue resolved'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['biker-issues'] });
      toast.success('Issue resolved');
    },
    onError: () => toast.error('Failed to resolve issue')
  });
}
