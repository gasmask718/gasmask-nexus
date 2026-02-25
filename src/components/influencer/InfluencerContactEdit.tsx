/**
 * Influencer Contact & Identity Edit Panel
 * Editable fields: name, phone, city, state, country, birthday
 * Age computed dynamically — never stored
 */
import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, User, Phone, MapPin, Calendar, Shield } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { differenceInYears } from 'date-fns';

interface Props {
  influencerId: string;
  influencer: {
    name: string;
    legal_name?: string | null;
    phone?: string | null;
    email?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    date_of_birth?: string | null;
  } | null;
  isEditable?: boolean;
}

export function InfluencerContactEdit({ influencerId, influencer, isEditable = false }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: '',
    legal_name: '',
    phone: '',
    city: '',
    state: '',
    country: '',
    date_of_birth: '',
  });

  useEffect(() => {
    if (influencer) {
      setForm({
        name: influencer.name || '',
        legal_name: influencer.legal_name || '',
        phone: influencer.phone || '',
        city: influencer.city || '',
        state: influencer.state || '',
        country: influencer.country || '',
        date_of_birth: influencer.date_of_birth || '',
      });
    }
  }, [influencer]);

  const age = form.date_of_birth
    ? differenceInYears(new Date(), new Date(form.date_of_birth))
    : null;

  const phoneValid = !form.phone || /^[\d\s\-\+\(\)]{7,20}$/.test(form.phone);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('influencers')
        .update({
          name: form.name.trim(),
          legal_name: form.legal_name.trim() || null,
          phone: form.phone.trim() || null,
          city: form.city.trim() || null,
          state: form.state.trim() || null,
          country: form.country.trim() || null,
          date_of_birth: form.date_of_birth || null,
          profile_last_updated_at: new Date().toISOString(),
          profile_last_updated_by: user?.id || null,
        })
        .eq('id', influencerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['influencer-profile-detail', influencerId] });
      toast.success('Profile updated');
      setEditing(false);
    },
    onError: (e: Error) => toast.error(`Save failed: ${e.message}`),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Contact & Identity
            </CardTitle>
            <CardDescription>Core identity fields for this influencer</CardDescription>
          </div>
          {isEditable && !editing && (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit</Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-blue-500/30 bg-blue-500/5">
          <Shield className="h-4 w-4 text-blue-500" />
          <AlertDescription className="text-sm text-muted-foreground">
            Date of birth stored for compliance only. No sensitive trait inference permitted.
          </AlertDescription>
        </Alert>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-1"><User className="h-3 w-3" /> Display Name</Label>
            {editing ? (
              <Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} />
            ) : (
              <p className="text-sm font-medium py-2">{form.name || '—'}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Legal Name</Label>
            {editing ? (
              <Input value={form.legal_name} onChange={(e) => setForm(p => ({ ...p, legal_name: e.target.value }))} />
            ) : (
              <p className="text-sm font-medium py-2">{form.legal_name || '—'}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1"><Phone className="h-3 w-3" /> Phone</Label>
            {editing ? (
              <div>
                <Input 
                  value={form.phone} 
                  onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))} 
                  placeholder="+1 (555) 123-4567"
                />
                {form.phone && !phoneValid && (
                  <p className="text-xs text-destructive mt-1">Invalid phone format</p>
                )}
              </div>
            ) : (
              <p className="text-sm font-medium py-2">{form.phone || '—'}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1"><MapPin className="h-3 w-3" /> City</Label>
            {editing ? (
              <Input value={form.city} onChange={(e) => setForm(p => ({ ...p, city: e.target.value }))} />
            ) : (
              <p className="text-sm font-medium py-2">{form.city || '—'}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>State</Label>
            {editing ? (
              <Input value={form.state} onChange={(e) => setForm(p => ({ ...p, state: e.target.value }))} />
            ) : (
              <p className="text-sm font-medium py-2">{form.state || '—'}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Country</Label>
            {editing ? (
              <Input value={form.country} onChange={(e) => setForm(p => ({ ...p, country: e.target.value }))} placeholder="US" />
            ) : (
              <p className="text-sm font-medium py-2">{form.country || '—'}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Birthday</Label>
            {editing ? (
              <Input 
                type="date" 
                value={form.date_of_birth} 
                onChange={(e) => setForm(p => ({ ...p, date_of_birth: e.target.value }))} 
              />
            ) : (
              <p className="text-sm font-medium py-2">{form.date_of_birth || '—'}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Age (Computed)</Label>
            <p className="text-sm font-medium py-2">
              {age !== null ? (
                <Badge variant="outline">Age: {age}</Badge>
              ) : '—'}
            </p>
          </div>
        </div>

        {editing && (
          <div className="flex gap-2 pt-2">
            <Button size="sm" variant="outline" onClick={() => { setEditing(false); if (influencer) setForm({ name: influencer.name || '', legal_name: influencer.legal_name || '', phone: influencer.phone || '', city: influencer.city || '', state: influencer.state || '', country: influencer.country || '', date_of_birth: influencer.date_of_birth || '' }); }}>
              Cancel
            </Button>
            <Button 
              size="sm" 
              onClick={() => saveMutation.mutate()} 
              disabled={saveMutation.isPending || !form.name.trim() || !phoneValid}
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Save Changes
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
