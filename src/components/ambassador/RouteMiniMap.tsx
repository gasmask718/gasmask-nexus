import { useEffect, useRef, useState } from 'react';
import { loadRouteGoogleMap } from '@/lib/routes/googleMapsLoader';
import { coordinates, type LocatedStop, type Position } from '@/lib/routes/nearMe';
import { Loader2 } from 'lucide-react';
export function RouteMiniMap({stops,location}:{stops:LocatedStop[];location:Position|null}){
 const container=useRef<HTMLDivElement>(null);const [error,setError]=useState('');const [ready,setReady]=useState(false);
 useEffect(()=>{let gone=false;let map:any;const markers:any[]=[];setReady(false);setError('');
 (async()=>{try{const g=await loadRouteGoogleMap();if(gone||!container.current)return;const points=stops.map(coordinates).filter((p):p is Position=>!!p);const center=location||points[0];if(!center){setError('No coordinates on this route');return;}
 map=new g.maps.Map(container.current,{center,zoom:13,clickableIcons:false,mapTypeControl:false,streetViewControl:false,fullscreenControl:true,gestureHandling:'cooperative'});
 const bounds=new g.maps.LatLngBounds();points.forEach((p,i)=>{bounds.extend(p);markers.push(new g.maps.Marker({map,position:p,title:`Stop ${i+1}`}));});
 if(location){bounds.extend(location);markers.push(new g.maps.Marker({map,position:location,title:'Your current location',label:'You',zIndex:1000}));}
 if(points.length>1)map.fitBounds(bounds,32);setReady(true);
 }catch(e){if(!gone)setError(e instanceof Error?e.message:String(e));}})();
 return()=>{gone=true;markers.forEach(m=>m.setMap(null));};
 },[stops,location]);
 return <div className="space-y-2"><div className="text-sm font-medium">Route stops · {stops.filter(s=>coordinates(s)).length} mapped</div><div className="relative h-60 w-full overflow-hidden rounded-lg border"><div ref={container} className="h-full w-full"/>{!ready&&<div className="absolute inset-0 bg-muted flex items-center justify-center p-4 text-sm text-muted-foreground">{error||<><Loader2 className="h-4 w-4 animate-spin mr-2"/>Loading map…</>}</div>}</div></div>;
}
