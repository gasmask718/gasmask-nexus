import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Lock, ShieldCheck, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import DynastyDirectCatalogOnboard from '@/pages/dynasty-direct/DynastyDirectCatalogOnboard';

/**
 * Wholesaler self-serve catalog onboarding (Phase 2).
 *
 * - Gated by dd_config.wholesaler_self_serve_enabled.
 * - supplier_id is auto-bound from the authed wholesaler — they can ONLY upload to themselves.
 * - Submission lands as dd_catalog_drafts.status='pending_admin_review' (no products_all write).
 * - DB triggers (dd_enforce_self_serve_review + dd_enforce_catalog_confirm_gate) make this
 *   non-bypassable even if a wholesaler crafts a direct INSERT/UPDATE.
 */
export default function WholesalerCatalogOnboard() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [supplier, setSupplier] = useState<{ id: string; name: string } | null>(null);
  const [resolving, setResolving] = useState(true);
  const [resolveError, setResolveError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: flag } = await supabase
        .from('dd_config')
        .select('wholesaler_self_serve_enabled')
        .eq('id', true)
        .maybeSingle();
      setEnabled(Boolean((flag as any)?.wholesaler_self_serve_enabled));

      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) { setResolveError('Sign in as a wholesaler to continue.'); setResolving(false); return; }
      const { data: prof, error } = await supabase
        .from('wholesaler_profiles')
        .select('id, company_name')
        .eq('user_id', uid)
        .maybeSingle();
      if (error) { setResolveError(error.message); setResolving(false); return; }
      if (!prof) { setResolveError('No wholesaler profile is attached to your account.'); setResolving(false); return; }
      setSupplier({ id: (prof as any).id, name: (prof as any).company_name });
      setResolving(false);
    })();
  }, []);

  if (enabled === null || resolving) {
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

  if (resolveError || !supplier) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Cannot start onboarding</AlertTitle>
          <AlertDescription>{resolveError || 'No wholesaler profile.'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (advanced) {
    return (
      <div>
        <div className="flex items-center justify-between px-4 pt-4">
          <Button variant="ghost" size="sm" onClick={() => setAdvanced(false)}>
            <Camera className="h-4 w-4 mr-2" /> Back to camera
          </Button>
        </div>
        <DynastyDirectCatalogOnboard
          lockedSupplierId={supplier.id}
          lockedSupplierName={supplier.name}
          submitForReviewMode
        />
      </div>
    );
  }

  return (
    <div>
      <QuickAddCamera supplierId={supplier.id} supplierName={supplier.name} />
      <div className="pb-8 text-center">
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setAdvanced(true)}>
          Use the full form instead
        </Button>
      </div>
    </div>
  );
}

