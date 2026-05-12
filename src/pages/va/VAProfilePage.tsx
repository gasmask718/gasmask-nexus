import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { VASessionProvider, useVASession } from '@/contexts/VASessionContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User, Mail, Phone, Globe, Save, Loader2, ArrowLeft, Shield, Lock, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

function VAProfileInner() {
  const { user } = useAuth();
  const { t, language, twilioNumber, sessionId } = useVASession();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    preferred_language: 'en',
  });

  // Fetch profile
  const { data: profile, isLoading, refetch } = useQuery({
    queryKey: ['va-profile', user?.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('profiles')
        .select('id, name, phone, email, role, preferred_language, avatar_url, created_at')
        .eq('id', user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  // Fetch VA stats
  const { data: stats } = useQuery({
    queryKey: ['va-profile-stats', user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data: todayStats } = await (supabase as any)
        .from('va_leaderboard_stats')
        .select('calls_dialed, calls_answered, calls_closed, total_talk_time_seconds')
        .eq('va_id', user!.id)
        .eq('session_date', today)
        .maybeSingle();

      const { count: totalLeads } = await (supabase as any)
        .from('brandaro_qualified_leads')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_va', user!.id);

      const { count: totalSessions } = await (supabase as any)
        .from('va_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('va_id', user!.id);

      return {
        today: todayStats || { calls_dialed: 0, calls_answered: 0, calls_closed: 0, total_talk_time_seconds: 0 },
        totalLeads: totalLeads || 0,
        totalSessions: totalSessions || 0,
      };
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name || '',
        phone: profile.phone || '',
        email: profile.email || user?.email || '',
        preferred_language: profile.preferred_language || 'en',
      });
    }
  }, [profile, user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from('profiles')
        .update({
          name: form.name,
          phone: form.phone,
          preferred_language: form.preferred_language,
        })
        .eq('id', user.id);
      if (error) throw error;
      toast.success('Profile updated!');
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const initials = (form.name || 'VA').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'hsl(222 47% 11%)' }}>
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8" style={{ background: 'hsl(222 47% 11%)' }}>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Back button */}
        <Button variant="ghost" className="text-slate-400 hover:text-white gap-2" onClick={() => navigate('/va/dashboard')}>
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Button>

        {/* Profile Header */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border-2 border-cyan-500/30">
                <AvatarFallback className="bg-cyan-500/20 text-cyan-400 text-xl font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-xl font-bold text-white">{form.name || 'VA Agent'}</h1>
                <p className="text-sm text-slate-400">{user?.email}</p>
                <div className="flex gap-2 mt-1">
                  <Badge className="bg-cyan-500/20 text-cyan-400 text-xs">
                    <Shield className="h-3 w-3 mr-1" /> VA Agent
                  </Badge>
                  <Badge className="bg-slate-700 text-slate-300 text-xs">
                    {language === 'en' ? '🇺🇸 English' : '🇪🇸 Español'}
                  </Badge>
                  {twilioNumber && (
                    <Badge className="bg-emerald-500/20 text-emerald-400 text-xs font-mono">
                      📞 {twilioNumber}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Today's Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Calls Today', value: stats?.today.calls_dialed || 0, color: 'text-cyan-400' },
            { label: 'Answered', value: stats?.today.calls_answered || 0, color: 'text-emerald-400' },
            { label: 'Closed', value: stats?.today.calls_closed || 0, color: 'text-amber-400' },
            { label: 'Talk Time', value: formatDuration(stats?.today.total_talk_time_seconds || 0), color: 'text-purple-400' },
          ].map(s => (
            <Card key={s.label} className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-3 text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-slate-400">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-white">{stats?.totalLeads || 0}</p>
              <p className="text-sm text-slate-400">Assigned Leads</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-white">{stats?.totalSessions || 0}</p>
              <p className="text-sm text-slate-400">Total Sessions</p>
            </CardContent>
          </Card>
        </div>

        {/* Edit Profile */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <User className="h-5 w-5 text-cyan-400" /> Edit Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 mb-1 block flex items-center gap-1">
                <User className="h-3 w-3" /> Full Name
              </label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Your name"
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block flex items-center gap-1">
                <Mail className="h-3 w-3" /> Email
              </label>
              <Input
                value={form.email}
                disabled
                className="bg-slate-700/50 border-slate-600 text-slate-400"
              />
              <p className="text-[10px] text-slate-500 mt-1">Email cannot be changed</p>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block flex items-center gap-1">
                <Phone className="h-3 w-3" /> Phone Number
              </label>
              <Input
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+1 (555) 000-0000"
                className="bg-slate-700 border-slate-600 text-white font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block flex items-center gap-1">
                <Globe className="h-3 w-3" /> Preferred Language
              </label>
              <div className="flex gap-2">
                <Button
                  variant={form.preferred_language === 'en' ? 'default' : 'outline'}
                  className={form.preferred_language === 'en' ? 'bg-cyan-600' : 'border-slate-600 text-slate-300'}
                  onClick={() => setForm(f => ({ ...f, preferred_language: 'en' }))}
                  size="sm"
                >
                  🇺🇸 English
                </Button>
                <Button
                  variant={form.preferred_language === 'es' ? 'default' : 'outline'}
                  className={form.preferred_language === 'es' ? 'bg-cyan-600' : 'border-slate-600 text-slate-300'}
                  onClick={() => setForm(f => ({ ...f, preferred_language: 'es' }))}
                  size="sm"
                >
                  🇪🇸 Español
                </Button>
              </div>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full bg-cyan-600 hover:bg-cyan-700 gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Changes
            </Button>
          </CardContent>
        </Card>

        {/* Account Info */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">
              Account created: {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '—'}
              {' • '}User ID: <span className="font-mono">{user?.id?.slice(0, 8)}...</span>
              {sessionId && <> • Active Session: <span className="font-mono text-emerald-400">{sessionId.slice(0, 8)}...</span></>}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function VAProfilePage() {
  return (
    <VASessionProvider>
      <VAProfileInner />
    </VASessionProvider>
  );
}
