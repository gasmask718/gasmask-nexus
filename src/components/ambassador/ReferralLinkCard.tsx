/**
 * ReferralLinkCard — GasMask ambassador referral link + referral status.
 *
 * The shareable link sends recruits to /ambassador-referral/:code (public form).
 * Submissions become PENDING referrals for owner approval — recruits never
 * become ambassadors automatically. The ambassador sees their own list and
 * counts (referred / approved), which is the recruiting motivator.
 *
 * It deliberately does NOT link to /apply/ambassador — that form feeds the
 * Unforgettable Times programme's table, which is a different business.
 */
import { useState } from 'react';
import { Copy, Check, Users, Clock, CheckCircle2, XCircle, Link2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { useMyAmbassadorIdentity, useMyReferrals } from '@/hooks/useAmbassadorReferrals';

export function ReferralLinkCard() {
  const { data: identity, isLoading: identityLoading } = useMyAmbassadorIdentity();
  const { data: referrals = [], isLoading: referralsLoading } = useMyReferrals();
  const [copied, setCopied] = useState(false);

  if (identityLoading || referralsLoading) return null;
  if (!identity) return null;

  const referralLink = identity.tracking_code
    ? `${window.location.origin}/ambassador-referral/${identity.tracking_code}`
    : null;

  const totalReferred = referrals.length;
  const approvedCount = referrals.filter(r => r.status === 'approved').length;
  const pendingCount = referrals.filter(r => r.status === 'pending').length;

  const handleCopy = async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success('Referral link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — long-press the link to copy it manually');
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="default" className="text-xs shrink-0 gap-1"><CheckCircle2 className="h-3 w-3" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="text-xs shrink-0 gap-1"><XCircle className="h-3 w-3" />Declined</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs shrink-0 gap-1"><Clock className="h-3 w-3" />Pending review</Badge>;
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              Your Referral Link
            </CardTitle>
            <CardDescription className="text-xs">
              Share it — recruits apply themselves, the owner approves, you get the credit.
            </CardDescription>
          </div>
          {totalReferred > 0 && (
            <Badge variant="secondary" className="shrink-0">
              {totalReferred} referred · {approvedCount} approved
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {referralLink ? (
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-muted/50 border rounded px-2 py-2 truncate select-all">
              {referralLink}
            </code>
            <Button size="sm" variant="outline" onClick={handleCopy} className="shrink-0">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground bg-muted/30 border rounded p-2">
            No referral code on your profile yet — ask an admin to generate one.
          </p>
        )}

        {referrals.slice(0, 6).map(ref => (
          <div key={ref.id} className="flex items-center justify-between text-xs p-2 bg-muted/30 rounded border">
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="font-medium truncate">{ref.full_name}</span>
              <span className="text-muted-foreground truncate">
                {[ref.territory, ref.phone || ref.email].filter(Boolean).join(' · ') || 'No contact details'}
              </span>
              {ref.status === 'rejected' && ref.show_review_notes && ref.review_notes && (
                <span className="text-muted-foreground/70 italic truncate">
                  Reason: {ref.review_notes}
                </span>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
              {statusBadge(ref.status)}
              <span className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(ref.created_at), { addSuffix: true })}
              </span>
            </div>
          </div>
        ))}

        {referrals.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Nobody has used your link yet. Share it to start building your team.
          </p>
        )}

        {pendingCount > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            {pendingCount} waiting on owner review.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default ReferralLinkCard;
