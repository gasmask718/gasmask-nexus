import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCall } from '@/components/communication/CallProvider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ShieldCheck, Phone, Send, Loader2, ArrowLeft, Check, Lock } from 'lucide-react';
import { readFunctionError } from '@/lib/storePortal';
import { toast } from 'sonner';

type Contact = { id:string;name:string;role:string;phone:string;status:string;sent_at:string|null;delivered_at:string|null;confirmed_at:string|null;error:string|null;method:string|null;override_reason:string|null;auto_send:boolean;link_status:string|null;link_error:string|null;opted_out:boolean;last_call_outcome:string|null;total_calls_attempted:number;total_calls_answered:number };
type ContactState = {contacts:Contact[];store_name:string;portal_live:boolean;is_test:boolean;can_override:boolean};
export function useContactVerification(storeId:string, open=false) {
 return useQuery({queryKey:['contact-verification',storeId],queryFn:async()=>{const {data,error}=await supabase.rpc('contact_verification_contacts',{p_store_id:storeId});if(error)throw error;return data as unknown as ContactState;},enabled:!!storeId,refetchInterval:open?4000:30000});
}
const time=(v:string|null)=>v?new Date(v).toLocaleString():'';
export function ContactVerificationFlow({storeId,storeName,contactId}:{storeId:string;storeName?:string;contactId?:string}) {
 const [open,setOpen]=useState(false);const [step,setStep]=useState(1);const [selected,setSelected]=useState(contactId||'');const [name,setName]=useState('');const [role,setRole]=useState('owner');const [phone,setPhone]=useState('');const [outcome,setOutcome]=useState('');const [attempt,setAttempt]=useState(()=>crypto.randomUUID());const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [reason,setReason]=useState('');
 const query=useContactVerification(storeId,open);const qc=useQueryClient();const {initiateCall}=useCall();
 const contacts=query.data?.contacts||[];const contact=contacts.find(c=>c.id===selected);const confirmed=contact?.status==='confirmed'&&!!contact.confirmed_at&&!contact.opted_out;const locked=!query.data?.portal_live&&!query.data?.is_test;
 const invalidate=()=>{['contact-verification','store-contacts-responsiveness','store-contacts','store-notes','store-portal-admin-panel','store-portal-onboarding'].forEach(key=>void qc.invalidateQueries({queryKey:[key]}));};
 const act=async(fn:()=>Promise<void>)=>{setBusy(true);setError('');try{await fn();}catch(e){const text=e instanceof Error?e.message:String(e);setError(text);toast.error(text);}finally{invalidate();setBusy(false);}};
 const choose=()=>void act(async()=>{if(selected==='new'){const {data,error}=await supabase.rpc('contact_verification_save',{p_store_id:storeId,p_name:name,p_role:role,p_phone:phone});if(error)throw error;if(!data)throw new Error('Contact not saved');setSelected(data);}else if(!contact)throw new Error('Pick a contact');setStep(2);});
 const invoke=async(fn:string,body:Record<string,unknown>)=>{const {data,error}=await supabase.functions.invoke(fn,{body});if(error)throw new Error(await readFunctionError(error));if(data?.error||data?.success===false)throw new Error(data.error||'Send did not succeed');};
 const badge=contacts.filter(c=>c.status==='confirmed'&&c.confirmed_at&&!c.opted_out);
 return <div className="space-y-2 min-w-0" onClick={e=>e.stopPropagation()}>
 <div className="flex flex-wrap items-center gap-2"><Button size="sm" variant="outline" onClick={()=>{setOpen(true);setStep(1);setError('');setSelected(contactId||selected);}}><ShieldCheck className="h-4 w-4"/>Verify contact</Button>{badge.map(c=><Badge key={c.id} variant="outline" className="text-primary border-primary/40 break-all"><ShieldCheck className="h-3 w-3 mr-1"/>{c.phone} · Verified</Badge>)}</div>
 <Dialog open={open} onOpenChange={setOpen}><DialogContent className="w-[calc(100%-1.5rem)] max-w-md max-h-[90dvh] overflow-y-auto p-4 rounded-lg" onClick={e=>e.stopPropagation()}>
 <DialogHeader><DialogTitle>At the store · Verify contact</DialogTitle><DialogDescription className="break-words">{query.data?.store_name||storeName||'Store'}</DialogDescription></DialogHeader>
 <div className="grid grid-cols-3 gap-1 text-xs text-center border-b pb-3">{['1 Contact','2 Call','3 Text & app'].map((label,i)=><span key={label} className={step===i+1?'text-primary font-semibold':'text-muted-foreground'}>{label}</span>)}</div>
 {query.isLoading&&<Loader2 className="h-5 w-5 animate-spin"/>}{(error||query.error)&&<p role="alert" className="text-sm text-destructive break-words whitespace-pre-wrap">{error||query.error?.message}</p>}
 {step===1&&<div className="space-y-4"><Label>Contact</Label><Select value={selected} onValueChange={setSelected}><SelectTrigger aria-label="Contact"><SelectValue placeholder="Pick a contact"/></SelectTrigger><SelectContent>{contacts.map(c=><SelectItem value={c.id} key={c.id}>{c.name} · {c.phone}</SelectItem>)}<SelectItem value="new">Add contact</SelectItem></SelectContent></Select>
 {selected==='new'&&<><div className="space-y-2"><Label htmlFor="verify-name">Name</Label><Input id="verify-name" value={name} maxLength={150} onChange={e=>setName(e.target.value)}/></div><div className="space-y-2"><Label>Role</Label><Select value={role} onValueChange={setRole}><SelectTrigger aria-label="Role"><SelectValue/></SelectTrigger><SelectContent>{['owner','manager','worker'].map(r=><SelectItem value={r} key={r}>{r}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="verify-phone">Phone</Label><Input id="verify-phone" type="tel" value={phone} onChange={e=>setPhone(e.target.value)}/></div></>}
 {contact&&<p className="text-sm text-muted-foreground">{contact.role} · {contact.phone}</p>}<Button className="w-full" onClick={choose} disabled={busy||!selected}>{busy?<Loader2 className="h-4 w-4 animate-spin"/>:<Check className="h-4 w-4"/>}Continue</Button></div>}
 {step===2&&contact&&<div className="space-y-4"><p className="font-semibold">{contact.name} · {contact.phone}</p><div className="grid grid-cols-2 gap-2"><Button onClick={()=>{setAttempt(crypto.randomUUID());initiateCall({destinationPhone:contact.phone,entityType:'customer',entityId:contact.id,entityName:contact.name,storeId,contactId:contact.id});}}><Phone className="h-4 w-4"/>Call</Button><Button asChild variant="outline"><a href={`tel:${contact.phone}`} onClick={()=>setAttempt(crypto.randomUUID())}><Phone className="h-4 w-4"/>Phone dialer</a></Button></div>
 <Label>Call outcome</Label><Select value={outcome} onValueChange={setOutcome}><SelectTrigger aria-label="Call outcome"><SelectValue placeholder="After the call"/></SelectTrigger><SelectContent>{['answered','no_answer','voicemail','wrong_number','disconnected'].map(v=><SelectItem key={v} value={v}>{v.replace('_',' ')}</SelectItem>)}</SelectContent></Select>
 <p className="text-xs text-muted-foreground">{contact.total_calls_attempted||0} attempted · {contact.total_calls_answered||0} answered{contact.last_call_outcome?` · Last: ${contact.last_call_outcome.replace('_',' ')}`:''}</p>
 <Button className="w-full" disabled={busy||!outcome} onClick={()=>void act(async()=>{const {error}=await supabase.rpc('contact_verification_call_outcome',{p_contact_id:contact.id,p_outcome:outcome,p_attempt_id:attempt});if(error)throw error;setStep(3);})}>{busy?<Loader2 className="h-4 w-4 animate-spin"/>:<Check className="h-4 w-4"/>}Save outcome & continue</Button><Button variant="ghost" className="w-full" onClick={()=>setStep(3)}>Continue without a call</Button></div>}
 {step===3&&contact&&<div className="space-y-4"><p className="font-semibold break-words">{contact.name} · {contact.phone}</p>
 <div role="status" className="border-l-2 border-primary pl-3 space-y-1"><p className="font-semibold">{confirmed?'Replied YES':contact.opted_out?'Opted out':contact.status==='delivered'?'Delivered':contact.status==='sent'?'Sent':contact.status==='failed'?'Failed':'Unverified'}</p>{contact.status==='sent'||contact.status==='delivered'?<p className="text-sm text-muted-foreground">No reply yet</p>:null}<p className="text-xs text-muted-foreground">{time(contact.confirmed_at||contact.delivered_at||contact.sent_at)}</p>{contact.error&&<p className="text-sm text-destructive break-words">{contact.error}</p>}</div>
 {contact.method==='in_person'&&<p className="text-sm border border-border p-3 rounded-md">Verified in person — <strong>not text-verified</strong><br/>{contact.override_reason}</p>}
 <p className="text-sm text-muted-foreground break-words">GasMask: reply YES to confirm this is the number for {query.data?.store_name||storeName}. - Ching</p>
 <Button className="w-full" disabled={busy||confirmed||contact.opted_out||['sent','delivered'].includes(contact.status)} onClick={()=>void act(async()=>{await invoke('verify-contact-number',{contact_id:contact.id,auto_send_app_link:contact.auto_send});toast.success('Verification sent — awaiting delivery and reply');})}>{busy?<Loader2 className="h-4 w-4 animate-spin"/>:<Send className="h-4 w-4"/>}Send verification text</Button>
 <label className="flex items-start gap-3 text-sm"><Switch aria-label="Auto-send app link" checked={contact.auto_send} disabled={busy} onCheckedChange={v=>void act(async()=>{const {error}=await supabase.rpc('contact_verification_auto_link',{p_contact_id:contact.id,p_enabled:v});if(error)throw error;})}/><span>Auto-send app link when they reply YES</span></label>
 {locked&&<p className="text-sm text-muted-foreground flex gap-2"><Lock className="h-4 w-4 shrink-0"/>{confirmed?'Ready to send link · ':''}Store portal OFF · test store only</p>}
 {contact.link_status&&<p className="text-sm break-words">App link: {contact.link_status.replace(/_/g,' ')}{contact.link_error?` · ${contact.link_error}`:''}</p>}
 <Button className="w-full" variant="secondary" disabled={busy||!confirmed||locked||!!contact.link_status&&['sending','sent','failed','blocked'].includes(contact.link_status)} onClick={()=>void act(async()=>{await invoke('text-store-portal-invite',{store_id:storeId,contact_id:contact.id});toast.success('App link sent — delivery pending');})}><Send className="h-4 w-4"/>Text app link</Button>
 {query.data?.can_override&&!confirmed&&<div className="border-t pt-3 space-y-2"><Label htmlFor="verify-reason">Verified in person · reason required</Label><Textarea id="verify-reason" value={reason} maxLength={1000} onChange={e=>setReason(e.target.value)}/><Button variant="outline" className="w-full" disabled={busy||reason.trim().length<5} onClick={()=>void act(async()=>{const {error}=await supabase.rpc('contact_verification_override',{p_contact_id:contact.id,p_reason:reason});if(error)throw error;toast.success('In-person verification recorded, not text verification');})}>Verified in person</Button></div>}
 </div>}
 {step>1&&<Button variant="ghost" onClick={()=>setStep(step-1)}><ArrowLeft className="h-4 w-4"/>Back</Button>}
 </DialogContent></Dialog>
 </div>;
}
