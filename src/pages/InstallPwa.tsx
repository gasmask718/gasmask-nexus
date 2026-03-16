import { useNavigate } from 'react-router-dom';
import { Download, ArrowLeft, LayoutDashboard, Map, MessageSquare, Users, BarChart3, WifiOff, Chrome, Smartphone, Globe, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { isRunningAsInstalledPwa } from '@/components/pwa/PwaTelemetry';

const features = [
  { icon: LayoutDashboard, title: 'Command Center', description: 'Full operational dashboard with real-time metrics and alerts' },
  { icon: Map, title: 'Routes & Maps', description: 'Live route tracking, optimization, and delivery management' },
  { icon: MessageSquare, title: 'Communication Hub', description: 'Calls, SMS, email, and AI-powered outreach in one place' },
  { icon: Users, title: 'CRM & Contacts', description: 'Manage stores, wholesalers, ambassadors, and all relationships' },
  { icon: BarChart3, title: 'Analytics & Reports', description: 'Revenue intelligence, sell-through data, and executive reports' },
  { icon: WifiOff, title: 'Offline Access', description: 'Keep working even without internet — data syncs when back online' },
];

const manualInstructions = [
  {
    id: 'chrome-desktop',
    title: 'Chrome (Desktop)',
    icon: Chrome,
    steps: [
      'Open GASMASK in Google Chrome',
      'Click the install icon (⊕) in the address bar, or go to ⋮ → "Install GASMASK…"',
      'Click "Install" in the confirmation dialog',
      'GASMASK will open as a standalone app',
    ],
  },
  {
    id: 'chrome-android',
    title: 'Chrome (Android)',
    icon: Smartphone,
    steps: [
      'Open GASMASK in Chrome on your Android device',
      'Tap the three-dot menu (⋮) in the top-right corner',
      'Tap "Add to Home screen" or "Install app"',
      'Confirm by tapping "Install"',
      'Find GASMASK on your home screen',
    ],
  },
  {
    id: 'safari-ios',
    title: 'Safari (iOS / iPad)',
    icon: Smartphone,
    steps: [
      'Open GASMASK in Safari (not Chrome)',
      'Tap the Share button (□↑) at the bottom of the screen',
      'Scroll down and tap "Add to Home Screen"',
      'Tap "Add" in the top-right corner',
      'Find GASMASK on your home screen',
    ],
  },
  {
    id: 'edge',
    title: 'Microsoft Edge',
    icon: Globe,
    steps: [
      'Open GASMASK in Microsoft Edge',
      'Click the install icon in the address bar, or go to ⋯ → "Apps" → "Install GASMASK"',
      'Click "Install" in the confirmation dialog',
      'GASMASK will open as a standalone app',
    ],
  },
];

export default function InstallPwa() {
  const navigate = useNavigate();
  const { canInstall, isInstalled, triggerInstall } = usePwaInstall();
  const isStandalone = isRunningAsInstalledPwa();

  const handleInstall = async () => {
    if (canInstall) {
      await triggerInstall();
    } else {
      // Fallback: scroll to manual instructions
      document.getElementById('manual-instructions')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12 space-y-16">
        {/* Hero */}
        <section className="text-center space-y-6">
          <div className="inline-flex items-center justify-center h-20 w-20 rounded-2xl bg-primary/10 border border-primary/20 mx-auto">
            <Download className="h-10 w-10 text-primary" />
          </div>
          <div className="space-y-3">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground">
              Install GASMASK
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Add GASMASK to your device for instant access, push notifications, and offline support. Works on desktop and mobile.
            </p>
          </div>

          {isInstalled || isStandalone ? (
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-6 py-3 font-semibold text-lg">
              <CheckCircle className="h-5 w-5" />
              GASMASK is installed
            </div>
          ) : (
            <Button
              size="lg"
              onClick={handleInstall}
              className="gap-2.5 text-lg px-10 py-6 h-auto font-bold shadow-lg"
            >
              <Download className="h-5 w-5" />
              Install GASMASK
            </Button>
          )
        </section>

        {/* Features Grid */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-foreground text-center">What you get with GASMASK</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature) => (
              <Card key={feature.title} className="border-border/50 bg-card/50">
                <CardContent className="p-6 space-y-3">
                  <div className="inline-flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Manual Install Instructions */}
        <section id="manual-instructions" className="space-y-6 pb-12">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-foreground">Can't see the install button?</h2>
            <p className="text-muted-foreground">
              Follow these steps to manually install GASMASK on your device.
            </p>
          </div>
          <div className="max-w-2xl mx-auto">
            <Accordion type="single" collapsible className="w-full">
              {manualInstructions.map((instruction) => (
                <AccordionItem key={instruction.id} value={instruction.id}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3">
                      <instruction.icon className="h-5 w-5 text-primary" />
                      <span className="font-medium">{instruction.title}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ol className="space-y-2 pl-8 list-decimal">
                      {instruction.steps.map((step, i) => (
                        <li key={i} className="text-sm text-muted-foreground">{step}</li>
                      ))}
                    </ol>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>
      </div>
    </div>
  );
}
