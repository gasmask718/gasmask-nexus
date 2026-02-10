/**
 * Floor 10.1 — Human Review Queue (Denied Intents Only)
 * VISIBILITY ONLY. No approve, no retry, no permission toggles.
 * Human actions: acknowledge, annotate, export.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { RefreshCw, Eye, Download, MessageSquare, CheckCircle, Search } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface DeniedIntent {
  id: string;
  created_at: string;
  action_key: string;
  neighborhood_id: string | null;
  ai_agent: string | null;
  blocked_reason: string | null;
  permission_source: string | null;
  enforcement_source: string | null;
  decision_payload: any;
  actor: string | null;
  // Local state
  acknowledged?: boolean;
  annotation?: string;
}

export default function AIReviewQueuePage() {
  const [denials, setDenials] = useState<DeniedIntent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [annotatingId, setAnnotatingId] = useState<string | null>(null);
  const [annotationText, setAnnotationText] = useState('');
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());
  const [annotations, setAnnotations] = useState<Record<string, string>>({});

  const fetchDenials = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ai_decision_log')
        .select('*')
        .eq('permission_allowed', false)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      setDenials(data || []);
    } catch (err) {
      console.error('Failed to fetch review queue:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDenials(); }, [fetchDenials]);

  function handleAcknowledge(id: string) {
    setAcknowledged(prev => new Set([...prev, id]));
    toast.success('Denial acknowledged');
  }

  function handleSaveAnnotation() {
    if (annotatingId && annotationText.trim()) {
      setAnnotations(prev => ({ ...prev, [annotatingId]: annotationText.trim() }));
      toast.success('Annotation saved');
    }
    setAnnotatingId(null);
    setAnnotationText('');
  }

  function handleExport() {
    const exportData = filteredDenials.map(d => ({
      Timestamp: new Date(d.created_at).toISOString(),
      Action: d.action_key,
      Neighborhood: d.neighborhood_id || '',
      Agent: d.ai_agent || '',
      Reason: d.blocked_reason || '',
      Source: d.permission_source || '',
      Enforcement: d.enforcement_source || '',
      Acknowledged: acknowledged.has(d.id) ? 'Yes' : 'No',
      Annotation: annotations[d.id] || '',
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, 'Denied Intents');
    XLSX.writeFile(wb, `AI_Review_Queue_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Exported review queue');
  }

  const filteredDenials = denials.filter(d => {
    if (!search) return true;
    const s = search.toLowerCase();
    return d.action_key?.toLowerCase().includes(s) ||
      d.blocked_reason?.toLowerCase().includes(s) ||
      d.ai_agent?.toLowerCase().includes(s) ||
      d.neighborhood_id?.toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Eye className="h-6 w-6 text-primary" />
            Floor 10.1 — Human Review Queue
          </h1>
          <p className="text-muted-foreground mt-1">
            Denied AI intents for human visibility. No approvals, no retries.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchDenials} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-sm text-muted-foreground">Total Denied</p>
            <p className="text-2xl font-bold">{denials.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-sm text-muted-foreground">Acknowledged</p>
            <p className="text-2xl font-bold">{acknowledged.size}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-sm text-muted-foreground">Annotated</p>
            <p className="text-2xl font-bold">{Object.keys(annotations).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-sm text-muted-foreground">Unreviewed</p>
            <p className="text-2xl font-bold">{denials.length - acknowledged.size}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by action, reason, agent, neighborhood..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {filteredDenials.length === 0 ? (
            <p className="text-muted-foreground text-sm py-12 text-center">No denied intents found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left bg-muted/30">
                    <th className="p-3 font-medium">Timestamp</th>
                    <th className="p-3 font-medium">Action</th>
                    <th className="p-3 font-medium">Neighborhood</th>
                    <th className="p-3 font-medium">Denial Reason</th>
                    <th className="p-3 font-medium">Commitment Type</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDenials.map(d => (
                    <tr key={d.id} className="border-b border-muted/50 hover:bg-muted/20">
                      <td className="p-3 text-xs">{new Date(d.created_at).toLocaleString()}</td>
                      <td className="p-3 font-mono text-xs">{d.action_key}</td>
                      <td className="p-3 font-mono text-xs">{d.neighborhood_id?.slice(0, 8) || '—'}</td>
                      <td className="p-3 text-xs">{d.blocked_reason || '—'}</td>
                      <td className="p-3"><Badge variant="outline" className="text-xs">{d.permission_source || '—'}</Badge></td>
                      <td className="p-3">
                        {acknowledged.has(d.id) ? (
                          <Badge variant="secondary" className="gap-1"><CheckCircle className="h-3 w-3" /> Acked</Badge>
                        ) : annotations[d.id] ? (
                          <Badge variant="secondary" className="gap-1"><MessageSquare className="h-3 w-3" /> Noted</Badge>
                        ) : (
                          <Badge variant="outline">Pending</Badge>
                        )}
                      </td>
                      <td className="p-3 text-right space-x-1">
                        {!acknowledged.has(d.id) && (
                          <Button variant="ghost" size="sm" onClick={() => handleAcknowledge(d.id)}>
                            <CheckCircle className="h-3 w-3" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => {
                          setAnnotatingId(d.id);
                          setAnnotationText(annotations[d.id] || '');
                        }}>
                          <MessageSquare className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Annotation Dialog */}
      <Dialog open={!!annotatingId} onOpenChange={open => { if (!open) setAnnotatingId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Annotate Denied Intent</DialogTitle>
          </DialogHeader>
          <Textarea
            value={annotationText}
            onChange={e => setAnnotationText(e.target.value)}
            placeholder="Add your notes about this denied intent..."
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnnotatingId(null)}>Cancel</Button>
            <Button onClick={handleSaveAnnotation}>Save Annotation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
