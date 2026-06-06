import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Lock, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import DynastyDirectCatalogOnboard from '@/pages/dynasty-direct/DynastyDirectCatalogOnboard';

/**
 * Wholesaler self-serve catalog onboarding (Phase 2).
 *
 * Gated by dd_config.wholesaler_self_serve_enabled (default OFF). Even when the
 * flag is later flipped on, the DB trigger `dd_enforce_self_serve_review` forces
 * any non-admin draft transition to 'published' into 'pending_admin_review' so
 * David's exactness gate is non-bypassable.
 */
export default function WholesalerCatalogOnboard() {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    supabase
      .from('dd_config')
      .select('wholesaler_self_serve_enabled')
      .eq('id', true)
      .maybeSingle()
      .then(({ data }) => setEnabled(Boolean((data as any)?.wholesaler_self_serve_enabled)));
  }, []);

  if (enabled === null) {
    return (
      <div className="flex items-center gap-2 p-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" /> Self-Serve Catalog — Coming Soon
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The self-serve product onboarding wizard is built and ready, but currently disabled
              by the platform admin. For now, please send your product photos and details to your
              Dynasty Direct contact and they will publish on your behalf.
            </p>
            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle>Admin review is permanent</AlertTitle>
              <AlertDescription>
                Even when self-serve is enabled, every submission passes through the admin
                exactness gate before it goes live on the public site.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <Alert className="m-4">
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Submissions are reviewed before going live</AlertTitle>
        <AlertDescription>
          Your draft will be sent to the Dynasty Direct admin queue for the exactness gate.
          You'll be notified when it's published.
        </AlertDescription>
      </Alert>
      <DynastyDirectCatalogOnboard />
    </div>
  );
}
