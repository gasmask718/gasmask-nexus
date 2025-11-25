import { useLocation } from 'react-router-dom';
import { getBrandById } from '@/config/dynastyBrands';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Construction } from 'lucide-react';

export default function BrandPlaceholder() {
  const location = useLocation();
  
  // Extract brand ID from the path (e.g., /gasmask/* -> gasmask)
  const brandId = location.pathname.split('/')[1];
  const brandConfig = brandId ? getBrandById(brandId) : undefined;

  if (!brandConfig) {
    return (
      <div className="container mx-auto p-6">
        <Card className="p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Brand Not Found</h1>
          <p className="text-muted-foreground">The requested brand configuration could not be found.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div
        className="rounded-lg p-6 mb-6"
        style={{
          backgroundColor: `${brandConfig.colors.primary}10`,
          borderLeft: `4px solid ${brandConfig.colors.primary}`
        }}
      >
        <h1
          className="text-3xl font-bold mb-2"
          style={{ color: brandConfig.colors.primary }}
        >
          {brandConfig.name}
        </h1>
        <p className="text-muted-foreground">{brandConfig.style}</p>
      </div>

      <Card className="p-8">
        <div className="text-center space-y-4">
          <Construction className="h-16 w-16 mx-auto text-muted-foreground" />
          <h2 className="text-2xl font-bold">Coming Soon</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            This brand's dashboard and tools are currently under construction. Check back soon for updates.
          </p>
          <div className="pt-4">
            <Button variant="outline" onClick={() => window.history.back()}>
              Go Back
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
