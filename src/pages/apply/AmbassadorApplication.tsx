/**
 * Ambassador Application Page - Public form for ambassador recruitment
 * Route: /apply/ambassador?ref=REFCODE
 */
import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const applicationSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Please enter a valid email'),
  phone: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  experience: z.string().optional(),
  motivation: z.string().min(10, 'Please tell us why you want to join (at least 10 characters)').max(1000),
});

type ApplicationFormData = z.infer<typeof applicationSchema>;

export default function AmbassadorApplication() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const referralCode = searchParams.get('ref');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [referrerInfo, setReferrerInfo] = useState<{ id: string; name: string } | null>(null);
  const [referrerError, setReferrerError] = useState(false);

  const form = useForm<ApplicationFormData>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      full_name: '',
      email: '',
      phone: '',
      city: '',
      state: '',
      experience: '',
      motivation: '',
    },
  });

  // Validate referral code and get referrer info
  useEffect(() => {
    if (!referralCode) {
      setReferrerError(true);
      return;
    }

    const validateReferrer = async () => {
      const { data, error } = await supabase
        .from('ambassadors')
        .select('id, name')
        .or(`referral_code.eq.${referralCode},tracking_code.eq.${referralCode}`)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        setReferrerError(true);
        return;
      }

      setReferrerInfo({ id: data.id, name: data.name || 'Ambassador' });
    };

    validateReferrer();
  }, [referralCode]);

  const onSubmit = async (data: ApplicationFormData) => {
    if (!referrerInfo) {
      toast.error('Invalid referral code');
      return;
    }

    setIsSubmitting(true);

    try {
      // Call the edge function to insert into unforgettable_ambassadors
      const { data: result, error } = await supabase.functions.invoke('submit-ut-ambassador', {
        body: {
          full_name: data.full_name,
          email: data.email,
          phone: data.phone || '',
          state: data.state || '',
          referral_source: referralCode || undefined,
          motivation: data.motivation || undefined,
          city: data.city || undefined,
          experience: data.experience || undefined,
        },
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      setSubmitted(true);
      toast.success('Application submitted successfully!');
    } catch (error: any) {
      console.error('Application error:', error);
      toast.error(error.message || 'Failed to submit application');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Invalid referral code
  if (referrerError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-16 w-16 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-bold mb-2">Invalid Referral Link</h2>
            <p className="text-muted-foreground mb-4">
              This referral link is invalid or has expired. Please contact the ambassador who shared this link with you.
            </p>
            <Button variant="outline" onClick={() => navigate('/')}>
              Go to Homepage
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="h-16 w-16 mx-auto text-green-500 mb-4" />
            <h2 className="text-xl font-bold mb-2">Application Submitted!</h2>
            <p className="text-muted-foreground mb-4">
              Thank you for applying. Our team will review your application and get back to you soon.
            </p>
            <p className="text-sm text-muted-foreground">
              Referred by: <span className="font-medium">{referrerInfo?.name}</span>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <User className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Join Our Ambassador Program</CardTitle>
          <CardDescription>
            {referrerInfo ? (
              <>Referred by <span className="font-medium text-foreground">{referrerInfo.name}</span></>
            ) : (
              'Complete your application below'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                  id="full_name"
                  placeholder="Your full name"
                  {...form.register('full_name')}
                />
                {form.formState.errors.full_name && (
                  <p className="text-xs text-destructive">{form.formState.errors.full_name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  {...form.register('email')}
                />
                {form.formState.errors.email && (
                  <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 000-0000"
                {...form.register('phone')}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  placeholder="Your city"
                  {...form.register('city')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  placeholder="Your state"
                  {...form.register('state')}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="experience">Relevant Experience</Label>
              <Textarea
                id="experience"
                placeholder="Tell us about your sales or networking experience..."
                rows={3}
                {...form.register('experience')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="motivation">Why do you want to join? *</Label>
              <Textarea
                id="motivation"
                placeholder="What motivates you to become an ambassador?"
                rows={4}
                {...form.register('motivation')}
              />
              {form.formState.errors.motivation && (
                <p className="text-xs text-destructive">{form.formState.errors.motivation.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Application'
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              By submitting, you agree to be contacted regarding your application.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
