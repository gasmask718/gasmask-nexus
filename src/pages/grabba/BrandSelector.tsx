import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GRABBA_BRAND_CONFIG, GrabbaBrand } from '@/config/grabbaBrands';
import { ArrowRight, Building2 } from 'lucide-react';

/**
 * Brand Selector Page - Shows all available brands for CRM access
 * Redirects to individual Brand CRM pages
 */
export default function BrandSelector() {
  const navigate = useNavigate();
  
  const brands = Object.entries(GRABBA_BRAND_CONFIG) as [GrabbaBrand, typeof GRABBA_BRAND_CONFIG[GrabbaBrand]][];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Building2 className="w-8 h-8" />
            Brand CRM Selector
          </h1>
          <p className="text-muted-foreground mt-2">
            Select a brand to view its dedicated CRM dashboard
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {brands.map(([key, config]) => (
          <Card 
            key={key}
            className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] border-t-4"
            style={{ borderTopColor: config.primary }}
            onClick={() => navigate(`/grabba/brand/${key}`)}
          >
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-3">
                <span className="text-2xl">{config.icon}</span>
                <span style={{ color: config.primary }}>{config.label}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Badge 
                  variant="outline" 
                  style={{ 
                    backgroundColor: `${config.primary}20`,
                    borderColor: config.primary,
                    color: config.primary 
                  }}
                >
                  {config.name}
                </Badge>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="gap-1"
                  style={{ color: config.primary }}
                >
                  Open CRM
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
