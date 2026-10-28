import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
const bodySchema = z.object({ limit: z.number().int().min(1).max(200).default(100), cursor: z.string().uuid().optional(), dry_run: z.boolean().default(false), google_fallback: z.boolean().default(false) });
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
function csvRows(text: string): string[][] {
 const rows: string[][]=[]; let row: string[]=[]; let value=''; let quote=false;
 for(let i=0;i<text.length;i++){ const c=text[i]; if(c==='"'){if(quote && text[i+1]==='"'){value+='"';i++;}else quote=!quote;}else if(c===','&&!quote){row.push(value);value='';}else if(c==='\n'&&!quote){row.push(value.replace(/\r$/,''));rows.push(row);row=[];value='';}else value+=c; }
 if(value||row.length){row.push(value);rows.push(row);} return rows;
}
Deno.serve(async req => {
 if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
 if(req.method!=='POST')return json({error:'POST required'},405);
 try {
 const url=Deno.env.get('SUPABASE_URL'); const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'); if(!url||!key)return json({error:'Cloud credentials unavailable'},500);
 const db=createClient(url,key); const token=req.headers.get('Authorization')?.replace(/^Bearer /,''); if(!token)return json({error:'Sign in required'},401);
 const {data:{user},error:authError}=await db.auth.getUser(token);if(authError||!user)return json({error:'Invalid session'},401);
 const {data:roles,error:roleError}=await db.from('user_roles').select('role').eq('user_id',user.id).in('role',['owner','admin']); if(roleError||!roles?.length)return json({error:'Owner access required'},403);
 const parsed=bodySchema.safeParse(await req.json());if(!parsed.success)return json({error:parsed.error.flatten()},400);const input=parsed.data;
 let query=db.from('store_master').select('id,address,city,state,zip,lat,lon').or('lat.is.null,lon.is.null').is('deleted_at',null).eq('is_portal_test',false).order('id').limit(input.limit);
 if(input.cursor)query=query.gt('id',input.cursor);
 const {data:stores,error}=await query;if(error)throw error;
 const rows=stores||[];const eligible=rows.filter(s=>s.address&&/\d/.test(s.address)&&s.state&&(s.city||s.zip));
 const cursor=rows.at(-1)?.id??null;
 if(input.dry_run)return json({selected:rows.length,eligible:eligible.length,next_cursor:cursor});
 const quote=(v:unknown)=>`"${String(v??'').replaceAll('"','""')}"`;
 const result={selected:rows.length,geocoded:0,no_match:0,non_exact:0,invalid_address:rows.length-eligible.length,failed:0,google:0,next_cursor:cursor,google_available:!!Deno.env.get('GOOGLE_PLACES_API_KEY')};
 if(!eligible.length)return json(result);
 const form=new FormData();form.set('benchmark','Public_AR_Current');form.set('addressFile',new Blob([eligible.map(s=>[s.id,s.address,s.city,s.state,s.zip].map(quote).join(',')).join('\n')],{type:'text/csv'}),'stores.csv');
 const response=await fetch('https://geocoding.geo.census.gov/geocoder/locations/addressbatch',{method:'POST',body:form,signal:AbortSignal.timeout(110000)});
 if(!response.ok)return json({error:'Census request failed',status:response.status,details:await response.text()},response.status);
 const outcomes=new Map(csvRows(await response.text()).map(r=>[r[0],r]));
 let googleDenied=false;
 for(const store of eligible){
 const r=outcomes.get(store.id);let lat:number|undefined;let lon:number|undefined;let source='census';let confidence='census_exact_address_range';
 if(r?.[2]==='Match'&&r[3]==='Exact'){const parts=r[5]?.split(',').map(Number);if(parts?.length===2){[lon,lat]=parts;}}else if(r?.[2]==='Match')result.non_exact++;else result.no_match++;
 const gkey=Deno.env.get('GOOGLE_PLACES_API_KEY');
 if(lat===undefined&&input.google_fallback&&gkey&&!googleDenied){
 const address=[store.address,store.city,store.state,store.zip].filter(Boolean).join(', ');
 const g=await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${encodeURIComponent(gkey)}`,{signal:AbortSignal.timeout(10000)});
 if(g.status===403){googleDenied=true; console.warn('Google server key denied; remaining fallback skipped');}else if(g.ok){const body=await g.json();if(body.status==='REQUEST_DENIED'){googleDenied=true;}else{const top=body.results?.[0];const zip=top?.address_components?.find((c:any)=>c.types.includes('postal_code'))?.short_name; const state=top?.address_components?.find((c:any)=>c.types.includes('administrative_area_level_1'))?.short_name; if(top&&!top.partial_match&&['ROOFTOP','RANGE_INTERPOLATED'].includes(top.geometry?.location_type)&&(!store.zip||zip===store.zip.slice(0,5))&&state===store.state){lat=top.geometry.location.lat;lon=top.geometry.location.lng;source='google';confidence=`google_${top.geometry.location_type.toLowerCase()}`;}}}
 }
 if(lat!==undefined&&lon!==undefined&&Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180){const {data:applied,error:saveError}=await db.rpc('apply_missing_store_geocode',{p_id:store.id,p_lat:lat,p_lon:lon,p_confidence:confidence,p_source:source});if(saveError){console.error(saveError.message);result.failed++;}else if(applied){result.geocoded++;if(source==='google')result.google++;}}
 }
 return json({...result,google_denied:googleDenied});
 }catch(e){return json({error:e instanceof Error?e.message:String(e)},500);}
});
