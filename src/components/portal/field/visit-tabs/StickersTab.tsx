import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Sticker } from 'lucide-react';

interface StickerData {
  frontDoor: boolean;
  authorizedRetailer: boolean;
  brandCharacter: boolean;
  telephoneNumber: boolean;
  notes: string;
}

interface StickersTabProps {
  brands: { id: string; name: string }[];
  stickers: Record<string, StickerData>;
  onStickersChange: (stickers: Record<string, StickerData>) => void;
}

export function StickersTab({ brands, stickers, onStickersChange }: StickersTabProps) {
  const updateBrandStickers = (brandId: string, updates: Partial<StickerData>) => {
    onStickersChange({
      ...stickers,
      [brandId]: {
        ...stickers[brandId],
        ...updates,
      },
    });
  };

  const stickerTypes = [
    { key: 'frontDoor', label: 'Front Door Sticker' },
    { key: 'authorizedRetailer', label: 'Authorized Retailer Sticker' },
    { key: 'brandCharacter', label: 'Brand Character Sticker' },
    { key: 'telephoneNumber', label: 'Telephone Number Sticker' },
  ] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Sticker className="h-5 w-5" />
          Brand Stickers
        </CardTitle>
        <CardDescription>
          Check which stickers are displayed for each brand. Changes will be proposed for review.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="w-full">
          {brands.map((brand) => (
            <AccordionItem key={brand.id} value={brand.id}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="font-bold text-xs text-primary">
                      {brand.name.charAt(0)}
                    </span>
                  </div>
                  <span>{brand.name}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4">
                <div className="space-y-4">
                  {/* Sticker Toggles */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {stickerTypes.map((type) => (
                      <div key={type.key} className="flex items-center justify-between p-3 rounded-lg border">
                        <Label htmlFor={`${brand.id}-${type.key}`} className="cursor-pointer">
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
                    <Label>Notes for {brand.name}</Label>
                    <Textarea
                      placeholder="Any observations about sticker placement or condition..."
                      value={stickers[brand.id]?.notes || ''}
                      onChange={(e) => 
                        updateBrandStickers(brand.id, { notes: e.target.value })
                      }
                      rows={2}
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
