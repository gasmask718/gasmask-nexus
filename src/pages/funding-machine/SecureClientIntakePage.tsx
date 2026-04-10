import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Lock, Shield, User, Building2, CreditCard, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const STEPS = [
  { id: 1, label: 'Personal Info', icon: User },
  { id: 2, label: 'Business Info', icon: Building2 },
  { id: 3, label: 'Credit Profile', icon: CreditCard },
  { id: 4, label: 'Access & Consent', icon: Shield },
];

export default function SecureClientIntakePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', date_of_birth: '',
    address: '', city: '', state: '', zip: '', ssn: '',
    employment_status: '', monthly_income: '',
    business_name: '', ein: '', business_start_date: '', business_state_of_formation: '',
    credit_score_estimate: '', assigned_advisor: '',
    consent: false,
  });

  const update = (field: string, value: string | boolean) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    if (!form.consent) { toast.error('You must agree to the consent'); return; }
    if (!form.full_name || !form.ssn || form.ssn.length !== 9) {
      toast.error('Full name and valid 9-digit SSN are required');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('encrypt-client-ssn', {
        body: {
          full_name: form.full_name,
          email: form.email || null,
          phone: form.phone || null,
          date_of_birth: form.date_of_birth || null,
          address: form.address || null,
          city: form.city || null,
          state: form.state || null,
          zip: form.zip || null,
          ssn: form.ssn,
          employment_status: form.employment_status || null,
          monthly_income: form.monthly_income ? Number(form.monthly_income) : null,
          business_name: form.business_name || null,
          ein: form.ein || null,
          business_start_date: form.business_start_date || null,
          business_state_of_formation: form.business_state_of_formation || null,
          credit_score_estimate: form.credit_score_estimate ? Number(form.credit_score_estimate) : null,
          assigned_advisor: form.assigned_advisor || null,
        },
      });

      if (error) throw error;
      setSubmitted(true);
      toast.success(`Client ${form.full_name} created successfully. SSN encrypted.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit intake');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-8 text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-2xl font-bold text-foreground">Client Submitted Successfully</h2>
            <p className="text-muted-foreground">SSN has been encrypted via Vault. Raw SSN was discarded. Only the last 4 digits are stored for matching.</p>
            <div className="flex gap-3 justify-center pt-4">
              <Button onClick={() => { setSubmitted(false); setStep(1); setForm({ full_name: '', email: '', phone: '', date_of_birth: '', address: '', city: '', state: '', zip: '', ssn: '', employment_status: '', monthly_income: '', business_name: '', ein: '', business_start_date: '', business_state_of_formation: '', credit_score_estimate: '', assigned_advisor: '', consent: false }); }}>
                Add Another Client
              </Button>
              <Button variant="outline" onClick={() => navigate('/funding-machine')}>Back to Dashboard</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Secure Client Intake</h1>
        <p className="text-muted-foreground">All sensitive data is encrypted. SSN is protected via Vault encryption.</p>
      </div>

      {/* Step indicators */}
      <div className="flex gap-2">
        {STEPS.map(s => {
          const Icon = s.icon;
          return (
            <button key={s.id} onClick={() => setStep(s.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${step === s.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
              <Icon className="h-4 w-4" />
              {s.label}
            </button>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          {step === 1 && (
            <>
              <CardHeader className="p-0 pb-4"><CardTitle>Personal Information</CardTitle></CardHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label>Full Name *</Label><Input value={form.full_name} onChange={e => update('full_name', e.target.value)} placeholder="John Doe" /></div>
                <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="john@example.com" /></div>
                <div><Label>Phone</Label><Input value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="(555) 123-4567" /></div>
                <div><Label>Date of Birth</Label><Input type="date" value={form.date_of_birth} onChange={e => update('date_of_birth', e.target.value)} /></div>
                <div className="col-span-full"><Label>Address</Label><Input value={form.address} onChange={e => update('address', e.target.value)} placeholder="123 Main St" /></div>
                <div><Label>City</Label><Input value={form.city} onChange={e => update('city', e.target.value)} /></div>
                <div><Label>State</Label><Input value={form.state} onChange={e => update('state', e.target.value)} /></div>
                <div><Label>ZIP</Label><Input value={form.zip} onChange={e => update('zip', e.target.value)} /></div>
              </div>
              <div className="pt-2">
                <Label className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-amber-500" />
                  Social Security Number — Encrypted on entry. Never stored in plain text.
                </Label>
                <Input type="password" value={form.ssn} onChange={e => update('ssn', e.target.value.replace(/\D/g, '').slice(0, 9))} placeholder="•••••••••" maxLength={9} className="mt-1 font-mono" />
                <p className="text-xs text-muted-foreground mt-1">9 digits only. Encrypted via Vault immediately on submission. Only last 4 stored.</p>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <CardHeader className="p-0 pb-4"><CardTitle>Business Information</CardTitle></CardHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label>Business Name</Label><Input value={form.business_name} onChange={e => update('business_name', e.target.value)} /></div>
                <div><Label>EIN</Label><Input value={form.ein} onChange={e => update('ein', e.target.value)} placeholder="XX-XXXXXXX" /></div>
                <div><Label>Business Start Date</Label><Input type="date" value={form.business_start_date} onChange={e => update('business_start_date', e.target.value)} /></div>
                <div><Label>State of Formation</Label><Input value={form.business_state_of_formation} onChange={e => update('business_state_of_formation', e.target.value)} /></div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <CardHeader className="p-0 pb-4"><CardTitle>Credit Profile</CardTitle></CardHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Employment Status</Label>
                  <Select value={form.employment_status} onValueChange={v => update('employment_status', v)}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employed">Employed</SelectItem>
                      <SelectItem value="self_employed">Self-Employed</SelectItem>
                      <SelectItem value="business_owner">Business Owner</SelectItem>
                      <SelectItem value="unemployed">Unemployed</SelectItem>
                      <SelectItem value="retired">Retired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Monthly Income</Label><Input type="number" value={form.monthly_income} onChange={e => update('monthly_income', e.target.value)} placeholder="5000" /></div>
                <div><Label>Estimated Credit Score</Label><Input type="number" value={form.credit_score_estimate} onChange={e => update('credit_score_estimate', e.target.value)} placeholder="680" min={300} max={850} /></div>
                <div><Label>Assigned Advisor</Label><Input value={form.assigned_advisor} onChange={e => update('assigned_advisor', e.target.value)} placeholder="David" /></div>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <CardHeader className="p-0 pb-4"><CardTitle>Access & Consent</CardTitle></CardHeader>
              <Card className="bg-amber-500/5 border-amber-500/20">
                <CardContent className="p-4 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">Email & Portal Access</p>
                    <p className="text-sm text-muted-foreground">To access your credit portals, you will enter your credentials directly during your session. We do not store email passwords.</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-green-500/5 border-green-500/20">
                <CardContent className="p-4 flex items-start gap-3">
                  <Shield className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">SSN Protection</p>
                    <p className="text-sm text-muted-foreground">Your Social Security Number is encrypted using AES-256 via Supabase Vault immediately upon submission. The raw value is never stored in any database table. Only the last 4 digits are retained for identity matching.</p>
                  </div>
                </CardContent>
              </Card>
              <div className="flex items-start gap-3 pt-2">
                <Checkbox checked={form.consent} onCheckedChange={v => update('consent', v === true)} id="consent" />
                <Label htmlFor="consent" className="text-sm leading-relaxed">
                  I authorize Dynasty Funding to access my credit profile and submit applications on my behalf. I understand my SSN is encrypted and protected. I consent to receiving communications regarding my funding progress.
                </Label>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" disabled={step === 1} onClick={() => setStep(s => s - 1)}>Previous</Button>
        {step < 4 ? (
          <Button onClick={() => setStep(s => s + 1)}>Next</Button>
        ) : (
          <Button onClick={handleSubmit} disabled={submitting || !form.consent} className="bg-amber-600 hover:bg-amber-700">
            {submitting ? 'Encrypting & Submitting...' : 'Submit Securely'}
          </Button>
        )}
      </div>
    </div>
  );
}
