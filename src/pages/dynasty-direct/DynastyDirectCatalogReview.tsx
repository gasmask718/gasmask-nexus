import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, Loader2, ShieldAlert, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PendingDraft {
  id: string;
  product_name: string;
  supplier_id: string | null;
  created_by: string | null;
  created_at: string;
  cost: number | null;
  selected: any;
  copy: any;
  pricing: any;
  weight_oz: number | null;
  dimensions: any;
  measurements_verified_at: string | null;
  supplier_name?: string;
}

export default function DynastyDirectCatalogReview() {
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<PendingDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('dd_catalog_drafts')
      .select('id, product_name, supplier_id, created_by, created_at, cost, selected, copy, pricing, weight_oz, dimensions, measurements_verified_at')
      .eq('status', 'pending_admin_review')
      .order('created_at', { ascending: false });
    if (error) { toast.error(error.message); setLoading(false); return; }
    const rows = (data || []) as PendingDraft[];

    const ids = Array.from(new Set(rows.map((r) => r.supplier_id).filter(Boolean) as string[]));
    if (ids.length) {
      const { data: ws } = await supabase
        .from('wholesaler_profiles')
        .select('id, company_name')
        .in('id', ids);
      const map = new Map((ws || []).map((w: any) => [w.id, w.company_name]));
      rows.forEach((r) => { r.supplier_name = r.supplier_id ? map.get(r.supplier_id) || '(unknown)' : '(none)'; });
    }
    setDrafts(rows);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function approve(draft: PendingDraft) {
    if (!draft.supplier_id) { toast.error('Cannot approve: no wholesaler attached'); return; }
    setBusyId(draft.id);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke('dd-catalog-pipeline', {
        body: { mode: 'publish', draft_id: draft.id, confirmed_by: userRes.user?.id ?? null },
      });
      if (error) throw error;
      if (!(data as any)?.ok) throw new Error((data as any)?.error || 'publish failed');
      toast.success(`Approved → live · product ${(data as any).product_id?.slice(0, 8)}`);
      await load();
    } catch (e: any) {
      toast.error(`Approve failed: ${e.message}`);
    } finally { setBusyId(null); }
  }

  async function reject(draft: PendingDraft) {
    const reason = (rejectNotes[draft.id] || '').trim();
    if (!reason) { toast.error('Add a reason before rejecting'); return; }
    setBusyId(draft.id);
    try {
      const { error } = await supabase
        .from('dd_catalog_drafts')
        .update({ status: 'rejected', notes: reason })
        .eq('id', draft.id);
      if (error) throw error;
      toast.success('Returned to wholesaler with reason');
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusyId(null); }
  }

  return (
    <div className="min-h-screen bg-background p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dynasty-direct')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Dynasty Direct
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-primary" /> Catalog Review Queue
          </h1>
          <p className="text-sm text-muted-foreground">Wholesaler self-serve submissions waiting on David's exactness gate.</p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading queue…</div>
      )}

      {!loading && drafts.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Queue is empty.</CardContent></Card>
      )}

      <div className="space-y-4">
        {drafts.map((d) => {
          const hero = Array.isArray(d.selected) && d.selected[0]
            ? (typeof d.selected[0] === 'string' ? d.selected[0] : d.selected[0]?.url)
            : null;
          return (
            <Card key={d.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="flex items-center gap-2">
                    {d.product_name}
                    <Badge variant={d.supplier_id ? 'default' : 'destructive'} className="text-xs">
                      {d.supplier_name || '(no wholesaler)'}
                    </Badge>
                  </span>
                  <span className="text-xs text-muted-foreground font-normal">
                    submitted {new Date(d.created_at).toLocaleString()}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-4">
                  {hero ? (
                    <img src={hero} alt="" className="w-40 h-40 object-contain bg-muted rounded border" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-40 h-40 bg-muted rounded border flex items-center justify-center text-xs text-muted-foreground">no hero</div>
                  )}
                  <div className="space-y-2 text-sm">
                    <div className="font-medium">{d.copy?.title || d.product_name}</div>
                    <div className="text-muted-foreground">{d.copy?.short_description}</div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline">retail ${d.pricing?.suggested_retail ?? '?'}</Badge>
                      <Badge variant="outline">store ${d.pricing?.suggested_store ?? '?'}</Badge>
                      <Badge variant="outline">wholesale ${d.pricing?.suggested_wholesale ?? '?'}</Badge>
                      <Badge variant="outline">cost ${d.cost ?? '?'}</Badge>
                      <Badge variant={d.measurements_verified_at ? 'default' : 'destructive'}>
                        {d.measurements_verified_at ? 'measurements ✓' : 'measurements unverified'}
                      </Badge>
                      {d.weight_oz != null && <Badge variant="outline">{d.weight_oz} oz</Badge>}
                    </div>
                    <code className="text-[10px] text-muted-foreground">draft {d.id.slice(0, 8)} · wholesaler {d.supplier_id?.slice(0, 8) || '—'}</code>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 border-t pt-3">
                  <Textarea
                    placeholder="Rejection reason (sent back to wholesaler)…"
                    value={rejectNotes[d.id] || ''}
                    onChange={(e) => setRejectNotes((s) => ({ ...s, [d.id]: e.target.value }))}
                    rows={2}
                  />
                  <div className="flex gap-2 items-end">
                    <Button variant="destructive" onClick={() => reject(d)} disabled={busyId === d.id}>
                      <XCircle className="h-4 w-4 mr-1" /> Reject
                    </Button>
                    <Button onClick={() => approve(d)} disabled={busyId === d.id || !d.supplier_id || !d.measurements_verified_at}>
                      {busyId === d.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                      Approve → Live
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
