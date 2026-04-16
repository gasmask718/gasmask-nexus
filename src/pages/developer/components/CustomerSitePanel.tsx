import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, ExternalLink, ArrowRight, Loader2 } from 'lucide-react';

interface Props {
  customerSiteId: string;
  customerName: string;
  userEmail: string;
}

const STATUSES = [
  { key: 'open', label: 'Open', color: 'border-yellow-400/40 bg-yellow-400/5 text-yellow-400' },
  { key: 'in_progress', label: 'In Progress', color: 'border-blue-400/40 bg-blue-400/5 text-blue-400' },
  { key: 'done', label: 'Done', color: 'border-[#00ff88]/40 bg-[#00ff88]/5 text-[#00ff88]' },
  { key: 'rejected', label: 'Rejected', color: 'border-red-400/40 bg-red-400/5 text-red-400' },
];

const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

export const CustomerSitePanel = ({ customerSiteId, customerName, userEmail }: Props) => {
  const [intake, setIntake] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState('normal');

  const load = async () => {
    setLoading(true);
    const [intakeRes, crRes] = await Promise.all([
      supabase.from('customer_intake_forms').select('*').eq('customer_site_id', customerSiteId).order('submitted_at', { ascending: false }),
      supabase.from('customer_change_requests').select('*').eq('customer_site_id', customerSiteId).order('created_at', { ascending: false }),
    ]);
    setIntake(intakeRes.data || []);
    setRequests(crRes.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [customerSiteId]);

  const addRequest = async () => {
    if (!newTitle.trim()) return;
    const { error } = await supabase.from('customer_change_requests').insert({
      customer_site_id: customerSiteId,
      title: newTitle,
      priority: newPriority,
      requested_by_email: userEmail,
      status: 'open',
    });
    if (error) { toast.error(error.message); return; }
    setNewTitle('');
    setNewPriority('normal');
    toast.success('Change request added');
    load();
  };

  const moveRequest = async (id: string, status: string) => {
    const updates: any = { status };
    if (status === 'done' || status === 'rejected') updates.resolved_at = new Date().toISOString();
    const { error } = await supabase.from('customer_change_requests').update(updates).eq('id', id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const deleteRequest = async (id: string) => {
    if (!confirm('Delete this change request?')) return;
    await supabase.from('customer_change_requests').delete().eq('id', id);
    load();
  };

  if (loading) {
    return <div className="p-4 text-[10px] text-[#555] font-mono flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin"/> Loading customer workspace...</div>;
  }

  return (
    <div className="p-4 space-y-5">
      <div>
        <div className="text-[9px] uppercase tracking-widest text-[#00ff88]/60 mb-2">Intake Forms ({intake.length})</div>
        {intake.length === 0 ? (
          <div className="text-[10px] text-[#444] font-mono border border-dashed border-[#1a1a2e] rounded p-3 text-center">
            No intake forms yet for {customerName}
          </div>
        ) : (
          <div className="space-y-2">
            {intake.map(f => (
              <div key={f.id} className="border border-[#1a1a2e] rounded p-3 bg-[#0d0d15]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase tracking-wider text-[#00ff88]">{f.form_type}</span>
                  <span className="text-[9px] text-[#555] font-mono">{new Date(f.submitted_at).toLocaleDateString()}</span>
                </div>
                <pre className="text-[10px] text-[#888] font-mono whitespace-pre-wrap max-h-40 overflow-auto bg-[#0a0a0f] rounded p-2 border border-[#111]">
                  {JSON.stringify(f.form_data, null, 2)}
                </pre>
                {f.attachments && Array.isArray(f.attachments) && f.attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {f.attachments.map((a: any, i: number) => (
                      <a key={i} href={a.url || a} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] text-[#00ff88] hover:underline">
                        <ExternalLink className="w-2.5 h-2.5"/> {a.name || `file_${i+1}`}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="text-[9px] uppercase tracking-widest text-[#00ff88]/60 mb-2">Change Request Board</div>

        <div className="flex gap-2 mb-3">
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addRequest()}
            placeholder="New change request..."
            className="flex-1 bg-[#0d0d15] border border-[#1a1a2e] rounded px-2 py-1.5 text-[11px] text-[#c8c8d0] focus:border-[#00ff88]/30 focus:outline-none"
          />
          <select
            value={newPriority}
            onChange={e => setNewPriority(e.target.value)}
            className="bg-[#0d0d15] border border-[#1a1a2e] rounded px-2 py-1.5 text-[10px] text-[#c8c8d0]"
          >
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <button onClick={addRequest} className="px-3 py-1.5 bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30 rounded text-[10px] uppercase tracking-widest hover:bg-[#00ff88]/20">
            <Plus className="w-3 h-3"/>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {STATUSES.map(s => {
            const items = requests.filter(r => r.status === s.key);
            return (
              <div key={s.key} className={`border rounded ${s.color}`}>
                <div className="px-2 py-1 border-b border-current/20 text-[9px] uppercase tracking-widest flex items-center justify-between">
                  <span>{s.label}</span>
                  <span className="opacity-60">{items.length}</span>
                </div>
                <div className="p-1.5 space-y-1.5 min-h-[80px]">
                  {items.map(r => (
                    <div key={r.id} className="bg-[#0d0d15] border border-[#1a1a2e] rounded p-2 group">
                      <div className="flex items-start justify-between gap-1">
                        <div className="text-[11px] text-[#c8c8d0] flex-1">{r.title}</div>
                        <button onClick={() => deleteRequest(r.id)} className="opacity-0 group-hover:opacity-100 text-[#555] hover:text-red-400">
                          <Trash2 className="w-2.5 h-2.5"/>
                        </button>
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[9px] uppercase tracking-wider text-[#555]">{r.priority}</span>
                        <select
                          value={r.status}
                          onChange={e => moveRequest(r.id, e.target.value)}
                          className="bg-transparent text-[9px] text-[#888] border-none cursor-pointer"
                        >
                          {STATUSES.map(st => <option key={st.key} value={st.key}>→ {st.label}</option>)}
                        </select>
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div className="text-[10px] text-[#333] text-center py-3">—</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
