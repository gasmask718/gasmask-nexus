/**
 * ReferralLinkCard — GasMask ambassador recruitment.
 *
 * Adds recruits to the GasMask pipeline (ambassador_leads) with recruiter
 * credit via created_by_ambassador_id. It deliberately does NOT link to
 * /apply/ambassador — that form feeds the Unforgettable Times programme's
 * table, which is a different business. Recruits added here surface in the
 * ambassador's Recruitment pipeline and can be qualified + invited from there.
 */
import { useState } from 'react';
import { UserPlus, Users, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useRecruitmentLeads } from '@/hooks/useRecruitmentLeads';

export function ReferralLinkCard() {
  const { leads, isLoading, ambassadorId, createLead } = useRecruitmentLeads();
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [region, setRegion] = useState('');

  const handleAdd = async () => {
    if (!name.trim()) return;
    const trimmed = contact.trim();
    const isEmail = trimmed.includes('@');
    await createLead.mutateAsync({
      full_name: name.trim(),
      email: isEmail ? trimmed : undefined,
      phone: !isEmail && trimmed ? trimmed : undefined,
      region: region.trim() || undefined,
      notes: 'Added via dashboard recruit card',
    });
    setName('');
    setContact('');
    setRegion('');
  };

  if (isLoading) return null;
  if (!ambassadorId) return null;

  const activeLeads = leads.filter(l => l.status !== 'dead' && l.status !== 'converted').length;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Recruit Ambassadors
            </CardTitle>
            <CardDescription className="text-xs">
              Add someone to your GasMask recruitment pipeline — you get the credit.
            </CardDescription>
          </div>
          {activeLeads > 0 && (
            <Badge variant="secondary" className="shrink-0">
              {activeLeads} in pipeline
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="recruit-name" className="text-xs">Their name</Label>
          <Input
            id="recruit-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="recruit-contact" className="text-xs">Email or phone</Label>
          <Input
            id="recruit-contact"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="email@example.com or +1..."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="recruit-region" className="text-xs">Area (optional)</Label>
          <Input
            id="recruit-region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="e.g. Brooklyn — Bed-Stuy"
          />
        </div>
        <Button
          onClick={handleAdd}
          disabled={!name.trim() || createLead.isPending}
          className="w-full"
          size="sm"
        >
          {createLead.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4 mr-2" />
          )}
          Add to my pipeline
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          Leads appear under Recruitment. Once qualified, generate their invite from there.
        </p>
      </CardContent>
    </Card>
  );
}

export default ReferralLinkCard;
