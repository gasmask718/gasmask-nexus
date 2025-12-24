import { useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DynamicCRMLayout } from '@/components/crm/dynamic';
import { inferCRMCategory, CRMCategorySlug } from '@/config/crmCategories';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import CRMLayout from './CRMLayout';

export default function DynamicCRMPage() {
  const { businessSlug } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  
  // Get category override from URL if present
  const categoryOverride = searchParams.get('category') as CRMCategorySlug | null;

  // Fetch business by slug
  const { data: business, isLoading, error } = useQuery({
    queryKey: ['business-by-slug', businessSlug],
    queryFn: async () => {
      if (!businessSlug) return null;

      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('slug', businessSlug)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!businessSlug,
  });

  // Infer CRM category from business data
  const crmCategory = useMemo(() => {
    if (categoryOverride) return categoryOverride;
    if (!business) return 'general' as CRMCategorySlug;
    return inferCRMCategory(
      business.business_type,
      business.industry,
      business.slug
    );
  }, [business, categoryOverride]);

  if (isLoading) {
    return (
      <CRMLayout title="Loading...">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </CRMLayout>
    );
  }

  if (error || !business) {
    return (
      <CRMLayout title="Business Not Found">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              {error ? 'Failed to load business' : 'Business not found'}
            </p>
            <Button onClick={() => navigate('/crm')} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to CRM
            </Button>
          </CardContent>
        </Card>
      </CRMLayout>
    );
  }

  return (
    <CRMLayout title={business.name}>
      <div className="space-y-6">
        {/* Header with back button */}
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate('/crm')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{business.name} CRM</h1>
            <p className="text-sm text-muted-foreground">
              {business.tagline || business.short_description || 'Dynamic CRM'}
            </p>
          </div>
        </div>

        {/* Dynamic CRM Layout based on category */}
        <DynamicCRMLayout
          businessSlug={business.slug}
          businessType={business.business_type}
          industry={business.industry}
          categoryOverride={categoryOverride}
          selectedEntityId={selectedEntityId}
          onEntitySelect={setSelectedEntityId}
        />
      </div>
    </CRMLayout>
  );
}
