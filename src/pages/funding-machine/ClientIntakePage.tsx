import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { User, Building2, Target, ArrowRight, ArrowLeft, CheckCircle } from "lucide-react";

const STEPS = [
  { key: 'personal', label: 'Personal Info', icon: User },
  { key: 'business', label: 'Business Info', icon: Building2 },
  { key: 'funding', label: 'Funding Goals', icon: Target },
];

const INFRASTRUCTURE_STEPS = [
  { step_key: 'business_address', step_label: 'Business Address Setup', step_order: 1 },
  { step_key: 'entity_formation', step_label: 'Entity Formation (LLC/Corp)', step_order: 2 },
  { step_key: 'ein_registration', step_label: 'EIN Registration', step_order: 3 },
  { step_key: 'duns_number', step_label: 'DUNS Number Acquisition', step_order: 4 },
  { step_key: 'business_banking', step_label: 'Business Banking Setup', step_order: 5 },
  { step_key: 'directory_411', step_label: '411 Directory Listing', step_order: 6 },
  { step_key: 'website_email', step_label: 'Business Website & Email', step_order: 7 },
];

export default function ClientIntakePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    date_of_birth: '', ssn_last4: '',
    address: '', city: '', state: '', zip_code: '',
    business_name: '', business_type: '', business_state: '',
    ein: '', time_in_business_months: '',
    monthly_revenue: '', funding_goal: '', target_funding_amount: '',
    notes: '',
  });

  const set = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const createClient = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data: client, error } = await supabase
        .from('funding_clients')
        .insert({
          user_id: userData.user.id,
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email || null,
          phone: form.phone || null,
          date_of_birth: form.date_of_birth || null,
          ssn_last4: form.ssn_last4 || null,
          address: form.address || null,
          city: form.city || null,
          state: form.state || null,
          zip_code: form.zip_code || null,
          business_name: form.business_name || null,
          business_type: form.business_type || null,
          business_state: form.business_state || null,
          ein: form.ein || null,
          time_in_business_months: form.time_in_business_months ? parseInt(form.time_in_business_months) : 0,
          monthly_revenue: form.monthly_revenue ? parseFloat(form.monthly_revenue) : 0,
          funding_goal: form.funding_goal || null,
          target_funding_amount: form.target_funding_amount ? parseFloat(form.target_funding_amount) : 0,
          notes: form.notes || null,
          status: 'intake',
        })
        .select()
        .single();

      if (error) throw error;

      // Create infrastructure checklist
      const checklistItems = INFRASTRUCTURE_STEPS.map(s => ({
        client_id: client.id,
        step_key: s.step_key,
        step_label: s.step_label,
        step_order: s.step_order,
        status: 'pending',
      }));

      const { error: checklistError } = await supabase
        .from('funding_infrastructure_checklist')
        .insert(checklistItems);

      if (checklistError) console.error('Checklist error:', checklistError);

      // Create initial DFS score (all zeros)
      await supabase.from('funding_dfs_scores').insert({
        client_id: client.id,
        total_score: 0,
      });

      return client;
    },
    onSuccess: (client) => {
      toast.success('Client created successfully!');
      navigate(`/funding-machine/client/${client.id}`);
    },
    onError: (err) => {
      toast.error(`Failed to create client: ${err.message}`);
    },
  });

  const canProceed = () => {
    if (step === 0) return form.first_name && form.last_name;
    if (step === 1) return true;
    if (step === 2) return true;
    return true;
  };

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-500 to-yellow-400 bg-clip-text text-transparent">
          New Client Intake
        </h1>
        <p className="text-muted-foreground mt-1">Onboard a new funding client into the Dynasty pipeline</p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <button
              onClick={() => i <= step && setStep(i)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                i === step ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                i < step ? 'bg-emerald-500/10 text-emerald-400' :
                'bg-muted/30 text-muted-foreground'
              }`}
            >
              {i < step ? <CheckCircle className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
              <span className="text-sm font-medium">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {/* Step 1: Personal Info */}
      {step === 0 && (
        <Card className="border-amber-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-amber-500" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>First Name *</Label><Input value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="John" /></div>
              <div><Label>Last Name *</Label><Input value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="Smith" /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="john@example.com" /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(555) 123-4567" /></div>
              <div><Label>Date of Birth</Label><Input type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} /></div>
              <div><Label>SSN Last 4</Label><Input value={form.ssn_last4} onChange={e => set('ssn_last4', e.target.value)} placeholder="1234" maxLength={4} /></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2"><Label>Address</Label><Input value={form.address} onChange={e => set('address', e.target.value)} /></div>
              <div><Label>City</Label><Input value={form.city} onChange={e => set('city', e.target.value)} /></div>
              <div><Label>State</Label><Input value={form.state} onChange={e => set('state', e.target.value)} maxLength={2} /></div>
            </div>
            <div className="w-32"><Label>Zip Code</Label><Input value={form.zip_code} onChange={e => set('zip_code', e.target.value)} /></div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Business Info */}
      {step === 1 && (
        <Card className="border-amber-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-amber-500" />
              Business Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>Business Name</Label><Input value={form.business_name} onChange={e => set('business_name', e.target.value)} placeholder="Smith Enterprises LLC" /></div>
              <div>
                <Label>Business Type</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.business_type} onChange={e => set('business_type', e.target.value)}>
                  <option value="">Select type...</option>
                  <option value="llc">LLC</option>
                  <option value="s_corp">S-Corp</option>
                  <option value="c_corp">C-Corp</option>
                  <option value="sole_prop">Sole Proprietorship</option>
                  <option value="partnership">Partnership</option>
                  <option value="none">No entity yet</option>
                </select>
              </div>
              <div><Label>Formation State</Label><Input value={form.business_state} onChange={e => set('business_state', e.target.value)} placeholder="NY" maxLength={2} /></div>
              <div><Label>EIN</Label><Input value={form.ein} onChange={e => set('ein', e.target.value)} placeholder="XX-XXXXXXX" /></div>
              <div><Label>Time in Business (months)</Label><Input type="number" value={form.time_in_business_months} onChange={e => set('time_in_business_months', e.target.value)} placeholder="12" /></div>
              <div><Label>Monthly Revenue ($)</Label><Input type="number" value={form.monthly_revenue} onChange={e => set('monthly_revenue', e.target.value)} placeholder="5000" /></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Funding Goals */}
      {step === 2 && (
        <Card className="border-amber-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-amber-500" />
              Funding Goals
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Funding Goal</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.funding_goal} onChange={e => set('funding_goal', e.target.value)}>
                <option value="">Select goal...</option>
                <option value="business_launch">Launch a business</option>
                <option value="business_growth">Grow existing business</option>
                <option value="personal_loans">Personal loan acquisition</option>
                <option value="credit_repair">Credit repair first</option>
                <option value="card_stacking">Card stacking / 0% APR</option>
                <option value="full_pipeline">Full funding pipeline</option>
                <option value="real_estate">Real estate investment</option>
                <option value="equipment">Equipment financing</option>
              </select>
            </div>
            <div>
              <Label>Target Funding Amount ($)</Label>
              <Input type="number" value={form.target_funding_amount} onChange={e => set('target_funding_amount', e.target.value)} placeholder="100000" />
            </div>
            <div>
              <Label>Notes / Additional Context</Label>
              <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any additional context about the client's situation, urgency, or special circumstances..." rows={4} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => step > 0 ? setStep(step - 1) : navigate('/funding-machine')}
          className="border-amber-500/30"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {step > 0 ? 'Previous' : 'Cancel'}
        </Button>

        {step < STEPS.length - 1 ? (
          <Button
            onClick={() => setStep(step + 1)}
            disabled={!canProceed()}
            className="bg-gradient-to-r from-amber-600 to-yellow-500 text-black font-semibold"
          >
            Next <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={() => createClient.mutate()}
            disabled={createClient.isPending || !form.first_name || !form.last_name}
            className="bg-gradient-to-r from-amber-600 to-yellow-500 text-black font-semibold"
          >
            {createClient.isPending ? 'Creating...' : 'Create Client & Start Pipeline'}
            <CheckCircle className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}
