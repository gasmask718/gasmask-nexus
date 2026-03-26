import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Image, Star, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePartnerMedia } from '@/hooks/useUTPartnerPortal';

interface Props { partnerId: string; }

export default function UTPartnerMedia({ partnerId }: Props) {
  const { data: media = [] } = usePartnerMedia(partnerId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Media Library ({media.length})</h3>
        <Button size="sm"><Upload className="h-4 w-4 mr-1" /> Upload</Button>
      </div>

      {media.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Image className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No media uploaded yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Upload photos and videos to enhance your listings</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {media.map(item => (
            <div key={item.id} className="relative group rounded-lg overflow-hidden border border-border/50 aspect-square bg-muted">
              {item.file_type === 'image' ? (
                <img src={item.file_url} alt={item.title || ''} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Image className="h-8 w-8 text-muted-foreground/40" />
                </div>
              )}
              {item.is_hero && (
                <Badge className="absolute top-1 left-1 text-[9px] bg-amber-500/90">
                  <Star className="h-2.5 w-2.5 mr-0.5" /> Hero
                </Badge>
              )}
              {item.quality_score != null && (
                <Badge variant="outline" className="absolute bottom-1 right-1 text-[9px] bg-background/80">
                  Q: {item.quality_score}
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
