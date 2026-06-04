import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Sparkles, FileText, Camera, Hash } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();
  const { data: briefs = [], isLoading } = useQuery({
    queryKey: ['dd-content-briefs'],
    queryFn: async () => {
      const { data, error } = await (supabase.from('dd_content_briefs') as any)
        .select('*').order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return (data || []) as Brief[];
    },
  });

  return (
    <div className="min-h-screen bg-background p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dynasty-direct')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Dynasty Direct
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" /> Content Factory Library
          </h1>
          <p className="text-sm text-muted-foreground">Per-product UGC scripts, photoshoot concepts, and social captions.</p>
        </div>
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">Loading briefs…</div>}
      {!isLoading && briefs.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          No briefs yet. Onboard a product and click <strong>Send to Content Factory</strong> on the Confirm step.
        </CardContent></Card>
      )}

      <div className="grid gap-4">
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
    </div>
  );
}
