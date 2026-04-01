import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Shield, Plus, Trash2, Search, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function AdminDNCManager() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newReason, setNewReason] = useState('');

  const { data: dncList = [], isLoading } = useQuery({
    queryKey: ['dnc-list', search],
    queryFn: async () => {
      let query = (supabase as any).from('dnc_list').select('*').order('added_at', { ascending: false }).limit(200);
      if (search) {
        query = query.ilike('phone_number', `%${search}%`);
      }
      const { data } = await query;
      return data || [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!newPhone.trim()) throw new Error('Phone number required');
      const { error } = await (supabase as any).from('dnc_list').insert({
        phone_number: newPhone.trim(),
        added_by: user?.id,
        reason: newReason || 'Manual add',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Number added to DNC list');
      setNewPhone('');
      setNewReason('');
      queryClient.invalidateQueries({ queryKey: ['dnc-list'] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('dnc_list').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Number removed from DNC list');
      queryClient.invalidateQueries({ queryKey: ['dnc-list'] });
    },
  });

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(-1)} className="text-slate-400">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-red-400" />
            <h1 className="text-2xl font-bold text-white">Do Not Call List</h1>
          </div>
          <Badge className="bg-red-500/20 text-red-400">{dncList.length} numbers</Badge>
        </div>

        {/* Add Number */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex gap-2">
              <Input
                value={newPhone}
                onChange={e => setNewPhone(e.target.value)}
                placeholder="Phone number (e.g. +12125551234)"
                className="bg-slate-700 border-slate-600 text-white flex-1"
              />
              <Input
                value={newReason}
                onChange={e => setNewReason(e.target.value)}
                placeholder="Reason (optional)"
                className="bg-slate-700 border-slate-600 text-white flex-1"
              />
              <Button onClick={() => addMutation.mutate()} className="bg-red-600 hover:bg-red-700 gap-1">
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search DNC list..."
            className="pl-9 bg-slate-800 border-slate-700 text-white"
          />
        </div>

        {/* List */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-0">
            {dncList.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No numbers on DNC list</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 text-xs border-b border-slate-700">
                    <th className="text-left p-3">Phone</th>
                    <th className="text-left p-3">Reason</th>
                    <th className="text-left p-3">Added</th>
                    <th className="text-right p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dncList.map((entry: any) => (
                    <tr key={entry.id} className="border-b border-slate-700/50 text-white">
                      <td className="p-3 font-mono text-xs">{entry.phone_number}</td>
                      <td className="p-3 text-xs text-slate-400">{entry.reason || '—'}</td>
                      <td className="p-3 text-xs text-slate-400">{new Date(entry.added_at).toLocaleDateString()}</td>
                      <td className="p-3 text-right">
                        <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 h-7"
                          onClick={() => removeMutation.mutate(entry.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
