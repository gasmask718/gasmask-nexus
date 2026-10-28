// Reuses the app's existing browser-only key endpoint; never loads Places.
let loader: Promise<any> | null = null;
export function loadRouteGoogleMap(): Promise<any> {
 if(loader)return loader;
 loader=(async()=>{
  const existing=(window as any).google;if(existing?.maps?.Map)return existing;
  const response=await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-maps-browser-key`);
  if(!response.ok)throw new Error(`Map key unavailable (${response.status})`);
  const {key}=await response.json();if(!key)throw new Error('Google Maps browser key is not configured');
  return new Promise((resolve,reject)=>{
   const cb='__gasmaskRouteMapReady';const w=window as any;
   const timeout=window.setTimeout(()=>{delete w[cb];reject(new Error('Map could not initialize'));},20000);
   w[cb]=()=>{clearTimeout(timeout);delete w[cb];resolve(w.google);};
   const script=document.createElement('script');script.async=true;
   script.src=`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&callback=${cb}&channel=gmp_lovable_agentskills_v1`;
   script.onerror=()=>{clearTimeout(timeout);reject(new Error('Google Maps failed to load'));};document.head.appendChild(script);
  });
 })().catch(e=>{loader=null;throw e;});return loader;
}
