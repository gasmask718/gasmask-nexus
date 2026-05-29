import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sticker, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { BrandStickersCard } from '@/components/store/BrandStickersCard';
import { TubeIntelRole } from '@/hooks/useTubeIntelligence';

interface StickersTabProps {
  storeId: string;
  role?: TubeIntelRole;
}

/**
 * UNIFIED STICKERS TAB
 * 
 * This component uses the canonical BrandStickersCard which provides:
 * - 4 approved brands (GasMask, Hot Mama, Hotscolatti, Grabba R Us)
 * - 4 sticker types per brand (Front Door, Brand Character, Authorized Retailer, Telephone Number)
 * - Installed/Requested status per sticker
 * - Per-sticker notes with red indicator when present
 * - Per-sticker date tracking (Put On, Last Seen)
 * - Mark Seen action for field verification
 * - Role-based permissions (Driver = read-only)
 * 
 * Role Scope: Biker, Driver, Ambassador, Admin
 */
export function StickersTab({ storeId, role = 'admin' }: StickersTabProps) {
  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Sticker className="h-4 w-4" />
              Brand Stickers & Compliance
            </CardTitle>
            <Badge variant="outline" className="gap-1">
              <ShieldCheck className="h-3 w-3" />
              4 Approved Brands
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Record which stickers are installed for each brand. Mark stickers as seen during visits.
            {role === 'driver' && (
              <span className="text-orange-500 ml-1">(Read-only for drivers)</span>
            )}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Canonical Brand Stickers Card */}
      <BrandStickersCard 
        storeId={storeId} 
        role={role}
      />
    </div>
  );
}
