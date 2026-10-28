import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
export function StorePortalOnboardingCounts(){
 const {data,error}=useQuery({queryKey:['store-portal-onboarding'],queryFn:async()=>{const {data,error}=await supabase.rpc('store_portal_onboarding_counts');if(error)throw error;return data as {contacts_verified_this_week:number;stores_invited:number;stores_signed_in:number};},refetchInterval:30000});
 if(error)return <p className="text-sm text-destructive">{error.message}</p>;
 return <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-y border-border py-4" aria-label="Store onboarding"><div><p className="text-2xl font-semibold">{data?.contacts_verified_this_week??'—'}</p><p className="text-sm text-muted-foreground">Contacts verified this week</p></div><div><p className="text-2xl font-semibold">{data?.stores_invited??'—'}</p><p className="text-sm text-muted-foreground">Stores invited</p></div><div><p className="text-2xl font-semibold">{data?.stores_signed_in??'—'}</p><p className="text-sm text-muted-foreground">Stores signed in</p></div></section>;
}
