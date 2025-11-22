import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Package, Mail, Phone } from 'lucide-react';

const PortalLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('email');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);

    try {
      const identifier = loginMethod === 'email' ? email : phone;
      
      if (!identifier) {
        toast.error('Please enter your ' + loginMethod);
        setIsLoading(false);
        return;
      }

      // Find customer by email or phone
      const { data: customer, error: customerError } = await supabase
        .from('crm_customers')
        .select('id, name, email, phone')
        .or(`email.eq.${email},phone.eq.${phone}`)
        .single();

      if (customerError || !customer) {
        toast.error('Customer not found. Please contact support.');
        setIsLoading(false);
        return;
      }

      // Generate session token
      const sessionToken = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour session

      const { error: sessionError } = await supabase
        .from('customer_portal_sessions')
        .insert({
          customer_id: customer.id,
          session_token: sessionToken,
          expires_at: expiresAt.toISOString(),
        });

      if (sessionError) throw sessionError;

      // Store session token in localStorage
      localStorage.setItem('portal_session', sessionToken);
      localStorage.setItem('portal_customer_id', customer.id);

      toast.success(`Welcome back, ${customer.name}!`);
      navigate('/portal/dashboard');
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error('Login failed. Please try again.');
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

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={loginMethod === 'email' ? 'default' : 'outline'}
              onClick={() => setLoginMethod('email')}
              className="flex-1"
            >
              <Mail className="mr-2 h-4 w-4" />
              Email
            </Button>
            <Button
              variant={loginMethod === 'phone' ? 'default' : 'outline'}
              onClick={() => setLoginMethod('phone')}
              className="flex-1"
            >
              <Phone className="mr-2 h-4 w-4" />
              Phone
            </Button>
          </div>

          {loginMethod === 'email' ? (
            <div className="space-y-2">
              <label className="text-sm font-medium">Email Address</label>
              <Input
                type="email"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-medium">Phone Number</label>
              <Input
                type="tel"
                placeholder="(555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>
          )}

          <Button
            className="w-full"
            onClick={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? 'Logging in...' : 'Access Portal'}
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          By logging in, you agree to our Terms of Service and Privacy Policy
        </p>
      </Card>
    </div>
  );
};

export default PortalLogin;