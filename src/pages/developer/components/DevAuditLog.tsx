import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Terminal } from 'lucide-react';

interface LogEntry {
  id: string;
  action: string;
  actor_email: string;
  target_table: string | null;
  target_id: string | null;
  details: any;
  created_at: string;
}

export const DevAuditLog = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    fetchLogs();
    const channel = supabase
      .channel('dev-audit')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'developer_audit_log' }, () => fetchLogs())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchLogs = async () => {
    const { data } = await supabase
      .from('developer_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) setLogs(data);
  };

  const actionColor = (a: string) => {
    if (a.includes('DELETE')) return 'text-red-400';
    if (a.includes('KILL')) return 'text-orange-400';
    if (a.includes('QA_PASSED')) return 'text-[#00ff88]';
    if (a.includes('QA_FLAGGED')) return 'text-red-400';
    if (a.includes('UPDATE')) return 'text-blue-400';
    return 'text-[#888]';
  };

  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="p-2 font-mono text-[10px]">
      <div className="flex items-center gap-1.5 px-1 py-2 text-[9px] uppercase tracking-widest text-[#555]">
        <Terminal className="w-3 h-3" /> Developer Activity Log
      </div>
      <div className="space-y-0.5">
        {logs.map(log => (
          <div key={log.id} className="px-2 py-1.5 hover:bg-[#1a1a2e]/30 rounded transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-[#333]">{timeAgo(log.created_at)}</span>
              <span className={`font-bold ${actionColor(log.action)}`}>{log.action}</span>
            </div>
            <div className="text-[#444] mt-0.5">
              {log.actor_email?.split('@')[0]} → {log.target_table || '—'}
              {log.target_id ? ` / ${log.target_id.slice(0, 8)}` : ''}
            </div>
          </div>
        ))}
        {logs.length === 0 && (
          <div className="text-[#333] text-center py-6">No activity recorded yet</div>
        )}
      </div>
    </div>
  );
};
