import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Eye, MessageSquare, Users, Clock, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  under_review: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  approved: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  rejected: 'bg-red-500/15 text-red-400 border-red-500/30',
  needs_info: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
};

export default function PenthouseBeautyProviders() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [filter, setFilter] = useState<string>('all');

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ['beauty-applications', filter],
    queryFn: async () => {
      let query = (supabase.from('beauty_provider_applications') as any)
        .select(`
          *,
          provider:beauty_providers(*)
        `)
        .order('created_at', { ascending: false });
      if (filter !== 'all') query = query.eq('status', filter);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: media = [] } = useQuery({
    queryKey: ['beauty-provider-media', selectedApp?.provider?.id],
    enabled: !!selectedApp?.provider?.id,
    queryFn: async () => {
      const { data, error } = await (supabase.from('provider_media') as any)
        .select('*')
        .eq('provider_id', selectedApp.provider.id)
        .order('display_order');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: providerServices = [] } = useQuery({
    queryKey: ['beauty-provider-services', selectedApp?.provider?.id],
    enabled: !!selectedApp?.provider?.id,
    queryFn: async () => {
      const { data, error } = await (supabase.from('provider_services') as any)
        .select('*')
        .eq('provider_id', selectedApp.provider.id);
      if (error) throw error;
      return data || [];
    },
  });

  const decideMutation = useMutation({
    mutationFn: async ({ appId, providerId, decision }: { appId: string; providerId: string; decision: string }) => {
      // Update application
      await (supabase.from('beauty_provider_applications') as any)
        .update({
          status: decision,
          reviewer_id: user?.id,
          reviewer_notes: reviewNotes,
          decided_at: new Date().toISOString(),
        })
        .eq('id', appId);

      // Update provider status
      const providerStatus = decision === 'approved' ? 'verified' : decision === 'rejected' ? 'rejected' : 'pending_verification';
      const updatePayload: any = { verification_status: providerStatus };
      if (decision === 'approved') {
        updatePayload.approved_at = new Date().toISOString();
        updatePayload.approved_by = user?.id;
        updatePayload.is_active = true;
      }
      await (supabase.from('beauty_providers') as any).update(updatePayload).eq('id', providerId);

      // Audit log
      await (supabase.from('admin_audit_log') as any).insert({
        actor_user_id: user?.id,
        action: `beauty_provider_${decision}`,
        target_type: 'beauty_provider',
        target_id: providerId,
        after: { decision, notes: reviewNotes },
      });
    },
    onSuccess: () => {
      toast.success('Decision recorded');
      qc.invalidateQueries({ queryKey: ['beauty-applications'] });
      setSelectedApp(null);
      setReviewNotes('');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const stats = {
    total: applications.length,
    pending: applications.filter((a: any) => a.status === 'pending').length,
    approved: applications.filter((a: any) => a.status === 'approved').length,
    rejected: applications.filter((a: any) => a.status === 'rejected').length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Beauty Provider Applications</h2>
        <p className="text-[#C9A84C]/60 text-sm">Review, verify, and manage beauty professional onboarding</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, icon: Users, color: 'text-white' },
          { label: 'Pending', value: stats.pending, icon: Clock, color: 'text-amber-400' },
          { label: 'Approved', value: stats.approved, icon: ShieldCheck, color: 'text-emerald-400' },
          { label: 'Rejected', value: stats.rejected, icon: AlertTriangle, color: 'text-red-400' },
        ].map(s => (
          <Card key={s.label} className="bg-[#111] border-[#C9A84C]/10">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`h-5 w-5 ${s.color}`} />
              <div>
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-xs text-gray-400">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {['all', 'pending', 'under_review', 'approved', 'rejected', 'needs_info'].map(f => (
          <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)}
            className={filter === f ? '' : 'border-[#C9A84C]/20 text-gray-300'}>
            {f === 'all' ? 'All' : f.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </Button>
        ))}
      </div>

      {/* Applications List */}
      {isLoading ? (
        <p className="text-gray-400">Loading...</p>
      ) : applications.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No applications found</p>
      ) : (
        <div className="space-y-3">
          {applications.map((app: any) => (
            <Card key={app.id} className="bg-[#111] border-[#C9A84C]/10 hover:border-[#C9A84C]/30 transition-colors cursor-pointer"
              onClick={() => setSelectedApp(app)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-[#C9A84C]/10 flex items-center justify-center text-[#C9A84C] font-bold">
                    {app.provider?.name?.[0] || '?'}
                  </div>
                  <div>
                    <p className="text-white font-medium">{app.provider?.name}</p>
                    <p className="text-xs text-gray-400">{app.provider?.city} · {app.provider?.category} · {app.provider?.specialties?.join(', ')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-gray-500">
                    📸 {app.portfolio_photo_count} · 🎥 {app.portfolio_video_count}
                  </div>
                  <Badge className={STATUS_COLORS[app.status] || 'bg-muted'}>{app.status}</Badge>
                  <Eye className="h-4 w-4 text-gray-500" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedApp} onOpenChange={() => setSelectedApp(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-[#0A0A0A] border-[#C9A84C]/20">
          <DialogHeader>
            <DialogTitle className="text-white">{selectedApp?.provider?.name}</DialogTitle>
          </DialogHeader>

          {selectedApp && (
            <div className="space-y-6">
              {/* Provider Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-400">Category:</span> <span className="text-white">{selectedApp.provider?.category}</span></div>
                <div><span className="text-gray-400">City:</span> <span className="text-white">{selectedApp.provider?.city}</span></div>
                <div><span className="text-gray-400">Email:</span> <span className="text-white">{selectedApp.provider?.email}</span></div>
                <div><span className="text-gray-400">Phone:</span> <span className="text-white">{selectedApp.provider?.phone || 'N/A'}</span></div>
                <div><span className="text-gray-400">Radius:</span> <span className="text-white">{selectedApp.provider?.service_radius_miles} mi</span></div>
                <div><span className="text-gray-400">Specialties:</span> <span className="text-white">{selectedApp.provider?.specialties?.join(', ')}</span></div>
              </div>

              {selectedApp.provider?.bio && (
                <div>
                  <p className="text-gray-400 text-xs mb-1">Bio</p>
                  <p className="text-sm text-gray-200">{selectedApp.provider.bio}</p>
                </div>
              )}

              {/* Documents */}
              <div>
                <p className="text-gray-400 text-xs mb-2">Documents</p>
                <div className="flex gap-3">
                  {selectedApp.provider?.license_url && (
                    <a href={selectedApp.provider.license_url} target="_blank" rel="noopener" className="text-[#C9A84C] text-sm underline">📄 View License</a>
                  )}
                  {selectedApp.provider?.insurance_url && (
                    <a href={selectedApp.provider.insurance_url} target="_blank" rel="noopener" className="text-[#C9A84C] text-sm underline">📄 View Insurance</a>
                  )}
                </div>
              </div>

              {/* Portfolio */}
              {media.length > 0 && (
                <div>
                  <p className="text-gray-400 text-xs mb-2">Portfolio ({media.filter((m: any) => m.media_type === 'photo').length} photos, {media.filter((m: any) => m.media_type === 'video').length} videos)</p>
                  <div className="grid grid-cols-4 gap-2">
                    {media.filter((m: any) => m.media_type === 'photo').slice(0, 8).map((m: any) => (
                      <img key={m.id} src={m.url} alt="" className="w-full h-24 object-cover rounded-lg" />
                    ))}
                  </div>
                </div>
              )}

              {/* Services */}
              {providerServices.length > 0 && (
                <div>
                  <p className="text-gray-400 text-xs mb-2">Services</p>
                  <div className="space-y-1">
                    {providerServices.map((s: any) => (
                      <div key={s.id} className="flex justify-between text-sm bg-[#111] p-2 rounded">
                        <span className="text-white">{s.service_name}</span>
                        <span className="text-[#C9A84C]">${s.price} · {s.duration_minutes}min</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Admin Notes */}
              <div>
                <p className="text-gray-400 text-xs mb-2 flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Review Notes</p>
                <Textarea
                  value={reviewNotes}
                  onChange={e => setReviewNotes(e.target.value)}
                  placeholder="Add notes about this application..."
                  className="bg-[#111] border-[#C9A84C]/20 text-white"
                  rows={3}
                />
              </div>

              {/* Actions */}
              {selectedApp.status !== 'approved' && (
                <DialogFooter className="flex gap-2">
                  <Button variant="outline" className="border-orange-500/30 text-orange-400"
                    onClick={() => decideMutation.mutate({ appId: selectedApp.id, providerId: selectedApp.provider.id, decision: 'needs_info' })}>
                    Request More Info
                  </Button>
                  <Button variant="outline" className="border-red-500/30 text-red-400"
                    onClick={() => decideMutation.mutate({ appId: selectedApp.id, providerId: selectedApp.provider.id, decision: 'rejected' })}>
                    <XCircle className="h-4 w-4 mr-1" /> Reject
                  </Button>
                  <Button className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => decideMutation.mutate({ appId: selectedApp.id, providerId: selectedApp.provider.id, decision: 'approved' })}>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                  </Button>
                </DialogFooter>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
