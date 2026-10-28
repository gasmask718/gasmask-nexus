import { resolveNumberBrand } from './inboundNumberBrand.ts';
import { sendVerifiedStorePortalInvite } from './storePortalInvite.ts';
export const isVerificationYes = (body: string) => /^(yes|y|yeah|ok|confirmed)$/i.test(body.trim());
export const isVerificationStop = (body: string) => /^(stop|stopall|unsubscribe|quit|cancel|end)$/i.test(body.trim());
/** Called only after Twilio signature / internal service auth has been checked. */
export async function receiveContactVerification(sb:any,from:string,to:string,body:string,sid:string) {
 if(!isVerificationYes(body))return {matched:false};
 const brand=await resolveNumberBrand(sb,to,'contact-verification');
 const {data:result,error}=await sb.rpc('contact_verification_receive',{p_from:from,p_to:to,p_body:body,p_sid:sid,p_business_id:brand.business_id});
 if(error)throw new Error(error.message);
 if(result?.confirmed && result.auto_send){
  try{result.app_link=await sendVerifiedStorePortalInvite(sb,result.store_id,result.contact_id,null,true);}
  catch(e){console.error('Verification app link failed:',e instanceof Error?e.message:String(e));result.app_link={success:false,error:e instanceof Error?e.message:String(e)};}
 }
 return result || {matched:false};
}
