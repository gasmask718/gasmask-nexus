import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, FileText, Camera, Hash } from 'lucide-react';
import { DDShell } from '@/components/dynasty-direct/DDShell';
import { DDPageHeader } from '@/components/dynasty-direct/DDPageHeader';
import { DDEmpty, DDSkeleton, DDErrorCard } from '@/components/dynasty-direct/DDStates';

interface Brief {
  id: string;
  product_name: string;
  hero_image_url: string | null;
  status: string;
  ugc_concepts: any[];
  photoshoot_concepts: any[];
  social_captions: any[];
  created_at: string;
}

export default function DynastyDirectContentLibrary() {
  const { data: briefs = [], isLoading, error, refetch } = useQuery({
    queryKey: ['dd-content-briefs'],
    queryFn: async () => {
      const { data, error } = await (supabase.from('dd_content_briefs') as any)
        .select('*').order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return (data || []) as Brief[];
    },
  });

  return (
    <DDShell>
      <DDPageHeader
        icon={Sparkles}
        title="Content Factory Library"
        purpose="Per-product UGC scripts, photoshoot concepts, and social captions."
        crumbs={[{ label: 'Content Library' }]}
      />

      {isLoading && <DDSkeleton rows={4} />}
      {error && <DDErrorCard error={error} onRetry={() => refetch()} />}
      {!isLoading && !error && briefs.length === 0 && (
        <DDEmpty
          icon={Sparkles}
          title="No content briefs yet"
          description="Onboard your first product, then tap Send to Content Factory on the Confirm step — you'll see UGC scripts, photoshoot concepts, and platform-ready captions here."
          actionLabel="Onboard your first product"
          actionHref="/dynasty-direct/catalog/onboard"
        />
      )}

      <div className="grid gap-4 mt-2">
        {briefs.map((b) => (
          <Card key={b.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  {b.hero_image_url && <img src={b.hero_image_url} className="w-10 h-10 rounded object-cover" alt="" />}
                  {b.product_name}
                </span>
                <Badge variant={b.status === 'ready' ? 'default' : b.status === 'failed' ? 'destructive' : 'secondary'}>
                  {b.status}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-4">
              <div>
                <div className="text-xs font-semibold mb-2 flex items-center gap-1"><FileText className="h-3 w-3" /> UGC ({b.ugc_concepts?.length || 0})</div>
                <div className="space-y-2 text-xs">
                  {(b.ugc_concepts || []).slice(0, 3).map((u: any, i: number) => (
                    <div key={i} className="border rounded p-2">
                      <div className="font-medium">{u.hook}</div>
                      <div className="text-muted-foreground line-clamp-2">{u.script}</div>
                      <Badge variant="outline" className="mt-1 text-[10px]">{u.platform}</Badge>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold mb-2 flex items-center gap-1"><Camera className="h-3 w-3" /> Photoshoots ({b.photoshoot_concepts?.length || 0})</div>
                <div className="space-y-2 text-xs">
                  {(b.photoshoot_concepts || []).slice(0, 3).map((p: any, i: number) => (
                    <div key={i} className="border rounded p-2">
                      <div className="font-medium">{p.title}</div>
                      <div className="text-muted-foreground line-clamp-2">{p.mood}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold mb-2 flex items-center gap-1"><Hash className="h-3 w-3" /> Captions ({b.social_captions?.length || 0})</div>
                <div className="space-y-2 text-xs">
                  {(b.social_captions || []).slice(0, 3).map((c: any, i: number) => (
                    <div key={i} className="border rounded p-2">
                      <Badge variant="outline" className="mb-1 text-[10px]">{c.platform}</Badge>
                      <div className="line-clamp-2">{c.caption}</div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </DDShell>
  );
}
