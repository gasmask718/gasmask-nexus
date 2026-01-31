import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Sticker, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { 
  STICKER_BRANDS, 
  STICKER_TYPES, 
  type StickerData,
  type StickerBrandId 
} from '@/config/stickerBrands';

interface StickersTabProps {
  stickers: Record<string, StickerData>;
  onStickersChange: (stickers: Record<string, StickerData>) => void;
}

/**
 * HARD-LOCKED STICKERS TAB
 * 
 * This component ONLY displays the 4 approved brands (Gasmask, HotMama, HotScolati, GrabbaRus)
 * with exactly 4 sticker types each. No external brand data is accepted.
 * 
 * Role Scope: Biker and Driver ONLY
 */
export function StickersTab({ stickers, onStickersChange }: StickersTabProps) {
  const updateBrandStickers = (brandId: StickerBrandId, updates: Partial<StickerData>) => {
    onStickersChange({
      ...stickers,
      [brandId]: {
        ...stickers[brandId],
        ...updates,
      },
    });
  };

  // Count how many stickers are installed per brand
  const getInstalledCount = (brandId: string): number => {
    const brandData = stickers[brandId];
    if (!brandData) return 0;
    return [
      brandData.frontDoor,
      brandData.authorizedRetailer,
      brandData.brandCharacter,
      brandData.telephoneNumber,
    ].filter(Boolean).length;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sticker className="h-5 w-5" />
            Brand Stickers
          </CardTitle>
          <Badge variant="outline" className="gap-1">
            <ShieldCheck className="h-3 w-3" />
            4 Approved Brands
          </Badge>
        </div>
        <CardDescription>
          Record which stickers are installed for each brand. Only approved brands and sticker types are available.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="w-full">
          {STICKER_BRANDS.map((brand) => {
            const installedCount = getInstalledCount(brand.id);
            return (
              <AccordionItem key={brand.id} value={brand.id}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3 w-full">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <span className="font-bold text-sm text-primary">
                        {brand.name.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 text-left">
                      <span className="font-medium">{brand.name}</span>
                    </div>
                    <Badge 
                      variant={installedCount > 0 ? "default" : "secondary"}
                      className="mr-2"
                    >
                      {installedCount}/4 Installed
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-4">
                  <div className="space-y-4">
                    {/* Sticker Type Toggles - HARD-LOCKED to 4 types */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      {STICKER_TYPES.map((type) => (
                        <div 
                          key={type.key} 
                          className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                        >
                          <Label 
                            htmlFor={`${brand.id}-${type.key}`} 
                            className="cursor-pointer flex-1"
                          >
                            {type.label}
                          </Label>
                          <Switch
                            id={`${brand.id}-${type.key}`}
                            checked={stickers[brand.id]?.[type.key] || false}
                            onCheckedChange={(checked) => 
                              updateBrandStickers(brand.id, { [type.key]: checked })
                            }
                          />
                        </div>
                      ))}
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                      <Label htmlFor={`${brand.id}-notes`}>
                        Notes for {brand.name}
                      </Label>
                      <Textarea
                        id={`${brand.id}-notes`}
                        placeholder="Any observations about sticker placement or condition..."
                        value={stickers[brand.id]?.notes || ''}
                        onChange={(e) => 
                          updateBrandStickers(brand.id, { notes: e.target.value })
                        }
                        rows={2}
                        className="resize-none"
                      />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        {/* Enforcement Notice */}
        <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-muted">
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <ShieldCheck className="h-3 w-3" />
            Only approved brands and sticker types are available. Changes are submitted to Change Control.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
