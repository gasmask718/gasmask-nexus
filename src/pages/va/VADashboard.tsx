import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { VASessionProvider, useVASession } from '@/contexts/VASessionContext';
import { VAOnboardingModal } from '@/components/va/VAOnboardingModal';
import { VALeadsTable } from '@/components/va/VALeadsTable';
import { VACallPanel } from '@/components/va/VACallPanel';
import { VAInvoiceModal } from '@/components/va/VAInvoiceModal';
import { VAScripts } from '@/components/va/VAScripts';
import { VARebuttals } from '@/components/va/VARebuttals';
import { VAFAQs } from '@/components/va/VAFAQs';
import { VALeadDiscovery } from '@/components/va/VALeadDiscovery';
import { VAPowerDialer } from '@/components/va/VAPowerDialer';
import { VADialerAssist } from '@/components/va/VADialerAssist';
import { VALeaderboard } from '@/components/va/VALeaderboard';
import { VACallbacksQueue } from '@/components/va/VACallbacksQueue';
import { VASessionSummary } from '@/components/va/VASessionSummary';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  Users, Phone, BookOpen, HelpCircle, FileText, Settings, LogOut, Headset, PanelLeft,
  Search, ArrowLeft, Zap, Trophy, Clock, UserCircle,
} from 'lucide-react';

type VAView = 'leads' | 'call' | 'scripts' | 'faqs' | 'invoices' | 'settings' | 'discovery' | 'dialer' | 'leaderboard' | 'callbacks';

function VADashboardInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const { user } = useAuth();
  const { t, twilioNumber, language, isOnboarded, endSession } = useVASession();

  const initialView = location.pathname.includes('lead-discovery') ? 'discovery' : 'leads';
  const [view, setView] = useState<VAView>(initialView);
  const [callLead, setCallLead] = useState<any>(null);
  const [invoiceLead, setInvoiceLead] = useState<any>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [dialerLeads, setDialerLeads] = useState<any[]>([]);
  const [showSessionSummary, setShowSessionSummary] = useState(false);

  // Fetch leads for dialer
  const { data: allLeads = [] } = useQuery({
    queryKey: ['va-dialer-leads', user?.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('brandaro_qualified_leads')
        .select('id, business_name, phone_number, email, lead_status')
        .eq('assigned_va', user!.id)
        .not('phone_number', 'is', null)
        .order('created_at', { ascending: false })
        .limit(500);
      return (data || []).map((l: any) => ({
        id: l.id,
        business_name: l.business_name,
        phone: l.phone_number,
        email: l.email,
        status: l.lead_status,
      })).filter((l: any) => l.phone);
    },
    enabled: !!user,
  });

  const handleLogout = async () => {
    try { await endSession(); } catch (e) { console.error('Failed to end session cleanly:', e); }
    await signOut();
    navigate('/va/auth');
  };

  const handleStartDialer = () => {
    setDialerLeads(allLeads);
    setView('dialer');
  };

  const handleEndDialerSession = () => {
    setShowSessionSummary(true);
  };

  const navItems = [
    { key: 'leads' as VAView, label: t('va.nav.leads'), icon: Users },
    { key: 'discovery' as VAView, label: t('va.nav.discovery'), icon: Search },
    { key: 'dialer' as VAView, label: 'Power Dialer', icon: Zap },
    { key: 'leaderboard' as VAView, label: 'Leaderboard', icon: Trophy },
    { key: 'callbacks' as VAView, label: 'Callbacks', icon: Clock },
    { key: 'call' as VAView, label: t('va.nav.activeCall'), icon: Phone },
    { key: 'scripts' as VAView, label: t('va.nav.scripts'), icon: BookOpen },
    { key: 'faqs' as VAView, label: t('va.nav.faqs'), icon: HelpCircle },
    { key: 'invoices' as VAView, label: t('va.nav.invoices'), icon: FileText },
    { key: 'settings' as VAView, label: t('va.nav.settings'), icon: Settings },
  ];

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full" style={{ background: 'hsl(222 47% 11%)' }}>
        <VAOnboardingModal />

        {/* Sidebar */}
        <Sidebar collapsible="icon" className="border-r border-slate-700/50">
          <SidebarContent className="bg-slate-900 text-white">
            <SidebarGroup>
              <SidebarGroupLabel className="text-cyan-400 font-bold flex items-center gap-2">
                <Headset className="h-4 w-4" />
                <span>VA Portal</span>
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map(item => (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        onClick={() => setView(item.key)}
                        isActive={view === item.key}
                        className="text-slate-300 hover:text-white hover:bg-slate-800 data-[active=true]:bg-cyan-500/10 data-[active=true]:text-cyan-400"
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Brandaro Link */}
            <SidebarGroup>
              <SidebarGroupLabel className="text-orange-400 font-bold text-xs">Brandaro</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => navigate('/brandaro')}
                      className="text-slate-400 hover:text-orange-300 hover:bg-orange-500/10"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      <span>{t('va.nav.backToBrandaro')}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Bar */}
          <header className="h-14 flex items-center justify-between px-4 border-b border-slate-700/50 bg-slate-900/80 backdrop-blur">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-slate-400 hover:text-white">
                <PanelLeft className="h-5 w-5" />
              </SidebarTrigger>
              <h1 className="text-sm font-bold text-white hidden sm:block">VA Portal</h1>
              <span className="text-xs text-slate-500 hidden md:inline">/ Brandaro</span>
            </div>
            <div className="flex items-center gap-3">
              {twilioNumber && (
                <Badge className="bg-cyan-500/20 text-cyan-400 font-mono text-xs">
                  📞 {twilioNumber}
                </Badge>
              )}
              <Badge className="bg-slate-700 text-slate-300 text-xs">
                {language === 'en' ? '🇺🇸 EN' : '🇪🇸 ES'}
              </Badge>
              <Button size="sm" variant="ghost" className="text-cyan-400 hover:text-cyan-300 gap-1" onClick={() => navigate('/va/profile')}>
                <UserCircle className="h-3 w-3" /> Profile
              </Button>
              <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 gap-1" onClick={handleLogout}>
                <LogOut className="h-3 w-3" /> {t('va.topbar.logout')}
              </Button>
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            {view === 'leads' && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button onClick={handleStartDialer} className="bg-cyan-600 hover:bg-cyan-700 gap-2">
                    <Zap className="h-4 w-4" /> Start Power Dialer ({allLeads.length} leads)
                  </Button>
                </div>
                <VALeadsTable
                  onCall={lead => { setCallLead(lead); setView('call'); }}
                  onCreateInvoice={lead => { setInvoiceLead(lead); setInvoiceOpen(true); }}
                  onSendInvoice={lead => { setInvoiceLead(lead); setInvoiceOpen(true); }}
                />
              </div>
            )}
            {view === 'discovery' && <VALeadDiscovery />}
            {view === 'dialer' && (
              <div className="flex gap-4 h-[calc(100vh-8rem)]">
                {/* Left: Dialer 60% */}
                <div className="w-[60%] overflow-y-auto pr-2">
                  <VAPowerDialer leads={dialerLeads.length > 0 ? dialerLeads : allLeads} onEndSession={handleEndDialerSession} />
                  <div className="mt-4">
                    <VALeaderboard />
                  </div>
                </div>
                {/* Right: Assist 40% */}
                <div className="w-[40%] bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
                  <VADialerAssist />
                </div>
              </div>
            )}
            {view === 'leaderboard' && (
              <div className="max-w-4xl">
                <VALeaderboard />
              </div>
            )}
            {view === 'callbacks' && (
              <div className="max-w-2xl">
                <VACallbacksQueue onDialLead={lead => { setCallLead(lead); setView('call'); }} />
              </div>
            )}
            {view === 'call' && (
              <VACallPanel
                lead={callLead}
                onClose={() => { setCallLead(null); setView('leads'); }}
                onSendInvoice={lead => { setInvoiceLead(lead); setInvoiceOpen(true); }}
              />
            )}
            {view === 'scripts' && (
              <div className="max-w-2xl space-y-4">
                <VAScripts />
                <VARebuttals />
              </div>
            )}
            {view === 'faqs' && <div className="max-w-2xl"><VAFAQs /></div>}
            {view === 'invoices' && (
              <div className="text-center text-slate-400 py-16">
                <FileText className="h-12 w-12 mx-auto text-slate-600 mb-3" />
                <p className="font-medium">{t('va.invoices.comingSoon')}</p>
                <p className="text-sm">{t('va.invoices.createFromLeads')}</p>
              </div>
            )}
            {view === 'settings' && (
              <div className="text-center text-slate-400 py-16">
                <Settings className="h-12 w-12 mx-auto text-slate-600 mb-3" />
                <p className="font-medium">{t('va.settings.comingSoon')}</p>
              </div>
            )}
          </main>
        </div>

        <VAInvoiceModal open={invoiceOpen} onClose={() => setInvoiceOpen(false)} lead={invoiceLead} />

        {showSessionSummary && (
          <VASessionSummary
            stats={{
              callsDialed: 0, callsAnswered: 0, callsClosed: 0,
              hotCount: 0, warmCount: 0, coldCount: 0, avgDurationSeconds: 0,
            }}
            onClose={() => { setShowSessionSummary(false); setView('leads'); }}
          />
        )}
      </div>
    </SidebarProvider>
  );
}

export default function VADashboard() {
  return (
    <VASessionProvider>
      <VADashboardInner />
    </VASessionProvider>
  );
}
