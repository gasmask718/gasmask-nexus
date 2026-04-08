import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Settings, Shield, AlertTriangle, DollarSign } from 'lucide-react';

type PlatformConfig = { id: string; config_key: string; config_value: string; updated_at: string };
type Dispute = {
  id: string; assignment_id: string; filed_by: string | null; reason: string;
  status: string; resolution: string | null; created_at: string;
};

export default function AdminControlTab() {
  const queryClient = useQueryClient();

  const { data: config = [] } = useQuery<PlatformConfig[]>({
    queryKey: ['dme-config'],
    queryFn: async () => {
      const { data } = await supabase.from('dme_platform_config').select('*');
      return (data || []) as PlatformConfig[];
    }
  });

  const { data: disputes = [] } = useQuery<Dispute[]>({
    queryKey: ['dme-disputes'],
    queryFn: async () => {
      const { data } = await supabase.from('dme_disputes').select('*').order('created_at', { ascending: false });
      return (data || []) as Dispute[];
    }
  });

  const getConfigVal = (key: string) => config.find(c => c.config_key === key)?.config_value || '';

  const updateConfig = async (key: string, value: string) => {
    await supabase.from('dme_platform_config').update({ config_value: value } as any).eq('config_key', key);
    queryClient.invalidateQueries({ queryKey: ['dme-config'] });
    toast.success(`${key} updated`);
  };

  const resolveDispute = async (id: string, resolution: string) => {
    await supabase.from('dme_disputes').update({ status: 'resolved', resolution, resolved_at: new Date().toISOString() } as any).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['dme-disputes'] });
    toast.success('Dispute resolved');
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Settings className="h-4 w-4" /> Platform Configuration</CardTitle></CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { key: 'default_platform_fee_pct', label: 'Default Platform Fee %' },
              { key: 'min_contract_days', label: 'Min Contract Duration (days)' },
              { key: 'max_platform_fee_pct', label: 'Max Platform Fee %' },
            ].map(c => (
              <ConfigCard key={c.key} label={c.label} value={getConfigVal(c.key)} onSave={(v) => updateConfig(c.key, v)} />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-yellow-400" /> Disputes ({disputes.filter(d => d.status === 'open').length} open)</CardTitle></CardHeader>
        <CardContent>
          {disputes.length === 0 ? (
            <p className="text-muted-foreground text-sm">No disputes</p>
          ) : (
            <div className="space-y-3">
              {disputes.map(d => (
                <div key={d.id} className="flex items-start justify-between p-3 rounded-lg bg-muted/30 border border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">{d.reason}</p>
                    <p className="text-xs text-muted-foreground">Filed {new Date(d.created_at).toLocaleDateString()}</p>
                    {d.resolution && <p className="text-xs text-emerald-400 mt-1">Resolution: {d.resolution}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={d.status === 'open' ? 'destructive' : d.status === 'resolved' ? 'default' : 'secondary'} className="text-xs">{d.status}</Badge>
                    {d.status === 'open' && (
                      <Button size="sm" variant="outline" onClick={() => resolveDispute(d.id, 'Reviewed and resolved by admin')}>Resolve</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ConfigCard({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);

  return (
    <div className="p-3 rounded-lg bg-muted/30 border border-border">
      <p className="text-xs text-muted-foreground mb-2">{label}</p>
      {editing ? (
        <div className="flex gap-2">
          <Input value={val} onChange={e => setVal(e.target.value)} className="h-8 text-sm" />
          <Button size="sm" onClick={() => { onSave(val); setEditing(false); }}>Save</Button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-xl font-bold text-primary">{value || '—'}</p>
          <Button size="sm" variant="ghost" onClick={() => { setVal(value); setEditing(true); }}>Edit</Button>
        </div>
      )}
    </div>
  );
}
