import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { X, Save, CheckCircle, XCircle, Clock, MessageSquare, FileJson, ExternalLink, Globe } from 'lucide-react';
import { CustomerSitePanel } from './CustomerSitePanel';

interface Props {
  row: any;
  table: string;
  funnelKey: string;
  userEmail: string;
  onClose: () => void;
  onSaved: () => void;
}

const QA_STATUSES = [
  { key: 'pending', label: 'Pending', color: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10', icon: Clock },
  { key: 'passed', label: 'Passed', color: 'text-[#00ff88] border-[#00ff88]/30 bg-[#00ff88]/10', icon: CheckCircle },
  { key: 'flagged', label: 'Flagged', color: 'text-red-400 border-red-400/30 bg-red-400/10', icon: XCircle },
];

export const DevRowDrawer = ({ row, table, funnelKey, userEmail, onClose, onSaved }: Props) => {
  const isCustomerSite = table === 'customer_sites';
  const [formData, setFormData] = useState<Record<string, any>>({ ...row });
  const [saving, setSaving] = useState(false);
  const [qaStatus, setQaStatus] = useState('pending');
  const [qaNote, setQaNote] = useState('');
  const [activeTab, setActiveTab] = useState<'fields' | 'json' | 'qa' | 'workspace'>(isCustomerSite ? 'workspace' : 'fields');

  useEffect(() => {
    // Fetch QA tag
    (async () => {
      const { data } = await supabase
        .from('developer_qa_tags')
        .select('*')
        .eq('lead_id', row.id)
        .eq('funnel_source', funnelKey)
        .maybeSingle();
      if (data) {
        setQaStatus(data.qa_status || 'pending');
        setQaNote((data as any).notes || '');
      }
    })();
  }, [row.id, funnelKey]);

  const handleSave = async () => {
    setSaving(true);
    const { id, created_at, ...updates } = formData;
    const { error } = await supabase.from(table as any).update(updates).eq('id', id);
    if (error) { toast.error(error.message); setSaving(false); return; }

    await supabase.from('developer_audit_log').insert({
      action: 'UPDATE', actor_email: userEmail, target_table: table, target_id: id,
      details: { changed_fields: Object.keys(updates) } as any,
    });
    toast.success('Record updated');
    setSaving(false);
    onSaved();
  };

  const handleQaSave = async () => {
    const existing = await supabase
      .from('developer_qa_tags')
      .select('id')
      .eq('lead_id', row.id)
      .eq('funnel_source', funnelKey)
      .maybeSingle();

    if (existing.data) {
      await supabase.from('developer_qa_tags').update({
        qa_status: qaStatus, tester_email: userEmail, tested_at: new Date().toISOString(),
      }).eq('id', existing.data.id);
    } else {
      await supabase.from('developer_qa_tags').insert({
        lead_id: row.id, funnel_source: funnelKey, qa_status: qaStatus,
        tester_email: userEmail, tested_at: new Date().toISOString(),
      });
    }
    await supabase.from('developer_audit_log').insert({
      action: `QA_${qaStatus.toUpperCase()}`, actor_email: userEmail,
      target_table: table, target_id: row.id,
    });
    toast.success(`QA: ${qaStatus}`);
  };

  const editableKeys = Object.keys(row).filter(k => !['id', 'created_at'].includes(k));

  return (
    <div className="fixed inset-0 z-[90] flex items-stretch justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-[520px] bg-[#0b0b14] border-l border-[#1a1a2e] flex flex-col shadow-2xl shadow-black/60">
        {/* Header */}
        <div className="border-b border-[#1a1a2e] px-4 py-3 flex items-center justify-between shrink-0 bg-[#0d0d15]">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[#00ff88]">Record Inspector</div>
            <div className="text-[10px] text-[#444] mt-0.5 font-mono">{table} / {row.id?.slice(0, 12)}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30 rounded text-[10px] uppercase tracking-widest hover:bg-[#00ff88]/20 transition-colors disabled:opacity-50"
            >
              <Save className="w-3 h-3" /> {saving ? 'Saving' : 'Save'}
            </button>
            <button onClick={onClose} className="p-1.5 text-[#555] hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Drawer Tabs */}
        <div className="flex border-b border-[#1a1a2e] shrink-0">
          {[
            { key: 'fields' as const, label: 'Fields', icon: MessageSquare },
            { key: 'json' as const, label: 'JSON', icon: FileJson },
            { key: 'qa' as const, label: 'QA', icon: CheckCircle },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] uppercase tracking-widest transition-colors ${
                activeTab === t.key
                  ? 'text-[#00ff88] border-b-2 border-[#00ff88] bg-[#1a1a2e]/50'
                  : 'text-[#555] hover:text-[#888]'
              }`}
            >
              <t.icon className="w-3 h-3" /> {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {activeTab === 'fields' && (
            <div className="p-4 space-y-3">
              <div>
                <label className="text-[9px] uppercase tracking-widest text-[#555] block mb-1">id (read-only)</label>
                <input disabled value={row.id} className="w-full bg-[#0a0a0f] border border-[#1a1a2e] rounded px-3 py-1.5 text-[11px] text-[#444] font-mono" />
              </div>
              {editableKeys.map(key => {
                const val = formData[key];
                const isJson = typeof val === 'object' && val !== null;
                return (
                  <div key={key}>
                    <label className="text-[9px] uppercase tracking-widest text-[#555] block mb-1">
                      {key.replace(/_/g, ' ')}
                    </label>
                    {isJson ? (
                      <textarea
                        value={JSON.stringify(val, null, 2)}
                        onChange={e => {
                          try { setFormData({ ...formData, [key]: JSON.parse(e.target.value) }); } catch {}
                        }}
                        rows={4}
                        className="w-full bg-[#0d0d15] border border-[#1a1a2e] rounded px-3 py-1.5 text-[11px] text-[#c8c8d0] font-mono focus:border-[#00ff88]/30 focus:outline-none resize-y"
                      />
                    ) : (
                      <input
                        value={val ?? ''}
                        onChange={e => setFormData({ ...formData, [key]: e.target.value || null })}
                        className="w-full bg-[#0d0d15] border border-[#1a1a2e] rounded px-3 py-1.5 text-[11px] text-[#c8c8d0] font-mono focus:border-[#00ff88]/30 focus:outline-none"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'json' && (
            <div className="p-4">
              <pre className="bg-[#0a0a0f] border border-[#1a1a2e] rounded p-3 text-[10px] text-[#888] font-mono overflow-auto whitespace-pre-wrap leading-relaxed">
                {JSON.stringify(row, null, 2)}
              </pre>
            </div>
          )}

          {activeTab === 'qa' && (
            <div className="p-4 space-y-4">
              <div>
                <label className="text-[9px] uppercase tracking-widest text-[#555] block mb-2">QA Status</label>
                <div className="flex gap-2">
                  {QA_STATUSES.map(s => {
                    const Icon = s.icon;
                    return (
                      <button
                        key={s.key}
                        onClick={() => setQaStatus(s.key)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded border text-[10px] uppercase tracking-widest transition-all ${
                          qaStatus === s.key ? s.color : 'text-[#555] border-[#2a2a3e] hover:border-[#3a3a4e]'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" /> {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-widest text-[#555] block mb-1">QA Notes</label>
                <textarea
                  value={qaNote}
                  onChange={e => setQaNote(e.target.value)}
                  rows={4}
                  placeholder="Add testing notes..."
                  className="w-full bg-[#0d0d15] border border-[#1a1a2e] rounded px-3 py-2 text-[11px] text-[#c8c8d0] font-mono focus:border-[#00ff88]/30 focus:outline-none resize-y placeholder:text-[#333]"
                />
              </div>
              <button
                onClick={handleQaSave}
                className="w-full py-2 bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30 rounded text-[10px] uppercase tracking-widest hover:bg-[#00ff88]/20 transition-colors"
              >
                Save QA Status
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
