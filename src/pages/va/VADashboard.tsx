import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { VASessionProvider, useVASession } from '@/contexts/VASessionContext';
import { VAOnboardingModal } from '@/components/va/VAOnboardingModal';
import { VALeadsTable } from '@/components/va/VALeadsTable';
import { VACallPanel } from '@/components/va/VACallPanel';
import { VAInvoiceModal } from '@/components/va/VAInvoiceModal';
import { VAScripts } from '@/components/va/VAScripts';
import { VARebuttals } from '@/components/va/VARebuttals';
import { VAFAQs } from '@/components/va/VAFAQs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  Users, Phone, BookOpen, HelpCircle, FileText, Settings, LogOut, Headset, PanelLeft,
} from 'lucide-react';

type VAView = 'leads' | 'call' | 'scripts' | 'faqs' | 'invoices' | 'settings';

function VADashboardInner() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { t, twilioNumber, language, isOnboarded, endSession } = useVASession();
  const [view, setView] = useState<VAView>('leads');
  const [callLead, setCallLead] = useState<any>(null);
  const [invoiceLead, setInvoiceLead] = useState<any>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);

  const handleLogout = async () => {
    await endSession();
    await signOut();
  };

  const navItems = [
    { key: 'leads' as VAView, label: t('va.nav.leads'), icon: Users },
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
              <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 gap-1" onClick={handleLogout}>
                <LogOut className="h-3 w-3" /> {t('va.topbar.logout')}
              </Button>
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            {view === 'leads' && (
              <VALeadsTable
                onCall={lead => { setCallLead(lead); setView('call'); }}
                onCreateInvoice={lead => { setInvoiceLead(lead); setInvoiceOpen(true); }}
                onSendInvoice={lead => { setInvoiceLead(lead); setInvoiceOpen(true); }}
              />
            )}
            {view === 'call' && (
              <VACallPanel lead={callLead} onClose={() => { setCallLead(null); setView('leads'); }} />
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
                <p className="font-medium">Invoice history coming soon</p>
                <p className="text-sm">Create invoices from the Leads tab</p>
              </div>
            )}
            {view === 'settings' && (
              <div className="text-center text-slate-400 py-16">
                <Settings className="h-12 w-12 mx-auto text-slate-600 mb-3" />
                <p className="font-medium">Settings coming soon</p>
              </div>
            )}
          </main>
        </div>

        <VAInvoiceModal open={invoiceOpen} onClose={() => setInvoiceOpen(false)} lead={invoiceLead} />
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
