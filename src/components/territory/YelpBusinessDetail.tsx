import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Star, MapPin, Phone, Clock, DollarSign, Download, Loader2, ExternalLink } from 'lucide-react';

interface YelpBusiness {
  id: string;
  name: string;
  image_url: string;
  url: string;
  review_count: number;
  rating: number;
  categories: { alias: string; title: string }[];
  phone: string;
  display_phone: string;
  location: {
    address1: string;
    city: string;
    state: string;
    zip_code: string;
    display_address: string[];
  };
  coordinates: { latitude: number; longitude: number };
}

interface Review {
  id: string;
  rating: number;
  text: string;
  time_created: string;
  user: { name: string; image_url?: string };
}

interface DetailData {
  hours?: { open: { start: string; end: string; day: number }[]; is_open_now: boolean }[];
  photos?: string[];
  price?: string;
  transactions?: string[];
}

interface Props {
  business: YelpBusiness;
  onBack: () => void;
  onIngest: () => void;
}

export function YelpBusinessDetail({ business, onBack, onIngest }: Props) {
  const [details, setDetails] = useState<DetailData | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [detailRes, reviewRes] = await Promise.all([
          supabase.functions.invoke('yelp-business-search', {
            body: { action: 'details', business_id: business.id },
          }),
          supabase.functions.invoke('yelp-business-search', {
            body: { action: 'reviews', business_id: business.id },
          }),
        ]);

        if (detailRes.data && !detailRes.data.error) {
          setDetails(detailRes.data);
        }
        if (reviewRes.data && !reviewRes.data.error) {
          setReviews(reviewRes.data.reviews || []);
        }
      } catch (err: any) {
        toast({ title: 'Failed to load details', description: err.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [business.id]);

  const renderStars = (rating: number) =>
    Array.from({ length: 5 }, (_, i) => (
      <Star key={i} className={`h-3.5 w-3.5 ${i < Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}`} />
    ));

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const formatTime = (t: string) => {
    const h = parseInt(t.slice(0, 2));
    const m = t.slice(2);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h > 12 ? h - 12 : h || 12}:${m} ${ampm}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Results
        </Button>
        <Button size="sm" onClick={onIngest}>
          <Download className="h-4 w-4 mr-1" /> Ingest This Business
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            {business.image_url && (
              <img src={business.image_url} alt={business.name} className="h-32 w-32 rounded-lg object-cover" />
            )}
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <h2 className="text-xl font-bold">{business.name}</h2>
                <a href={business.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm flex items-center gap-1">
                  Yelp <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div className="flex items-center gap-1 mt-1">
                {renderStars(business.rating)}
                <span className="text-sm text-muted-foreground ml-1">{business.rating} ({business.review_count} reviews)</span>
              </div>
              <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                {business.location.display_address.join(', ')}
              </div>
              {business.display_phone && (
                <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4 shrink-0" />
                  {business.display_phone}
                </div>
              )}
              <div className="flex items-center gap-2 mt-2">
                {details?.price && (
                  <Badge variant="outline"><DollarSign className="h-3 w-3 mr-0.5" />{details.price}</Badge>
                )}
                {business.categories.map(c => (
                  <Badge key={c.alias} variant="secondary" className="text-xs">{c.title}</Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {/* Photos */}
      {details?.photos && details.photos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {details.photos.map((url, i) => (
            <img key={i} src={url} alt={`Photo ${i + 1}`} className="h-24 w-32 rounded-md object-cover shrink-0" loading="lazy" />
          ))}
        </div>
      )}

      {/* Hours */}
      {details?.hours?.[0]?.open && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" /> Hours
              {details.hours[0].is_open_now !== undefined && (
                <Badge variant={details.hours[0].is_open_now ? 'default' : 'secondary'} className="text-xs">
                  {details.hours[0].is_open_now ? 'Open Now' : 'Closed'}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {details.hours[0].open.map((h, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-muted-foreground">{dayNames[h.day]}</span>
                  <span>{formatTime(h.start)} – {formatTime(h.end)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reviews */}
      {reviews.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Yelp Reviews ({reviews.length})</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {reviews.map(r => (
              <div key={r.id} className="border-b last:border-0 pb-3 last:pb-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {r.user.image_url && (
                      <img src={r.user.image_url} alt="" className="h-6 w-6 rounded-full object-cover" />
                    )}
                    <span className="text-sm font-medium">{r.user.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(r.time_created).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-1 mt-1">{renderStars(r.rating)}</div>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-3">{r.text}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
