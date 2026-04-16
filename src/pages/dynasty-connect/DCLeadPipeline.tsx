import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Flame, Eye, ArrowRight, GripVertical } from 'lucide-react';

const STAGES = [
  { key: 'hot', label: '🔥 Hot Leads', color: 'border-red-500/50 bg-red-500/5' },
  { key: 'warm', label: '🟡 Warm Leads', color: 'border-yellow-500/50 bg-yellow-500/5' },
  { key: 'followup', label: '🟠 Follow-up', color: 'border-orange-500/50 bg-orange-500/5' },
  { key: 'won', label: '✅ Closed Won', color: 'border-green-500/50 bg-green-500/5' },
  { key: 'lost', label: '❌ Archived', color: 'border-muted bg-muted/20' },
];

export default function DCLeadPipeline() {
  const qc = useQueryClient();
  const [selectedLead, setSelectedLead] = useState<any>(null);

  const { data: pipeline = [] } = useQuery({
    queryKey: ['dynasty-lead-pipeline'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('dynasty_lead_pipeline').select('*').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: analyses = [] } = useQuery({
    queryKey: ['dynasty-pipeline-analyses'],
    queryFn: async () => {
      const callIds = pipeline.map((p: any) => p.call_id).filter(Boolean);
      if (!callIds.length) return [];
      const { data } = await (supabase as any).from('dynasty_call_analysis').select('*').in('call_id', callIds);
      return data || [];
    },
    enabled: pipeline.length > 0,
  });

  useEffect(() => {
    const channel = supabase.channel('dc-pipeline')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dynasty_lead_pipeline' }, () => {
        qc.invalidateQueries({ queryKey: ['dynasty-lead-pipeline'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const updateStage = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const updates: any = { stage };
      if (stage === 'won') updates.won_at = new Date().toISOString();
      if (stage === 'lost') updates.lost_at = new Date().toISOString();
      const { error } = await (supabase as any).from('dynasty_lead_pipeline').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dynasty-lead-pipeline'] }); toast.success('Stage updated'); },
  });

  const analysisMap = analyses.reduce((acc: any, a: any) => { acc[a.call_id] = a; return acc; }, {});

  const getLeadsByStage = (stage: string) => pipeline.filter((p: any) => p.stage === stage);

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">🔥 Lead Pipeline</h1><p className="text-sm text-muted-foreground">Auto-populated from AI call analysis</p></div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3">
        {STAGES.map(s => (
          <Card key={s.key}><CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{getLeadsByStage(s.key).length}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </CardContent></Card>
        ))}
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {STAGES.map(stage => (
          <div key={stage.key} className={`rounded-lg border p-3 ${stage.color} min-h-[300px]`}>
            <h3 className="text-sm font-bold mb-3">{stage.label} ({getLeadsByStage(stage.key).length})</h3>
            <div className="space-y-2">
              {getLeadsByStage(stage.key).map((lead: any) => {
                const analysis = analysisMap[lead.call_id];
                return (
                  <Card key={lead.id} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="p-3">
                      <p className="font-medium text-sm">{lead.company_name || lead.contact_name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">{lead.contact_name}</p>
                      <p className="font-mono text-xs text-muted-foreground mt-1">{lead.phone_number}</p>
                      {analysis && <Badge variant="outline" className="mt-1 text-xs">{analysis.overall_score}/10</Badge>}
                      <div className="flex gap-1 mt-2">
                        <Button size="sm" variant="ghost" className="h-6 text-xs flex-1" onClick={() => setSelectedLead({ ...lead, analysis })}><Eye className="h-3 w-3 mr-1" /> View</Button>
                        {stage.key !== 'won' && stage.key !== 'lost' && (
                          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => {
                            const nextStage = stage.key === 'hot' ? 'followup' : stage.key === 'warm' ? 'followup' : stage.key === 'followup' ? 'won' : 'won';
                            updateStage.mutate({ id: lead.id, stage: nextStage });
                          }}><ArrowRight className="h-3 w-3" /></Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Detail Modal */}
      <Dialog open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
        <DialogContent className="max-w-lg">
          {selectedLead && (
            <>
              <DialogHeader><DialogTitle>{selectedLead.company_name || selectedLead.contact_name}</DialogTitle></DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">Contact:</span> {selectedLead.contact_name}</div>
                  <div><span className="text-muted-foreground">Phone:</span> {selectedLead.phone_number}</div>
                  <div><span className="text-muted-foreground">Business:</span> {selectedLead.business_unit}</div>
                  <div><span className="text-muted-foreground">Stage:</span> <Badge>{selectedLead.stage}</Badge></div>
                </div>
                {selectedLead.analysis && (
                  <Card><CardContent className="pt-4">
                    <p className="font-medium mb-2">AI Analysis (Score: {selectedLead.analysis.overall_score}/10)</p>
                    {selectedLead.analysis.specific_coaching && <p className="text-sm text-muted-foreground">{selectedLead.analysis.specific_coaching}</p>}
                    {selectedLead.analysis.recommended_followup && <p className="text-sm mt-2"><span className="font-medium">Follow-up:</span> {selectedLead.analysis.recommended_followup}</p>}
                    {selectedLead.analysis.callback_timing && <p className="text-sm"><span className="font-medium">Best Time:</span> {selectedLead.analysis.callback_timing}</p>}
                  </CardContent></Card>
                )}
                <div className="flex gap-2">
                  {STAGES.filter(s => s.key !== selectedLead.stage).map(s => (
                    <Button key={s.key} size="sm" variant="outline" onClick={() => { updateStage.mutate({ id: selectedLead.id, stage: s.key }); setSelectedLead(null); }}>
                      Move to {s.label}
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
