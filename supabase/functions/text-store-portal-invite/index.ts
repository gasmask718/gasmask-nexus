import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'npm:zod@3';
import { sendVerifiedStorePortalInvite } from '../_shared/storePortalInvite.ts';
const schema=z.object({store_id:z.string().uuid(),contact_id:z.string().uuid().optional()});
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
 try{
  const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),anon=Deno.env.get('SUPABASE_ANON_KEY');
  if(!url||!key||!anon)return json({error:'Service unavailable'},500);
  const header=req.headers.get('Authorization');if(!header?.startsWith('Bearer '))return json({error:'Unauthorized'},401);
  const uc=createClient(url,anon,{global:{headers:{Authorization:header}}});const {data:claims,error:authError}=await uc.auth.getClaims(header.slice(7));
  if(authError||!claims?.claims?.sub)return json({error:'Unauthorized'},401);
  const parsed=schema.safeParse(await req.json());if(!parsed.success)return json({error:parsed.error.flatten()},400);
  const {data:allowed,error:accessError}=await uc.rpc('contact_verification_can_access',{p_store_id:parsed.data.store_id});
  if(accessError||allowed!==true)return json({error:accessError?.message||'Not authorized for this store'},403);
  const sb=createClient(url,key);let id=parsed.data.contact_id;
  if(!id){
   const {data:contacts,error}=await sb.from('store_contacts').select('id').eq('store_id',parsed.data.store_id).eq('number_verification_status','confirmed').eq('can_receive_sms',true).is('deleted_at',null).or('opted_out.is.null,opted_out.eq.false').order('is_primary',{ascending:false}).limit(2);
   if(error)throw new Error(error.message);
   if(contacts?.length!==1)return json({error:'Pick the confirmed contact in Verify contact first'},400);id=contacts[0].id;
  }
  const result=await sendVerifiedStorePortalInvite(sb,parsed.data.store_id,id,claims.claims.sub as string);
  return json(result,result.success?200:result.status==='ready_locked'?403:result.already_attempted?409:502);
 }catch(e){return json({error:e instanceof Error?e.message:String(e)},400);}
});
