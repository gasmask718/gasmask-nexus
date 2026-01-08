/**
 * Accept CRM Invite Page
 * Handles the invite acceptance flow when users click the email link
 */
import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Loader2, Mail, Shield } from 'lucide-react';

export default function AcceptCRMInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const token = searchParams.get('token');
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'expired' | 'auth_required'>('loading');
  const [message, setMessage] = useState('');
  const [assignedCrms, setAssignedCrms] = useState<string[]>([]);

  useEffect(() => {
    if (authLoading) return;
    
    if (!token) {
      setStatus('error');
      setMessage('Invalid invitation link. No token provided.');
      return;
    }

    if (!user) {
      setStatus('auth_required');
      setMessage('Please sign in to accept this invitation.');
      return;
    }

    // Accept the invitation
    acceptInvitation();
  }, [token, user, authLoading]);

  const acceptInvitation = async () => {
    if (!token || !user) return;
    
    setStatus('loading');
    
    try {
      const { data, error } = await supabase.functions.invoke('accept-crm-invite', {
        body: { token }
      });

      if (error) throw error;

      if (data.success) {
        setStatus('success');
        setMessage(data.message || 'Invitation accepted successfully!');
        setAssignedCrms(data.crmAccess?.map((a: any) => a.crm_id) || []);
        toast.success('CRM access granted!');
      } else {
        if (data.error?.includes('expired')) {
          setStatus('expired');
        } else {
          setStatus('error');
        }
        setMessage(data.error || 'Failed to accept invitation');
      }
    } catch (err: any) {
      console.error('Accept invite error:', err);
      setStatus('error');
      setMessage(err.message || 'An unexpected error occurred');
    }
  };

  const handleSignIn = () => {
    // Store the current URL to redirect back after sign in
    sessionStorage.setItem('redirectAfterAuth', window.location.href);
    navigate('/auth');
  };

  if (authLoading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <h2 className="text-xl font-semibold">Processing Invitation...</h2>
              <p className="text-muted-foreground mt-2">Please wait while we verify your invitation.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            {status === 'success' && <CheckCircle className="h-16 w-16 text-green-500" />}
            {status === 'error' && <XCircle className="h-16 w-16 text-destructive" />}
            {status === 'expired' && <XCircle className="h-16 w-16 text-amber-500" />}
            {status === 'auth_required' && <Shield className="h-16 w-16 text-primary" />}
          </div>
          <CardTitle>
            {status === 'success' && 'Invitation Accepted!'}
            {status === 'error' && 'Invitation Failed'}
            {status === 'expired' && 'Invitation Expired'}
            {status === 'auth_required' && 'Sign In Required'}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">{message}</p>
          
          {status === 'success' && assignedCrms.length > 0 && (
            <div className="bg-muted rounded-lg p-4 text-left">
              <p className="text-sm font-medium mb-2">You now have access to:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                {assignedCrms.map(crm => (
                  <li key={crm} className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    {crm}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {status === 'success' && (
            <Button onClick={() => navigate('/crm')} className="w-full">
              Go to CRM Dashboard
            </Button>
          )}

          {status === 'auth_required' && (
            <div className="space-y-3">
              <Button onClick={handleSignIn} className="w-full">
                <Mail className="h-4 w-4 mr-2" />
                Sign In to Accept
              </Button>
              <p className="text-xs text-muted-foreground">
                You'll be redirected back here after signing in.
              </p>
            </div>
          )}

          {(status === 'error' || status === 'expired') && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Please contact your administrator for a new invitation.
              </p>
              <Button variant="outline" onClick={() => navigate('/crm')}>
                Go to CRM
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
