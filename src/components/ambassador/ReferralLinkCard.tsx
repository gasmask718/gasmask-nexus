/**
 * ReferralLinkCard - Shows ambassador's unique referral link for recruiting
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Copy, Check, Share2, Users, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export function ReferralLinkCard() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  // Get current ambassador's referral code
  const { data: ambassador, isLoading } = useQuery({
    queryKey: ['my-ambassador-referral', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('ambassadors')
        .select('id, referral_code, tracking_code')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Get pending applications count
  const { data: pendingCount } = useQuery({
    queryKey: ['pending-applications-count', ambassador?.id],
    queryFn: async () => {
      if (!ambassador?.id) return 0;
      const { count, error } = await supabase
        .from('ambassador_applications')
        .select('*', { count: 'exact', head: true })
        .eq('referred_by_ambassador_id', ambassador.id)
        .eq('status', 'pending_review');
      if (error) return 0;
      return count || 0;
    },
    enabled: !!ambassador?.id,
  });

  const referralCode = ambassador?.referral_code || ambassador?.tracking_code;
  const referralLink = referralCode 
    ? `${window.location.origin}/apply/ambassador?ref=${referralCode}`
    : null;

  const handleCopy = async () => {
    if (!referralLink) return;
    
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success('Referral link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleShare = async () => {
    if (!referralLink) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Our Ambassador Program',
          text: 'I invite you to join our ambassador program!',
          url: referralLink,
        });
      } catch (err) {
        // User cancelled or share failed
      }
    } else {
      handleCopy();
    }
  };

  if (isLoading) {
    return null;
  }

  if (!referralCode) {
    return null;
  }

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
              Share your link to grow your team
            </CardDescription>
          </div>
          {pendingCount && pendingCount > 0 && (
            <Badge variant="secondary" className="shrink-0">
              {pendingCount} pending
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            value={referralLink || ''}
            readOnly
            className="text-xs bg-muted/30"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={handleCopy}
            className="shrink-0"
          >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={handleShare}
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share Link
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(referralLink!, '_blank')}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Code: <span className="font-mono font-medium">{referralCode}</span>
        </p>
      </CardContent>
    </Card>
  );
}

export default ReferralLinkCard;
