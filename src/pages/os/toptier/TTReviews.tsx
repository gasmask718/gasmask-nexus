import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTopTierData, patchTopTierData } from '@/lib/toptierApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Star, MessageSquare, Award, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function TTReviews() {
  const queryClient = useQueryClient();
  const [ratingFilter, setRatingFilter] = useState('all');
  const [respondModal, setRespondModal] = useState<any>(null);
  const [responseText, setResponseText] = useState('');

  const { data: reviews, isLoading } = useQuery({
    queryKey: ['tt-reviews'],
    queryFn: () => fetchTopTierData('tt_customer_reviews', { select: '*', order: 'created_at.desc' }),
  });

  const kpis = useMemo(() => {
    if (!reviews?.length) return { avg: 0, total: 0, fiveStar: 0, fourStar: 0 };
    const avg = (reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length).toFixed(1);
    const fiveStar = Math.round((reviews.filter((r: any) => r.rating === 5).length / reviews.length) * 100);
    const fourStar = Math.round((reviews.filter((r: any) => r.rating === 4).length / reviews.length) * 100);
    return { avg: parseFloat(avg), total: reviews.length, fiveStar, fourStar };
  }, [reviews]);

  const filtered = useMemo(() => {
    if (!reviews) return [];
    if (ratingFilter === 'all') return reviews;
    return reviews.filter((r: any) => r.rating === parseInt(ratingFilter));
  }, [reviews, ratingFilter]);

  const respondMutation = useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) => {
      await patchTopTierData('tt_customer_reviews', { 'id': `eq.${id}` }, { response_text: text, responded_at: new Date().toISOString() });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tt-reviews'] }); setRespondModal(null); toast.success('Response saved'); },
  });

  const toggleFeatured = useMutation({
    mutationFn: async ({ id, featured }: { id: string; featured: boolean }) => {
      await patchTopTierData('tt_customer_reviews', { 'id': `eq.${id}` }, { is_featured: featured });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tt-reviews'] }); toast.success('Updated'); },
  });

  const Stars = ({ rating }: { rating: number }) => (
    <div className="flex gap-0.5">{[1,2,3,4,5].map(i => <Star key={i} className={`h-3.5 w-3.5 ${i <= rating ? 'text-[#C9A84C] fill-[#C9A84C]' : 'text-white/10'}`} />)}</div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white/90">Reviews & Reputation</h1>

      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-[#111111] border-[#C9A84C]/10"><CardContent className="p-5">
          <Award className="h-5 w-5 text-[#C9A84C] mb-2" />
          <p className="text-3xl font-bold text-[#C9A84C]">{isLoading ? '—' : kpis.avg}</p>
          <p className="text-xs text-white/40">Overall Rating</p>
        </CardContent></Card>
        <Card className="bg-[#111111] border-[#C9A84C]/10"><CardContent className="p-5">
          <MessageSquare className="h-5 w-5 text-[#C9A84C] mb-2" />
          <p className="text-3xl font-bold text-white/90">{isLoading ? '—' : kpis.total}</p>
          <p className="text-xs text-white/40">Total Reviews</p>
        </CardContent></Card>
        <Card className="bg-[#111111] border-[#C9A84C]/10"><CardContent className="p-5">
          <TrendingUp className="h-5 w-5 text-emerald-400 mb-2" />
          <p className="text-3xl font-bold text-emerald-400">{isLoading ? '—' : `${kpis.fiveStar}%`}</p>
          <p className="text-xs text-white/40">5-Star Rate</p>
        </CardContent></Card>
        <Card className="bg-[#111111] border-[#C9A84C]/10"><CardContent className="p-5">
          <Star className="h-5 w-5 text-blue-400 mb-2" />
          <p className="text-3xl font-bold text-blue-400">{isLoading ? '—' : `${kpis.fourStar}%`}</p>
          <p className="text-xs text-white/40">4-Star Rate</p>
        </CardContent></Card>
      </div>

      <div className="flex items-center gap-3">
        <Select value={ratingFilter} onValueChange={setRatingFilter}>
          <SelectTrigger className="w-36 bg-[#111111] border-white/10 text-white"><SelectValue placeholder="Rating" /></SelectTrigger>
          <SelectContent className="bg-[#1A1A1A] border-white/10">
            <SelectItem value="all">All Ratings</SelectItem>
            {[5,4,3,2,1].map(r => <SelectItem key={r} value={String(r)}>{r} Stars</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="bg-[#111111] border-[#C9A84C]/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-white/5"><tr>
              {['Customer', 'Rating', 'Review', 'Service', 'Date', 'Featured', 'Actions'].map(h => (
                <th key={h} className="px-4 py-2 text-left text-xs text-white/40 uppercase">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? Array(5).fill(0).map((_, i) => <tr key={i}><td colSpan={7} className="p-3"><Skeleton className="h-8 bg-white/5" /></td></tr>) :
                filtered.map((r: any) => (
                  <tr key={r.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <p className="text-sm text-white/80">{r.customer_name}</p>
                      {r.verified && <Badge className="bg-emerald-500/20 text-emerald-400 text-[8px] mt-0.5">Verified</Badge>}
                    </td>
                    <td className="px-4 py-3"><Stars rating={r.rating} /></td>
                    <td className="px-4 py-3 text-xs text-white/60 max-w-[250px] truncate">{r.review_text || '—'}</td>
                    <td className="px-4 py-3 text-xs text-white/60">{r.service_type || '—'}</td>
                    <td className="px-4 py-3 text-xs text-white/40">{format(new Date(r.created_at), 'MMM d, yyyy')}</td>
                    <td className="px-4 py-3">
                      <Switch checked={r.is_featured} onCheckedChange={(v) => toggleFeatured.mutate({ id: r.id, featured: v })} />
                    </td>
                    <td className="px-4 py-3">
                      <Button size="sm" variant="outline" className="h-6 text-[10px] border-[#C9A84C]/30 text-[#C9A84C]" onClick={() => { setRespondModal(r); setResponseText(r.response_text || ''); }}>
                        {r.response_text ? 'Edit Response' : 'Respond'}
                      </Button>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={!!respondModal} onOpenChange={(o) => !o && setRespondModal(null)}>
        <DialogContent className="bg-[#111111] border-[#C9A84C]/20 text-white">
          <DialogHeader><DialogTitle>Respond to {respondModal?.customer_name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="bg-white/5 rounded-lg p-3">
              <Stars rating={respondModal?.rating || 0} />
              <p className="text-sm text-white/60 mt-2">{respondModal?.review_text}</p>
            </div>
            <Textarea value={responseText} onChange={e => setResponseText(e.target.value)} placeholder="Write your response..." className="bg-white/5 border-white/10 text-white min-h-[100px]" />
            <Button onClick={() => respondMutation.mutate({ id: respondModal.id, text: responseText })} className="w-full bg-[#C9A84C] text-black">Save Response</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
