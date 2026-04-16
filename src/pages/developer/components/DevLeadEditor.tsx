import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { X, Save } from 'lucide-react';

interface Props {
  row: any;
  table: string;
  userEmail: string;
  onClose: () => void;
  onSaved: () => void;
}

export const DevLeadEditor = ({ row, table, userEmail, onClose, onSaved }: Props) => {
  const [formData, setFormData] = useState<Record<string, any>>({ ...row });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const { id, ...updates } = formData;
    // Remove non-editable fields
    delete updates.created_at;

    const { error } = await supabase.from(table as any).update(updates).eq('id', id);
    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }

    await supabase.from('developer_audit_log').insert({
      action: 'UPDATE',
      actor_email: userEmail,
      target_table: table,
      target_id: id,
      details: { changed_fields: Object.keys(updates) } as any,
    });

    toast.success('Record updated');
    setSaving(false);
    onSaved();
  };

  const editableKeys = Object.keys(row).filter(k => !['id', 'created_at'].includes(k));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-[480px] h-full bg-[#0b0b14] border-l border-[#1a1a2e] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#0d0d15] border-b border-[#1a1a2e] px-4 py-3 flex items-center justify-between z-10">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[#00ff88]">Edit Record</div>
            <div className="text-[10px] text-[#444] mt-0.5">{table} / {row.id?.slice(0, 8)}</div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30 rounded text-[10px] uppercase tracking-widest hover:bg-[#00ff88]/20 transition-colors disabled:opacity-50"
            >
              <Save className="w-3 h-3" /> {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={onClose} className="p-1.5 text-[#555] hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Fields */}
        <div className="p-4 space-y-3">
          {/* ID (read-only) */}
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
                      try {
                        setFormData({ ...formData, [key]: JSON.parse(e.target.value) });
                      } catch { /* invalid JSON, keep typing */ }
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
      </div>
    </div>
  );
};
