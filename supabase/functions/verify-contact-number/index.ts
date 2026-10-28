import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'npm:zod@3';
import { sendSms } from '../_shared/sendSms.ts';
const VERIFIED_FROM = '+18776818621';
const schema = z.object({ contact_id: z.string().uuid(), auto_send_app_link: z.boolean().default(true), business_label: z.string().optional() });
const json = (body: unknown, status=200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type':'application/json' } });
Deno.serve(async req => {
  if (req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
  try {
    const url=Deno.env.get('SUPABASE_URL'), key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), anon=Deno.env.get('SUPABASE_ANON_KEY');
    if (!url || !key || !anon) return json({error:'Service unavailable'},500);
    const header=req.headers.get('Authorization'); if (!header?.startsWith('Bearer ')) return json({error:'Unauthorized'},401);
    const userClient=createClient(url,anon,{global:{headers:{Authorization:header}}});
    const {data:claims,error:authError}=await userClient.auth.getClaims(header.slice(7));
    if(authError || !claims?.claims?.sub) return json({error:'Unauthorized'},401);
    const parsed=schema.safeParse(await req.json()); if(!parsed.success) return json({error:parsed.error.flatten()},400);
    const sb=createClient(url,key);
    const {data:attempt,error:beginError}=await userClient.rpc('contact_verification_begin',{p_contact_id:parsed.data.contact_id,p_from:VERIFIED_FROM,p_auto:parsed.data.auto_send_app_link});
    if(beginError) return json({error:beginError.message},403);
    const message=`GasMask: reply YES to confirm this is the number for ${attempt.store_name}. - Ching`;
    const sms=await sendSms({to:attempt.phone,from:VERIFIED_FROM,body:message,sendClass:'conversational',idempotencyKey:`contact-verify-${attempt.attempt_id}`,storeId:attempt.store_id,purpose:'contact_number_verification',metadata:{contact_id:attempt.contact_id,verification_attempt_id:attempt.attempt_id},skipCooldown:true});
    const {error:updateError}=await sb.from('store_contacts').update({
      number_verification_message_sid:sms.providerMessageId,number_verification_status:sms.success?'sent':'failed',number_verification_failed_at:sms.success?null:new Date().toISOString(),number_verification_error:sms.success?null:`${sms.errorCode || ''} ${sms.errorMessage || sms.status}`.trim(),
    }).eq('id',attempt.contact_id).eq('verification_attempt_id',attempt.attempt_id).neq('number_verification_status','confirmed');
    if(updateError) throw new Error(updateError.message);
    const {error:logError}=await sb.from('communication_logs').upsert({store_id:attempt.store_id,contact_id:attempt.contact_id,channel:'sms',direction:'outbound',summary:'At the store: verification text attempt',message_content:message,recipient_phone:attempt.phone,sender_phone:VERIFIED_FROM,delivery_status:sms.success?'sent':'failed',twilio_sid:sms.providerMessageId,provider_message_id:sms.providerMessageId,error_code:sms.errorCode,error_message:sms.errorMessage,created_by:claims.claims.sub,business_id:attempt.business_id,outcome:sms.success?'verification_sent':'verification_failed',idempotency_key:`contact-verify-${attempt.attempt_id}`},{onConflict:'idempotency_key'});
    if(logError) throw new Error(logError.message);
    return json({success:sms.success,status:sms.success?'sent':'failed',message_sid:sms.providerMessageId,error:sms.errorMessage,error_code:sms.errorCode},sms.success?200:502);
  } catch(e) { return json({error:e instanceof Error?e.message:String(e)},500); }
});
