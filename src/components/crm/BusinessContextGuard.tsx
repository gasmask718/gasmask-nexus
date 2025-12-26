/**
 * BusinessContextGuard - Ensures business context is present before loading CRM data
 * Blocks queries and shows business selector when no business is selected
 */
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Building2, ChevronRight, AlertTriangle, RefreshCw } from 'lucide-react';

interface BusinessContextGuardProps {
  children: React.ReactNode;
  businessSlug?: string | null;
  requireBusiness?: boolean;
}

interface BusinessCard {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  business_type?: string | null;
  industry?: string | null;
  is_active: boolean;
}

export function BusinessContextGuard({ 
  children, 
  businessSlug, 
  requireBusiness = true 
}: BusinessContextGuardProps) {
  const navigate = useNavigate();

  // Fetch all active businesses
  const { data: businesses = [], isLoading, error, refetch } = useQuery({
    queryKey: ['crm-businesses-guard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('businesses')
        .select('id, name, slug, logo_url, business_type, industry, is_active')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as BusinessCard[];
    },
  });

  // If we don't require business context, just render children
  if (!requireBusiness) {
    return <>{children}</>;
  }

  // If business is provided, render children
  if (businessSlug) {
    return <>{children}</>;
  }

  // No business selected - show business selector
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>Loading businesses...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-12 text-center">
        <AlertTriangle className="h-16 w-16 mx-auto text-destructive mb-4" />
        <h3 className="text-xl font-semibold mb-2">Error Loading Businesses</h3>
        <p className="text-muted-foreground mb-6">
          Could not load business data. Please try again.
        </p>
        <Button onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </Card>
    );
  }

  if (businesses.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Building2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-xl font-semibold mb-2">No Businesses Found</h3>
        <p className="text-muted-foreground mb-6">
          Create a business to get started with the CRM.
        </p>
        <Button onClick={() => navigate('/crm/add-business')}>
          Add Business
        </Button>
      </Card>
    );
  }

  // Show business selector
  return (
    <div className="space-y-6">
      <Card className="border-amber-500/50 bg-amber-500/5">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            <div>
              <h3 className="font-semibold">Business Context Required</h3>
              <p className="text-sm text-muted-foreground">
                Select a business below to view its CRM data. Each business has its own isolated CRM.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Select a Business
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {businesses.map((business) => (
              <Card
                key={business.id}
                className="p-4 cursor-pointer hover:shadow-lg transition-all group border-t-4 hover:border-primary"
                style={{ borderTopColor: 'hsl(var(--primary))' }}
                onClick={() => navigate(`/crm/${business.slug}`)}
              >
                <div className="flex items-center gap-3">
                  {business.logo_url ? (
                    <img
                      src={business.logo_url}
                      alt={business.name}
                      className="w-10 h-10 rounded-lg object-contain"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {business.name.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate group-hover:text-primary transition-colors">
                      {business.name}
                    </h3>
                    {business.industry && (
                      <p className="text-xs text-muted-foreground truncate">
                        {business.industry}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default BusinessContextGuard;
