import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useOrganizationManagement } from '@/services/organization/useOrganization';
import { Users, ArrowRight } from 'lucide-react';

interface JoinOrganizationProps {
  onSuccess?: () => void;
}

export function JoinOrganization({ onSuccess }: JoinOrganizationProps) {
  const [inviteCode, setInviteCode] = useState('');
  const { acceptInvite } = useOrganizationManagement(undefined);

  const handleJoin = async () => {
    if (!inviteCode.trim()) return;
    
    try {
      await acceptInvite.mutateAsync(inviteCode.trim().toUpperCase());
      onSuccess?.();
    } catch (error) {
      // Error handled by hook
    }
  };

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Users className="h-6 w-6 text-primary" />
        </div>
        <CardTitle>Join an Organization</CardTitle>
        <CardDescription>
          Enter the invite code you received to join an existing organization
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Invite Code</Label>
          <Input
            placeholder="ABCD1234"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            className="text-center text-lg tracking-widest font-mono"
            maxLength={8}
          />
        </div>
        <Button 
          className="w-full" 
          onClick={handleJoin}
          disabled={acceptInvite.isPending || inviteCode.length < 8}
        >
          {acceptInvite.isPending ? 'Joining...' : 'Join Organization'}
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}

export default JoinOrganization;
