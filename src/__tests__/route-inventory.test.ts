import { it, expect, vi } from 'vitest';
const upsert=vi.fn().mockResolvedValue({error:null});
vi.mock('@/integrations/supabase/client',()=>({supabase:{from:vi.fn(()=>({upsert}))}}));
import { writeStoreTubeCounts } from '../lib/inventory/writeTubeCounts';
it('route observations use canonical tubes/bags keys with route_visit attribution',async()=>{
 await writeStoreTubeCounts({storeId:'test-store',actorId:'test-owner',actorRole:'ambassador',method:'route_visit',updates:[{brandId:'gasmasktubes',count:18},{brandId:'gasmask',count:7}]});
 expect(upsert).toHaveBeenCalledWith([expect.objectContaining({brand_id:'gasmasktubes',current_tubes_left:18,last_updated_method:'route_visit',last_updated_by:'test-owner',is_simulation:false}),expect.objectContaining({brand_id:'gasmask',current_tubes_left:7,last_updated_method:'route_visit'})],{onConflict:'store_id,brand_id,is_simulation'});
});
