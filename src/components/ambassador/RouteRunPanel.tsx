import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAmbassadorRoutes, type AmbassadorRoute, type RouteStop } from '@/hooks/useAmbassadorRoutes';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LocateFixed, Navigation, Camera, Check, SkipForward, DoorClosed, Package, Loader2, Phone } from 'lucide-react';
import { nearbyStops, nearestNext, googleDirections, travelEstimate, type Position } from '@/lib/routes/nearMe';
import { AmbassadorStoreMap } from './AmbassadorStoreMap';
import { RouteInventoryDialog } from './RouteInventoryDialog';
import { toast } from 'sonner';
import { tubeBrandName } from '@/lib/inventory/tubeSkuKeys';
export function AssignedRouteRun({ routeId }: { routeId: string }) {
 const { routes } = useAmbassadorRoutes(); const route=routes.find(r=>r.id===routeId);
 return route ? <div className="p-3"><h1 className="text-xl font-semibold mb-4 break-words">{route.title}</h1><RouteRunPanel route={route}/></div> : <p className="p-4">Route unavailable</p>;
}
export function RouteRunPanel({ route }: { route: AmbassadorRoute }) {
 const navigate=useNavigate();const {completeStop,isCompletingStop}=useAmbassadorRoutes();
 const [location,setLocation]=useState<Position|null>(null);const [accuracy,setAccuracy]=useState<number|null>(null);const [locatedAt,setLocatedAt]=useState<Date|null>(null);const [locating,setLocating]=useState(false);const [radius,setRadius]=useState('all');const [mode,setMode]=useState<'driving'|'walking'>('driving');const [inventory,setInventory]=useState<RouteStop|null>(null);const [showFinished,setShowFinished]=useState(false);
 const locate=useCallback(()=>new Promise<Position|null>(resolve=>{
 if(!navigator.geolocation){toast.error('Location is unavailable on this phone');resolve(null);return;}
 setLocating(true);navigator.geolocation.getCurrentPosition(p=>{const point={lat:p.coords.latitude,lng:p.coords.longitude};setLocation(point);setAccuracy(p.coords.accuracy);setLocatedAt(new Date());setLocating(false);resolve(point);},e=>{setLocating(false);toast.error(`Location unavailable: ${e.message}`);resolve(null);},{enableHighAccuracy:true,timeout:15000,maximumAge:15000});
 }),[]);
 useEffect(()=>{if(!location)return;const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void locate();},120000);const refresh=()=>{if(document.visibilityState==='visible')void locate();};document.addEventListener('visibilitychange',refresh);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};},[!!location,locate]);
 const stops=route.stops||[];const visible=useMemo(()=>nearbyStops(stops,location,radius==='all'?null:Number(radius)),[stops,location,radius]);const next=visible.find(s=>s.store_lat!=null&&s.store_lng!=null)||visible[0];
 const ids=[...new Set(stops.map(s=>s.store_id).filter((s):s is string=>!!s))];
 const facts=useQuery({queryKey:['route-stop-facts',route.id],queryFn:async()=>{const inventories:any[]=[];const orders:any[]=[];for(let i=0;i<ids.length;i+=80){const batch=ids.slice(i,i+80);const [inv,ord]=await Promise.all([supabase.from('store_tube_inventory_status').select('store_id,brand_id,current_tubes_left,tubes_updated_at').in('store_id',batch).eq('is_simulation',false),supabase.from('invoices').select('store_id,created_at').in('store_id',batch).is('deleted_at',null).eq('revenue_role','sale').order('created_at',{ascending:false})]);if(inv.error)throw inv.error;if(ord.error)throw ord.error;inventories.push(...inv.data||[]);orders.push(...ord.data||[]);}return{inventories,orders};}});
 const finish=async(stop:RouteStop,status:'complete'|'skipped'|'closed')=>{try{await completeStop({stopId:stop.id,status,lat:location?.lat,lng:location?.lng});if(location)await locate();}catch{/* mutation displays error */}};
 const maps=(multi:boolean)=>{const chosen=multi&&location?nearestNext(visible,location,9):next?[next]:[];const url=googleDirections(chosen,location,mode);if(url)window.open(url,'_blank','noopener,noreferrer');};
 const finished=stops.filter(s=>['complete','completed','visited','skipped','closed'].includes(s.status));
 return <section className="space-y-4 min-w-0">
 <div className="flex flex-wrap gap-2"><Button onClick={()=>void locate()} disabled={locating}>{locating?<Loader2 className="h-4 w-4 animate-spin"/>:<LocateFixed className="h-4 w-4"/>}{location?'Re-locate':'Use my location'}</Button><Select value={radius} onValueChange={setRadius} disabled={!location}><SelectTrigger className="w-28" aria-label="Radius"><SelectValue/></SelectTrigger><SelectContent>{['0.5','1','2','5','all'].map(r=><SelectItem key={r} value={r}>{r==='all'?'All distances':`${r} mi`}</SelectItem>)}</SelectContent></Select><Select value={mode} onValueChange={v=>setMode(v as 'driving'|'walking')}><SelectTrigger className="w-28" aria-label="Travel mode"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="driving">Driving</SelectItem><SelectItem value="walking">Walking</SelectItem></SelectContent></Select></div>
 {location&&<p className="text-xs text-muted-foreground">Near Me · GPS {locatedAt?.toLocaleTimeString()} · accuracy ±{Math.round(accuracy||0)} m</p>}
 <div className="grid gap-2"><Button onClick={()=>maps(false)} disabled={!next}><Navigation className="h-4 w-4"/>Start route</Button><Button variant="outline" onClick={()=>maps(true)} disabled={!location||!visible.some(s=>s.store_lat!=null&&s.store_lng!=null)}><Navigation className="h-4 w-4"/>Open next 9 in Google Maps</Button></div>
 <p className="text-sm text-muted-foreground">{visible.length} remaining{radius!=='all'?` within ${radius} mi`:''} · {route.completed_stops}/{route.stops_count} done</p>
 <AmbassadorStoreMap height={230} title="Route stops" stores={[...visible.filter(s=>s.store_lat!=null&&s.store_lng!=null).map(s=>({id:s.id,name:s.store_name||'Stop',lat:s.store_lat,lng:s.store_lng,address:s.store_address,statusKey:'pending'})),...(location?[{id:'your-location',name:'Your current location',lat:location.lat,lng:location.lng,statusKey:'secured'}]:[])]}/>
 {facts.error&&<p className="text-destructive text-sm">Inventory/order details: {facts.error.message}</p>}
 {!visible.length&&<p className="py-6 text-muted-foreground">{radius==='all'?'No remaining stops.':'No remaining stops inside this radius.'}</p>}
 {visible.map(stop=>{const inv=facts.data?.inventories.filter(r=>r.store_id===stop.store_id)||[];const order=facts.data?.orders.find(r=>r.store_id===stop.store_id);const estimate=stop.distance!==null?travelEstimate(stop.distance):null;return <article key={stop.id} data-testid="route-stop" data-stop-id={stop.id} className="border rounded-lg p-4 space-y-3 bg-card min-w-0">
 <div className="flex flex-wrap gap-2">{stop.id===next?.id&&<Badge>Next closest</Badge>}{stop.stop_reason?.startsWith('COLLECT')&&<Badge variant="destructive">{stop.stop_reason.split('|')[0]}</Badge>}</div>
 <h3 className="font-semibold break-words">{stop.store_name||`Stop ${stop.planned_order}`}</h3><p className="text-sm text-muted-foreground break-words">{stop.store_address||'No address — call first'}</p>{stop.phone&&<Button asChild variant="link" className="p-0 h-auto"><a href={`tel:${stop.phone}`}><Phone className="h-4 w-4"/>{stop.phone}</a></Button>}
 {estimate?<p className="text-sm">{stop.distance?.toFixed(2)} mi · ~{estimate.walking} min walk / ~{estimate.driving} min drive <span className="text-muted-foreground">(straight-line estimates)</span></p>:<p className="text-xs text-muted-foreground">{location?'Coordinates unavailable':'Use location for distance'}</p>}
 <div className="text-xs space-y-1 text-muted-foreground"><p>Last order: {order?new Date(order.created_at).toLocaleDateString():facts.isLoading?'Loading…':'Not recorded'}</p><p>Last inventory: {inv.length?inv.map(r=>`${tubeBrandName(r.brand_id)} ${r.current_tubes_left??'—'}${r.tubes_updated_at?` (${new Date(r.tubes_updated_at).toLocaleDateString()})`:''}`).join(' · '):facts.isLoading?'Loading…':'Not counted'}</p></div>
 {stop.outcome_notes&&<p className="text-sm whitespace-pre-wrap break-words">{stop.outcome_notes}</p>}
 <div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={()=>{const url=googleDirections([stop],location,mode);if(url)window.open(url,'_blank','noopener,noreferrer');}} disabled={!stop.store_address&&stop.store_lat==null}><Navigation className="h-4 w-4"/>Navigate</Button><Button variant="outline" aria-label="Update inventory" onClick={()=>setInventory(stop)} disabled={!stop.store_id}><Package className="h-3 w-3 shrink-0"/>Inventory</Button><Button variant="outline" className="col-span-2" onClick={()=>stop.store_id&&navigate(`/ambassador/visit/${stop.store_id}`)} disabled={!stop.store_id}><Camera className="h-4 w-4"/>Add visit photo</Button></div>
 <div className="grid grid-cols-3 gap-1"><Button className="px-1 gap-1 text-xs" size="sm" disabled={isCompletingStop} onClick={()=>void finish(stop,'complete')}><Check className="h-3 w-3 shrink-0"/><span>Mark done</span></Button><Button className="px-1 gap-1 text-xs" size="sm" variant="secondary" disabled={isCompletingStop} onClick={()=>void finish(stop,'skipped')}><SkipForward className="h-3 w-3 shrink-0"/>Skip</Button><Button className="px-1 gap-1 text-xs" size="sm" variant="secondary" disabled={isCompletingStop} onClick={()=>void finish(stop,'closed')}><DoorClosed className="h-3 w-3 shrink-0"/>Closed</Button></div>
 </article>;})}
 {finished.length>0&&<><Button variant="ghost" onClick={()=>setShowFinished(!showFinished)}>{showFinished?'Hide':'Show'} done / skipped / closed ({finished.length})</Button>{showFinished&&finished.map(s=><p key={s.id} className="text-sm text-muted-foreground">{s.store_name} · {s.status}</p>)}</>}
 {inventory?.store_id&&<RouteInventoryDialog storeId={inventory.store_id} name={inventory.store_name||'Store'} onClose={()=>setInventory(null)}/>}
 </section>;
}
