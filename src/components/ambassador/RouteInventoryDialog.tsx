import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save } from 'lucide-react';
import { TUBE_SKU_KEYS } from '@/lib/inventory/tubeSkuKeys';
import { QUICK_COUNTS } from '@/lib/storePortal';
import { writeStoreTubeCounts } from '@/lib/inventory/writeTubeCounts';
import { invalidateStoreInventoryQueries } from '@/lib/inventory/invalidation';
import { toast } from 'sonner';
export function RouteInventoryDialog({ storeId, name, onClose }: { storeId: string; name: string; onClose: () => void }) {
 const { user }=useAuth();const qc=useQueryClient();const [draft,setDraft]=useState<Record<string,string>>({});const [saving,setSaving]=useState(false);
 const query=useQuery({queryKey:['route-stop-inventory',storeId],queryFn:async()=>{const {data,error}=await supabase.from('store_tube_inventory_status').select('brand_id,current_tubes_left,tubes_updated_at,is_active').eq('store_id',storeId).eq('is_simulation',false);if(error)throw error;return data||[];}});
 const save=async()=>{if(!user)return;const updates=Object.entries(draft).map(([brandId,value])=>({brandId,count:Number(value)}));if(!updates.length||Object.values(draft).some(v=>v.trim()==='' )||updates.some(u=>!Number.isInteger(u.count)||u.count<0)){toast.error('Enter a whole number, zero or more');return;}setSaving(true);try{await writeStoreTubeCounts({storeId,updates,actorId:user.id,actorRole:'ambassador',method:'route_visit'});invalidateStoreInventoryQueries(qc,storeId);qc.invalidateQueries({queryKey:['route-stop-inventory']});qc.invalidateQueries({queryKey:['route-stop-facts']});toast.success('Inventory saved');onClose();}catch(e){toast.error(e instanceof Error?e.message:String(e));}finally{setSaving(false);}};
 return <Dialog open onOpenChange={open=>!open&&onClose()}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Inventory · {name}</DialogTitle></DialogHeader>{query.isLoading?<Loader2 className="animate-spin"/>:query.error?<p className="text-destructive">{query.error.message}</p>:<div className="space-y-5">{TUBE_SKU_KEYS.map(b=>{const row=query.data?.find(r=>r.brand_id===b.brandId);return <div key={b.brandId} className="space-y-2"><Label htmlFor={b.brandId}>{b.brandName} · {b.brandId==='gasmask'?'bags':'tubes'} left</Label><Input id={b.brandId} type="number" inputMode="numeric" min={0} step={1} value={draft[b.brandId]??row?.current_tubes_left??''} onChange={e=>setDraft({...draft,[b.brandId]:e.target.value})}/><div className="grid grid-cols-2 gap-2">{QUICK_COUNTS.map(q=><Button key={q.value} variant="outline" size="sm" onClick={()=>setDraft({...draft,[b.brandId]:String(q.value)})}>{q.label.replace('About half box','Half box')}</Button>)}</div>{row?.tubes_updated_at&&<p className="text-xs text-muted-foreground">Counted {new Date(row.tubes_updated_at).toLocaleString()}</p>}</div>;})}<Button className="w-full" disabled={saving||!Object.keys(draft).length} onClick={save}>{saving?<Loader2 className="h-4 w-4 animate-spin"/>:<Save className="h-4 w-4"/>} Save inventory</Button></div>}</DialogContent></Dialog>;
}
