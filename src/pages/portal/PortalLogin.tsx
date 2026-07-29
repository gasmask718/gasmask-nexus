import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmailInput } from '@/components/ui/email-input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Package, Mail, Phone } from 'lucide-react';

/**
 * Customer Portal login — uses REAL Supabase auth (OTP).
 * Email → magic link. Phone → SMS code + verification step.
 * This creates a real session so RLS policies actually apply.
 */
const PortalLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('email');
  const [stage, setStage] = useState<'request' | 'verify'>('request');
  const [isLoading, setIsLoading] = useState(false);

  const requestOtp = async () => {
    setIsLoading(true);
    try {
      if (loginMethod === 'email') {
        if (!email) { toast.error('Please enter your email'); return; }
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}/portal/dashboard` },
        });
        if (error) throw error;
        toast.success('Check your email for the sign-in link.');
      } else {
        if (!phone) { toast.error('Please enter your phone number'); return; }
        const { error } = await supabase.auth.signInWithOtp({ phone });
        if (error) throw error;
        toast.success('We sent you a 6-digit code by SMS.');
        setStage('verify');
      }
    } catch (err: any) {
      console.error('Portal login error:', err);
      toast.error(err.message || 'Could not start sign-in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async () => {
    setIsLoading(true);
    try {
      if (!otpCode) { toast.error('Enter the 6-digit code'); return; }
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token: otpCode,
        type: 'sms',
      });
      if (error) throw error;
      if (!data.session) throw new Error('No session returned');
      toast.success('Signed in!');
      navigate('/portal/dashboard');
    } catch (err: any) {
      console.error('OTP verify error:', err);
      toast.error(err.message || 'Verification failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
              <Package className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">Customer Portal</h1>
          <p className="text-muted-foreground">Access your invoices and billing</p>
        </div>

        {stage === 'request' ? (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={loginMethod === 'email' ? 'default' : 'outline'}
                onClick={() => setLoginMethod('email')}
                className="flex-1"
              >
                <Mail className="mr-2 h-4 w-4" /> Email
              </Button>
              <Button
                variant={loginMethod === 'phone' ? 'default' : 'outline'}
                onClick={() => setLoginMethod('phone')}
                className="flex-1"
              >
                <Phone className="mr-2 h-4 w-4" /> Phone
              </Button>
            </div>

            {loginMethod === 'email' ? (
              <div className="space-y-2">
                <label className="text-sm font-medium">Email Address</label>
                <EmailInput
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={setEmail}
                  onKeyPress={(e) => e.key === 'Enter' && requestOtp()}
                />
                <p className="text-xs text-muted-foreground">We'll email you a secure sign-in link.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone Number</label>
                <Input
                  type="tel"
                  placeholder="+15551234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && requestOtp()}
                />
                <p className="text-xs text-muted-foreground">Enter in international format (e.g. +1…). We'll text a 6-digit code.</p>
              </div>
            )}

            <Button className="w-full" onClick={requestOtp} disabled={isLoading}>
              {isLoading ? 'Sending…' : loginMethod === 'email' ? 'Send Magic Link' : 'Send Code'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Verification Code</label>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                onKeyPress={(e) => e.key === 'Enter' && verifyOtp()}
              />
              <p className="text-xs text-muted-foreground">Enter the code we texted to {phone}.</p>
            </div>
            <Button className="w-full" onClick={verifyOtp} disabled={isLoading}>
              {isLoading ? 'Verifying…' : 'Verify & Sign In'}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => { setStage('request'); setOtpCode(''); }}
              disabled={isLoading}
            >
              Use a different number
            </Button>
          </div>
        )}

        <p className="text-xs text-center text-muted-foreground">
          By logging in, you agree to our Terms of Service and Privacy Policy
        </p>
      </Card>
    </div>
  );
};

export default PortalLogin;
