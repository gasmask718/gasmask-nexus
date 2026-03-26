import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UtensilsCrossed, Users, DollarSign } from 'lucide-react';
import { useCateringMenus } from '@/hooks/useUTPartnerPortal';

interface Props { partnerId: string; }

export default function UTCateringModule({ partnerId }: Props) {
  const { data: menus = [] } = useCateringMenus(partnerId);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold flex items-center gap-2">
          <UtensilsCrossed className="h-4 w-4 text-primary" /> Menus & Packages
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">Manage catering menus, beverage packages, and service styles</p>
      </div>

      {menus.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <UtensilsCrossed className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No menus created yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {menus.map(menu => (
            <Card key={menu.id} className="border-border/50">
              <CardContent className="pt-4 pb-3">
                <h4 className="font-semibold text-sm mb-1">{menu.menu_name}</h4>
                <p className="text-xs text-muted-foreground mb-2">{menu.cuisine_type} • {menu.service_style}</p>
                <div className="flex flex-wrap gap-2">
                  {menu.price_per_guest && (
                    <Badge variant="outline" className="text-[10px]">
                      <DollarSign className="h-3 w-3 mr-0.5" />${Number(menu.price_per_guest).toFixed(0)}/guest
                    </Badge>
                  )}
                  {menu.minimum_guests && (
                    <Badge variant="outline" className="text-[10px]">
                      <Users className="h-3 w-3 mr-0.5" /> Min {menu.minimum_guests}
                    </Badge>
                  )}
                  {(menu.dietary_options as string[] || []).map((d: string) => (
                    <Badge key={d} variant="secondary" className="text-[10px]">{d}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
