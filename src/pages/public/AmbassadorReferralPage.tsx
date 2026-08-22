/**
 * AmbassadorReferralPage — PUBLIC GasMask ambassador referral form.
 *
 * Reached via /ambassador-referral/:code shared by an ambassador. The recruit
 * fills this in themselves; the submission becomes a PENDING referral for
 * owner approval — nobody becomes an ambassador automatically. On approval an
 * invite goes out by text and email through the existing invite chain.
 */
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CheckCircle2, AlertTriangle, Users } from 'lucide-react';
import { useReferrerInfo, useSubmitReferral } from '@/hooks/useAmbassadorReferrals';

export default function AmbassadorReferralPage() {
  const { code } = useParams<{ code: string }>();
  const { data: referrerInfo, isLoading: infoLoading } = useReferrerInfo(code);
  const submitReferral = useSubmitReferral();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [region, setRegion] = useState('');
  const [notes, setNotes] = useState('');
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const invalidLink = !infoLoading && referrerInfo && !referrerInfo.success;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!fullName.trim()) {
      setFormError('Please enter your full name.');
      return;
    }
    if (!phone.trim() && !email.trim()) {
      setFormError('Please give us a phone number or an email so we can reach you.');
      return;
    }
    try {
      await submitReferral.mutateAsync({
        referralCode: code!,
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        region: region.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setDone(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong — please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-primary/20">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl">Join GasMask as an Ambassador</CardTitle>
          <CardDescription>
            {infoLoading
              ? 'Checking your referral link…'
              : invalidLink
                ? 'This referral link is not valid.'
                : referrerInfo?.referrer_name
                  ? `${referrerInfo.referrer_name} invited you. Tell us a bit about yourself — the team reviews every referral personally.`
                  : 'Tell us a bit about yourself — the team reviews every referral personally.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invalidLink ? (
            <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>This referral link is invalid or has expired. Ask the ambassador who shared it for a fresh link.</p>
            </div>
          ) : done ? (
            <div className="text-center space-y-3 py-4">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
              <p className="font-medium">You're in the queue.</p>
              <p className="text-sm text-muted-foreground">
                Thanks, {fullName.split(' ')[0]}. The GasMask team reviews every referral. If you're approved,
                you'll get your invite by text and email — keep an eye out.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ref-name">Full name *</Label>
                <Input id="ref-name" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ref-phone">Phone</Label>
                <Input id="ref-phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 ..." type="tel" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ref-email">Email</Label>
                <Input id="ref-email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" type="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ref-region">Area you cover</Label>
                <Input id="ref-region" value={region} onChange={e => setRegion(e.target.value)} placeholder="e.g. Brooklyn — Bed-Stuy" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ref-notes">Anything we should know?</Label>
                <Textarea
                  id="ref-notes"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Experience, availability, how you know your referrer…"
                  rows={3}
                />
              </div>
              <p className="text-xs text-muted-foreground">* Name plus at least one way to reach you (phone or email).</p>
              {formError && (
                <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <p>{formError}</p>
                </div>
              )}
              <Button type="submit" className="w-full" disabled={submitReferral.isPending || infoLoading}>
                {submitReferral.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Submit
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Submitting does not make you an ambassador — the owner reviews every referral first.
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
