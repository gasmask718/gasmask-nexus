import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CANONICAL_BRANDS, CANONICAL_BRAND_IDS, type CanonicalBrandId } from '@/config/brands';

interface BrandSelectorProps {
  value: CanonicalBrandId;
  onChange: (brand: CanonicalBrandId) => void;
}

export function BrandCRMSelector({ value, onChange }: BrandSelectorProps) {
  const brand = CANONICAL_BRANDS[value];

  return (
    <Select value={value} onValueChange={v => onChange(v as CanonicalBrandId)}>
      <SelectTrigger className="w-[200px] border-2" style={{ borderColor: brand.primaryColor }}>
        <SelectValue>
          <div className="flex items-center gap-2">
            <span>{brand.icon}</span>
            <span className="font-medium">{brand.displayName}</span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {CANONICAL_BRAND_IDS.map(id => {
          const b = CANONICAL_BRANDS[id];
          return (
            <SelectItem key={id} value={id}>
              <div className="flex items-center gap-2">
                <span>{b.icon}</span>
                <span>{b.displayName}</span>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
