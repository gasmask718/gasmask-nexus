import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { VASessionProvider, useVASession } from '@/contexts/VASessionContext';
import { VAOnboardingModal } from '@/components/va/VAOnboardingModal';
import { VALeadsTable } from '@/components/va/VALeadsTable';
import { VACallPanel } from '@/components/va/VACallPanel';
import { VAInvoiceModal } from '@/components/va/VAInvoiceModal';
import { BrandaroInvoicesDataTable } from '@/components/invoice/BrandaroInvoicesDataTable';
import { VAScripts } from '@/components/va/VAScripts';
import { VARebuttals } from '@/components/va/VARebuttals';
import { VAFAQs } from '@/components/va/VAFAQs';
import { VAPowerDialer } from '@/components/va/VAPowerDialer';
import { UnifiedCallActions } from '@/components/communication/UnifiedCallActions';
import { ManualCallActions } from '@/components/communication/ManualCallActions';
import { VADialerAssist } from '@/components/va/VADialerAssist';
import { VAScriptsRebuttalsPanel } from '@/components/va/VAScriptsRebuttalsPanel';
import { VALeaderboard } from '@/components/va/VALeaderboard';
import { VACallbacksQueue } from '@/components/va/VACallbacksQueue';
import { VACallStats } from '@/components/va/VACallStats';
import { VARecentCalls } from '@/components/va/VARecentCalls';
import { VACallHistory } from '@/components/va/VACallHistory';
import { VASessionSummary } from '@/components/va/VASessionSummary';
import { VACoachingInbox } from '@/components/va/VACoachingInbox';
import { VAAICoachingHub } from '@/components/va/VAAICoachingHub';
import { VAAutoDialerSection } from '@/components/va/VAAutoDialerSection';
import { VAActiveNumberSwitcher } from '@/components/va/VAActiveNumberSwitcher';
import { RingMyMobile } from '@/components/va/RingMyMobile';
import { GasMaskShiftToggle } from '@/components/va/GasMaskShiftToggle';
import { AutoTranslateRoot } from '@/components/va/AutoTranslateRoot';
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
  Search, ArrowLeft, Zap, Trophy, Clock, UserCircle, Sparkles, Building2, History, UserPlus,
  MessageSquare, AlertTriangle,
} from 'lucide-react';
import { VACompanyProvider, useVACompany } from '@/contexts/VACompanyContext';
import { VACompanySwitcher } from '@/components/va/VACompanySwitcher';
import { useVACallerIds } from '@/hooks/useVACallerIds';
import { getVACompanyConfig } from '@/config/vaCompanies';
import { Card, CardContent } from '@/components/ui/card';
import { BrandaroLeadIntakeModal } from '@/components/brandaro/BrandaroLeadIntakeModal';
import { VAIntakeInvitesPanel } from '@/components/va/VAIntakeInvitesPanel';
import { VAMessages } from '@/components/va/VAMessages';
import { useVAUnreadInbound } from '@/hooks/useVAMessages';

type VAView = 'leads' | 'intake' | 'call' | 'messages' | 'scripts' | 'faqs' | 'invoices' | 'settings' | 'autodialer' | 'leaderboard' | 'callbacks' | 'coaching' | 'history';

function VADashboardInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const { user } = useAuth();
  const { t, twilioNumber, twilioNumberId, language, isOnboarded, endSession, switchNumber } = useVASession();
  const { activeCompany, loading: companyLoading } = useVACompany();
  const companyName = activeCompany?.name ?? 'No company assigned';
  const companyColor = activeCompany?.brand_color ?? '#06b6d4';

  const initialView: VAView = 'leads';
  const [view, setView] = useState<VAView>(initialView);
  const [callLead, setCallLead] = useState<any>(null);
  const [invoiceLead, setInvoiceLead] = useState<any>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceSendMode, setInvoiceSendMode] = useState(false);
  const [dialerLeads, setDialerLeads] = useState<any[]>([]);
  const [campaignLeadList, setCampaignLeadList] = useState<{ id?: string; name: string; phone: string }[] | null>(null);
  const [showSessionSummary, setShowSessionSummary] = useState(false);

  // Per-company caller IDs for the ACTIVE company
  const {
    numbers: callerIdPool, defaultNumber, hasNumbers, isLoading: callerIdsLoading,
  } = useVACallerIds(activeCompany?.id);

  // When the active company changes (switcher or first load with a stale
  // persisted session), force the caller ID to that company's default — or
  // end the session so the onboarding modal shows the "no number" block.
  const lastCompanyIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeCompany || callerIdsLoading || companyLoading) return;
    if (lastCompanyIdRef.current === activeCompany.id) return;
    lastCompanyIdRef.current = activeCompany.id;
    if (!isOnboarded) return;
    const currentIsValid = callerIdPool.some((n) => n.dc_number_id === twilioNumberId);
    if (currentIsValid) return;
    if (defaultNumber) {
      switchNumber(defaultNumber.dc_number_id, defaultNumber.phone_number);
    } else {
      endSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompany?.id, callerIdsLoading, companyLoading, isOnboarded]);

  // Fetch leads for dialer — scoped to the active company's lead source
  const { data: allLeads = [] } = useQuery({
    queryKey: ['va-dialer-leads', user?.id, activeCompany?.id],
    queryFn: async () => {
      const cfg = getVACompanyConfig(activeCompany?.slug);
      if (cfg.leadSource === 'brandaro_qualified_leads') {
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
      }
      if (cfg.leadSource === 'v_store_who_to_contact') {
        const { data } = await (supabase as any)
          .from('v_store_who_to_contact')
          .select('store_id, store_name, phone')
          .not('phone', 'is', null)
          .eq('try_this_first', 1)
          .order('store_name')
          .limit(500);
        return (data || []).map((s: any) => ({
          id: s.store_id,
          store_id: s.store_id,
          business_name: s.store_name,
          phone: s.phone,
          email: null,
          status: 'new',
        }));
      }
      return [];
    },
    enabled: !!user && !!activeCompany,
  });

  const handleLogout = async () => {
    try { await endSession(); } catch (e) { console.error('Failed to end session cleanly:', e); }
    await signOut();
    navigate('/va/auth');
  };

  const handleStartDialer = () => {
    setDialerLeads(allLeads);
    setView('autodialer');
  };

  const handleEndDialerSession = () => {
    setShowSessionSummary(true);
  };

  // Unread coaching count for sidebar badge
  const { data: unreadCoaching = 0 } = useQuery({
    queryKey: ['va-coaching-unread', user?.id],
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from('brandaro_va_coaching')
        .select('id', { count: 'exact', head: true })
        .eq('va_user_id', user!.id)
        .is('acknowledged_at', null);
      return count || 0;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  // Unresolved inbound replies across this VA's assigned leads
  const { data: unreadInbound = 0 } = useVAUnreadInbound();


  const navItems = [
    { key: 'leads' as VAView, label: t('va.nav.leads'), icon: Users },
    { key: 'intake' as VAView, label: 'New Lead Intake', icon: UserPlus },
    { key: 'autodialer' as VAView, label: 'Auto Dialer', icon: Sparkles },
    { key: 'leaderboard' as VAView, label: 'Leaderboard', icon: Trophy },
    { key: 'callbacks' as VAView, label: 'Callbacks', icon: Clock },
    { key: 'coaching' as VAView, label: 'AI Coaching', icon: Sparkles, badge: unreadCoaching },
    { key: 'history' as VAView, label: 'Call History', icon: History },
    { key: 'messages' as VAView, label: 'Messages', icon: MessageSquare, badge: unreadInbound },
    { key: 'call' as VAView, label: t('va.nav.activeCall'), icon: Phone },
    { key: 'scripts' as VAView, label: t('va.nav.scripts'), icon: BookOpen },
    { key: 'faqs' as VAView, label: t('va.nav.faqs'), icon: HelpCircle },
    { key: 'invoices' as VAView, label: t('va.nav.invoices'), icon: FileText },
    { key: 'settings' as VAView, label: t('va.nav.settings'), icon: Settings },
  ];

  return (
    <SidebarProvider>
      <AutoTranslateRoot>
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
                        {(item as any).badge ? (
                          <Badge className="ml-auto bg-cyan-500 text-white text-[10px] px-1.5 py-0 h-4">
                            {(item as any).badge}
                          </Badge>
                        ) : null}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Company badge */}
            <SidebarGroup>
              <SidebarGroupLabel className="font-bold text-xs" style={{ color: companyColor }}>
                {activeCompany ? 'Your company' : 'No company'}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <div className="px-2 py-2 flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4" style={{ color: companyColor }} />
                  <span className="text-white font-medium">{companyName}</span>
                </div>
                {activeCompany?.role && (
                  <div className="px-2 text-[10px] text-slate-500 uppercase tracking-wide">
                    Role: {activeCompany.role}
                  </div>
                )}
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
              <span className="text-xs hidden md:inline" style={{ color: companyColor }}>
                / {companyName}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <VACompanySwitcher />
              <VAActiveNumberSwitcher />
              <GasMaskShiftToggle />
              <RingMyMobile />
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
                {/* Today's Stats */}
                <VACallStats />
                
                <div className="flex justify-end">
                  <Button
                    onClick={handleStartDialer}
                    className="bg-cyan-600 hover:bg-cyan-700 gap-2"
                    disabled={allLeads.length === 0}
                  >
                    <Zap className="h-4 w-4" /> Start Power Dialer ({allLeads.length} leads)
                  </Button>
                </div>
                {!getVACompanyConfig(activeCompany?.slug).leadSource ? (
                  <Card className="border-slate-700 bg-slate-800/50">
                    <CardContent className="py-16 text-center space-y-3">
                      <div className="w-16 h-16 rounded-2xl bg-slate-700/40 flex items-center justify-center mx-auto">
                        <Users className="h-7 w-7 text-slate-500" />
                      </div>
                      <p className="text-slate-300">
                        No call list configured for {companyName} yet.
                      </p>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        Leads are assigned per company. Switch companies in the header, or ask the
                        owner to load a call list for {companyName}.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <VALeadsTable
                    leadSource={getVACompanyConfig(activeCompany?.slug).leadSource!}
                    brandaroTools={activeCompany?.slug === 'brandaro'}
                    onCall={lead => { setCallLead(lead); setView('call'); }}
                    onCreateInvoice={lead => { setInvoiceLead(lead); setInvoiceSendMode(false); setInvoiceOpen(true); }}
                    onSendInvoice={lead => { setInvoiceLead(lead); setInvoiceSendMode(true); setInvoiceOpen(true); }}
                    onStartCampaign={(list) => { setCampaignLeadList(list); setView('autodialer'); }}
                    onQuickDial={(lead) => {
                      setCallLead({
                        id: `quick-${Date.now()}`,
                        business_name: lead.name,
                        phone: lead.phone,
                        email: null,
                        status: 'new',
                        created_at: new Date().toISOString(),
                        assigned_va: null,
                      } as any);
                      setView('call');
                    }}
                  />
                )}
                
                {/* Recent Calls */}
                <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
                  <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <Phone className="h-4 w-4 text-cyan-400" /> Recent Calls
                  </h3>
                  <VARecentCalls />
                </div>
              </div>
            )}
            {view === 'intake' && (
              <div className="max-w-6xl">
                <VAIntakeInvitesPanel />
              </div>
            )}
            {view === 'autodialer' && (
              <div className="max-w-3xl">
                <VAPowerDialer
                  key={campaignLeadList ? `list-${campaignLeadList.length}-${campaignLeadList[0]?.phone || ''}` : 'queue'}
                  leadList={campaignLeadList || undefined}
                  initialCallerId={twilioNumber || undefined}
                  onEndSession={() => { setCampaignLeadList(null); handleEndDialerSession(); }}
                />
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
            {view === 'coaching' && (
              <div className="max-w-5xl">
                <VAAICoachingHub />
              </div>
            )}
            {view === 'messages' && (
              <div className="max-w-6xl">
                <VAMessages />
              </div>
            )}
            {view === 'history' && (
              <div className="max-w-5xl">
                <div className="mb-4">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <History className="h-5 w-5 text-cyan-400" /> Call History
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Your recordings and transcripts. Same source as the admin review panel — scoped to your account.
                  </p>
                </div>
                <VACallHistory />
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
              <div className="h-[calc(100vh-8rem)] rounded-xl border border-slate-700 overflow-hidden">
                <VAScriptsRebuttalsPanel companySlug={activeCompany?.slug} />
              </div>
            )}
            {view === 'faqs' && <div className="max-w-2xl"><VAFAQs /></div>}
            {view === 'invoices' && user && (
              <BrandaroInvoicesDataTable
                vaId={user.id}
                title="My Invoices"
                description="Your issued invoices — paid & unpaid tracking."
              />
            )}
            {view === 'settings' && (
              <div className="text-center text-slate-400 py-16">
                <Settings className="h-12 w-12 mx-auto text-slate-600 mb-3" />
                <p className="font-medium">{t('va.settings.comingSoon')}</p>
              </div>
            )}
          </main>
        </div>

        <VAInvoiceModal
          open={invoiceOpen}
          onClose={() => { setInvoiceOpen(false); setInvoiceSendMode(false); }}
          lead={invoiceLead}
          sendOnSave={invoiceSendMode}
        />

        

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
      </AutoTranslateRoot>
    </SidebarProvider>
  );
}

export default function VADashboard() {
  return (
    <VASessionProvider>
      <VACompanyProvider>
        <VADashboardInner />
      </VACompanyProvider>
    </VASessionProvider>
  );
}
