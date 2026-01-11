import { ProductConversionAdmin } from '@/components/admin/ProductConversionAdmin';

export default function ProductConversions() {
  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Product Conversions</h1>
        <p className="text-muted-foreground">
          Floor 3 — Inventory Engine: Define unit conversion rules for BOX, HALF_BOX, and TUBE
        </p>
      </div>
      
      <ProductConversionAdmin />
    </div>
  );
}
