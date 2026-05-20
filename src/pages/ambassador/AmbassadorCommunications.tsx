/**
 * Ambassador Communications — full rebuild.
 * Tabs: Messages | Call Log | Templates
 * Every assigned store is always shown (no more "No conversations yet").
 */
import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  MessageSquare, Phone, Send, Search, FileText, PhoneCall, PhoneIncoming, PhoneOutgoing,
  PhoneMissed, Languages, MoreVertical, Plus, Trash2, Sparkles, Activity, Users, CheckCheck,
  PanelRightOpen,
} from 'lucide-react';
import {
  useAmbassadorThreads, useCallHistory, useLogCall, useStoreMessages,
  useTemplates, useAmbassadorKPIs, renderTemplate, MessageThread, MessageTemplate,
} from '@/hooks/useAmbassadorComms';
import { useStoreContext } from '@/hooks/useStoreContext';
import { StoreContextSidebar } from '@/components/ambassador/StoreContextSidebar';
import { format, formatDistanceToNow } from 'date-fns';
import { AmbassadorLayout } from '@/components/ambassador/AmbassadorLayout';
import { toast } from 'sonner';
import { useCall } from '@/components/communication/CallProvider';
import { cn } from '@/lib/utils';

const TEMPLATE_CATEGORIES = ['reorder', 'new_product', 'route_eta', 'payment', 'visit', 'promo', 'custom'];

const QUICK_REPLIES = [
  { en: "I'm on my way", ar: 'أنا في الطريق' },
  { en: 'Just restocked, want a refill?', ar: 'تم تجديد المخزون، هل تريد إعادة طلب؟' },
  { en: 'New drop available, interested?', ar: 'منتج جديد متوفر، مهتم؟' },
  { en: 'Friendly payment reminder', ar: 'تذكير ودي بشأن الدفع' },
];

export default function AmbassadorCommunications() {
  const [tab, setTab] = useState('messages');
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'overdue'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composer, setComposer] = useState('');
  const [composerAr, setComposerAr] = useState('');
  const [lang, setLang] = useState<'en' | 'ar'>('en');
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [callDialogOpen, setCallDialogOpen] = useState(false);
  const [callTarget, setCallTarget] = useState<MessageThread | null>(null);

  const { initiateCall } = useCall();
  const { threads, isLoading: threadsLoading, sendMessage, isSending, ambassador } = useAmbassadorThreads();
  const { data: callLogs = [], isLoading: callsLoading } = useCallHistory();
  const logCall = useLogCall();
  const kpis = useAmbassadorKPIs();
  const { templates, upsert: upsertTemplate, remove: removeTemplate, recordUsage } = useTemplates();
  const messagesQ = useStoreMessages(selectedId);

  const selected = threads.find((t) => t.id === selectedId);
  const filtered = useMemo(() => {
    let list = threads;
    if (filter === 'overdue') {
      const cutoff = Date.now() - 14 * 24 * 3600 * 1000;
      list = list.filter((t) => new Date(t.last_message_at).getTime() < cutoff);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (t) =>
          t.store_name.toLowerCase().includes(q) ||
          t.contact_name.toLowerCase().includes(q) ||
          (t.contact_phone || '').includes(q),
      );
    }
    return list;
  }, [threads, filter, searchQuery]);

  const handleSend = async () => {
    if (!selected) return;
    const body = lang === 'ar' ? composerAr : composer;
    if (!body.trim() || !selected.contact_phone) {
      if (!selected.contact_phone) toast.error('No phone on file for this store');
      return;
    }
    try {
      await sendMessage({
        storeId: selected.store_id,
        phone: selected.contact_phone,
        content: body,
        bodyAr: lang === 'ar' ? composerAr : composerAr || undefined,
      });
      setComposer('');
      setComposerAr('');
      toast.success('Sent');
    } catch { /* hook toasts */ }
  };

  const handleQuickReply = (q: { en: string; ar: string }) => {
    if (lang === 'ar') setComposerAr((p) => (p ? p + ' ' : '') + q.ar);
    else setComposer((p) => (p ? p + ' ' : '') + q.en);
  };

  const handleUseTemplate = (tpl: MessageTemplate) => {
    if (!selected) return;
    const ctx = {
      store_name: selected.store_name,
      owner_name: selected.contact_name,
      ambassador_name: ambassador?.name || '',
    };
    setComposer(renderTemplate(tpl.body_en, ctx));
    setComposerAr(renderTemplate(tpl.body_ar, ctx));
    recordUsage(tpl.id);
    setTemplatePickerOpen(false);
  };

  const openCallDialog = (thread: MessageThread) => {
    setCallTarget(thread);
    setCallDialogOpen(true);
  };

  const startDirectCall = async () => {
    if (!callTarget) return;
    try {
      await logCall.mutateAsync({
        storeId: callTarget.store_id,
        phone: callTarget.contact_phone || '',
        type: 'outbound',
        outcome: 'attempted',
      });
      if (callTarget.contact_phone) {
        initiateCall({
          destinationPhone: callTarget.contact_phone,
          entityType: 'store',
          entityId: callTarget.store_id,
          entityName: callTarget.store_name,
        });
      }
    } finally {
      setCallDialogOpen(false);
    }
  };

  const startAiCall = async () => {
    if (!callTarget) return;
    await logCall.mutateAsync({
      storeId: callTarget.store_id,
      phone: callTarget.contact_phone || '',
      type: 'outbound',
      outcome: 'ai_scheduled',
      aiAssisted: true,
    });
    toast.success('AI call queued');
    setCallDialogOpen(false);
  };

  const unreadCount = 0; // realtime hook may surface this later

  return (
    <AmbassadorLayout
      title="Communications"
      subtitle="Messages, calls, and templates"
      backPath="/ambassador/dashboard"
    >
      <div className="p-6 space-y-4">
        {/* KPI strip */}
        <KpiStrip data={kpis.data} />

        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="messages" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Messages
            </TabsTrigger>
            <TabsTrigger value="calls" className="gap-2">
              <Phone className="h-4 w-4" />
              Call Log
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <FileText className="h-4 w-4" />
              Templates
            </TabsTrigger>
          </TabsList>

          {/* ──────────── MESSAGES ──────────── */}
          <TabsContent value="messages">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[640px]">
              {/* Thread list */}
              <Card className="lg:col-span-1 flex flex-col">
                <CardHeader className="pb-3 space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search stores, owners, phone…"
                      className="pl-9"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    {(['all', 'unread', 'overdue'] as const).map((f) => (
                      <Badge
                        key={f}
                        variant={filter === f ? 'default' : 'outline'}
                        className="cursor-pointer capitalize"
                        onClick={() => setFilter(f)}
                      >
                        {f}
                      </Badge>
                    ))}
                  </div>
                </CardHeader>
                <CardContent className="p-0 flex-1">
                  <ScrollArea className="h-full">
                    {threadsLoading ? (
                      <div className="p-4 space-y-3">
                        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16" />)}
                      </div>
                    ) : filtered.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        <Users className="h-10 w-10 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">
                          {threads.length === 0
                            ? 'No stores assigned yet'
                            : 'No stores match this filter'}
                        </p>
                      </div>
                    ) : (
                      filtered.map((t) => {
                        const ts = t.last_message_at && new Date(t.last_message_at).getTime() > 0
                          ? formatDistanceToNow(new Date(t.last_message_at), { addSuffix: true })
                          : '—';
                        return (
                          <div
                            key={t.id}
                            onClick={() => setSelectedId(t.id)}
                            className={cn(
                              'flex items-start gap-3 p-3 border-b cursor-pointer transition-colors',
                              selectedId === t.id ? 'bg-muted' : 'hover:bg-muted/50',
                            )}
                          >
                            <Avatar>
                              <AvatarFallback>{t.store_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium truncate">{t.store_name}</span>
                                <span className="text-xs text-muted-foreground whitespace-nowrap">{ts}</span>
                              </div>
                              <p className="text-xs text-muted-foreground truncate">{t.contact_name}</p>
                              <p className="text-sm truncate text-muted-foreground/80">
                                {t.last_message || <em className="opacity-60">No messages yet</em>}
                              </p>
                            </div>
                            {(t.owed_amount || 0) > 0 && (
                              <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                                ${Math.round(t.owed_amount || 0)}
                              </Badge>
                            )}
                          </div>
                        );
                      })
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Thread view */}
              <Card className="lg:col-span-2 flex flex-col">
                {selected ? (
                  <>
                    <CardHeader className="border-b">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar>
                            <AvatarFallback>{selected.store_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <CardTitle className="text-base truncate">{selected.store_name}</CardTitle>
                            <CardDescription className="truncate">
                              {selected.contact_name} · {selected.contact_phone || 'no phone'}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {selected.last_visit_at && (
                            <Badge variant="outline">
                              Last visit {formatDistanceToNow(new Date(selected.last_visit_at), { addSuffix: true })}
                            </Badge>
                          )}
                          <Button size="sm" variant="outline" onClick={() => openCallDialog(selected)}>
                            <Phone className="h-4 w-4 mr-2" />
                            Call
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="flex-1 p-0">
                      <ScrollArea className="h-[360px] p-4">
                        {messagesQ.isLoading ? (
                          <div className="space-y-3">
                            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}
                          </div>
                        ) : (messagesQ.data || []).length === 0 ? (
                          <div className="text-center text-muted-foreground py-12">
                            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No messages yet — say hi 👋</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {(messagesQ.data || []).map((m) => (
                              <div
                                key={m.id}
                                className={cn(
                                  'flex',
                                  m.direction === 'outbound' ? 'justify-end' : 'justify-start',
                                )}
                              >
                                <div
                                  className={cn(
                                    'max-w-[75%] rounded-lg px-3 py-2 text-sm',
                                    m.direction === 'outbound'
                                      ? 'bg-primary text-primary-foreground'
                                      : 'bg-muted',
                                  )}
                                >
                                  <div className="whitespace-pre-wrap">{m.content}</div>
                                  {m.body_translated && (
                                    <div dir="rtl" className="mt-1 pt-1 border-t border-white/20 text-[12px] opacity-90">
                                      {m.body_translated}
                                    </div>
                                  )}
                                  <div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-70">
                                    {format(new Date(m.created_at), 'h:mm a')}
                                    {m.direction === 'outbound' && (
                                      <CheckCheck className={cn('h-3 w-3', m.status === 'read' && 'text-sky-300')} />
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                    </CardContent>

                    {/* Composer */}
                    <div className="border-t p-3 space-y-2">
                      <div className="flex flex-wrap gap-1">
                        {QUICK_REPLIES.map((q, i) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className="cursor-pointer text-xs"
                            onClick={() => handleQuickReply(q)}
                          >
                            {lang === 'ar' ? q.ar : q.en}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant={lang === 'en' ? 'default' : 'outline'}
                          onClick={() => setLang('en')}
                        >
                          <Languages className="h-3 w-3 mr-1" />
                          EN
                        </Button>
                        <Button
                          size="sm"
                          variant={lang === 'ar' ? 'default' : 'outline'}
                          onClick={() => setLang('ar')}
                        >
                          AR
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setTemplatePickerOpen(true)}>
                          <FileText className="h-3 w-3 mr-1" />
                          Templates
                        </Button>
                      </div>
                      <div className="flex gap-2 items-end">
                        <Textarea
                          dir={lang === 'ar' ? 'rtl' : 'ltr'}
                          placeholder={lang === 'ar' ? 'اكتب رسالة…' : 'Type a message…'}
                          value={lang === 'ar' ? composerAr : composer}
                          onChange={(e) =>
                            lang === 'ar' ? setComposerAr(e.target.value) : setComposer(e.target.value)
                          }
                          rows={2}
                          className="resize-none"
                        />
                        <Button
                          onClick={handleSend}
                          disabled={isSending || (!composer.trim() && !composerAr.trim())}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-40" />
                      <p>Select a store to start messaging</p>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </TabsContent>

          {/* ──────────── CALLS ──────────── */}
          <TabsContent value="calls" className="space-y-4">
            <Card>
              <ScrollArea className="h-[600px]">
                {callsLoading ? (
                  <div className="p-4 space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14" />)}</div>
                ) : callLogs.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground">
                    <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No calls yet. Click any store to start.</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {callLogs.map((c) => (
                      <div key={c.id} className="flex items-center gap-4 p-4 hover:bg-muted/50">
                        <div className="p-2 rounded-full bg-muted">
                          {c.type === 'inbound' ? <PhoneIncoming className="h-4 w-4 text-green-500" />
                            : c.type === 'missed' ? <PhoneMissed className="h-4 w-4 text-red-500" />
                            : <PhoneOutgoing className="h-4 w-4 text-blue-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{c.store_name}</span>
                            {c.ai_assisted && <Badge variant="secondary" className="gap-1"><Sparkles className="h-3 w-3" />AI</Badge>}
                            {c.follow_up_required && <Badge variant="outline">Follow-up</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {c.contact_name} · {c.phone} {c.outcome && `· ${c.outcome}`}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-sm">{formatDuration(c.duration_seconds)}</div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(c.created_at), 'MMM d, h:mm a')}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const t = threads.find((th) => th.store_id === c.store_id);
                            if (t) openCallDialog(t);
                          }}
                        >
                          <PhoneCall className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </Card>
          </TabsContent>

          {/* ──────────── TEMPLATES ──────────── */}
          <TabsContent value="templates" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                {templates.length} template{templates.length === 1 ? '' : 's'} available
              </p>
              <Button onClick={() => { setEditingTemplate(null); setTemplateEditorOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                New Template
              </Button>
            </div>

            {templates.length === 0 ? (
              <Card className="p-12 text-center text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p>No templates yet. Create one to speed up replies.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((tpl) => (
                  <Card key={tpl.id} className="hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">{tpl.name}</CardTitle>
                          <div className="flex gap-1 mt-1">
                            <Badge variant="secondary" className="text-[10px]">{tpl.category}</Badge>
                            {tpl.is_global && <Badge className="text-[10px]">Global</Badge>}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => { setEditingTemplate(tpl); setTemplateEditorOpen(true); }}
                              disabled={tpl.is_global}
                            >
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => removeTemplate(tpl.id)}
                              disabled={tpl.is_global}
                            >
                              <Trash2 className="h-3 w-3 mr-2" />Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{tpl.body_en}</p>
                      {tpl.body_ar && (
                        <p dir="rtl" className="text-sm text-muted-foreground mb-2 line-clamp-2 italic">{tpl.body_ar}</p>
                      )}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Used {tpl.usage_count}×</span>
                        <Button size="sm" variant="outline" onClick={() => {
                          if (!selected) { setTab('messages'); toast.info('Pick a store first'); return; }
                          handleUseTemplate(tpl);
                          setTab('messages');
                        }}>
                          Use
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Template picker (inside composer) */}
      <Dialog open={templatePickerOpen} onOpenChange={setTemplatePickerOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Insert a template</DialogTitle>
            <DialogDescription>Variables are auto-filled from the selected store.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {templates.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No templates yet. Create one in the Templates tab.
              </p>
            )}
            {templates.map((tpl) => (
              <Card
                key={tpl.id}
                className="cursor-pointer hover:border-primary"
                onClick={() => handleUseTemplate(tpl)}
              >
                <CardContent className="p-3">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-sm">{tpl.name}</span>
                    <Badge variant="secondary" className="text-[10px]">{tpl.category}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{tpl.body_en}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Template editor */}
      <TemplateEditorDialog
        open={templateEditorOpen}
        onOpenChange={setTemplateEditorOpen}
        template={editingTemplate}
        onSave={async (payload) => {
          await upsertTemplate(payload);
          setTemplateEditorOpen(false);
        }}
      />

      {/* Call type dialog */}
      <Dialog open={callDialogOpen} onOpenChange={setCallDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Call {callTarget?.store_name}</DialogTitle>
            <DialogDescription>{callTarget?.contact_name} · {callTarget?.contact_phone}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <Button onClick={startDirectCall} className="h-20 flex-col gap-2">
              <Phone className="h-5 w-5" />
              Direct Call
            </Button>
            <Button onClick={startAiCall} variant="secondary" className="h-20 flex-col gap-2">
              <Sparkles className="h-5 w-5" />
              AI-Assisted
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AmbassadorLayout>
  );
}

function KpiStrip({ data }: { data?: { messages: number; calls: number; storesContacted: number; responseRate: number } }) {
  const items = [
    { label: 'Messages today', value: data?.messages ?? 0, icon: MessageSquare },
    { label: 'Calls today', value: data?.calls ?? 0, icon: Phone },
    { label: 'Stores contacted', value: data?.storesContacted ?? 0, icon: Users },
    { label: '7-day response', value: `${data?.responseRate ?? 0}%`, icon: Activity },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((it) => (
        <Card key={it.label} className="p-3 flex items-center gap-3">
          <div className="p-2 rounded-md bg-primary/10 text-primary"><it.icon className="h-4 w-4" /></div>
          <div>
            <div className="text-lg font-semibold">{it.value}</div>
            <div className="text-xs text-muted-foreground">{it.label}</div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function TemplateEditorDialog({
  open, onOpenChange, template, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  template: MessageTemplate | null;
  onSave: (payload: Partial<MessageTemplate> & { id?: string }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('custom');
  const [bodyEn, setBodyEn] = useState('');
  const [bodyAr, setBodyAr] = useState('');

  React.useEffect(() => {
    if (open) {
      setName(template?.name || '');
      setCategory(template?.category || 'custom');
      setBodyEn(template?.body_en || '');
      setBodyAr(template?.body_ar || '');
    }
  }, [open, template]);

  const variables = Array.from(new Set(
    ([...bodyEn.matchAll(/\{\{\s*(\w+)\s*\}\}/g), ...bodyAr.matchAll(/\{\{\s*(\w+)\s*\}\}/g)]).map((m) => m[1])
  ));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{template ? 'Edit template' : 'New template'}</DialogTitle>
          <DialogDescription>
            Use <code>{'{{store_name}}'}</code>, <code>{'{{owner_name}}'}</code>, <code>{'{{ambassador_name}}'}</code> for personalization.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Reorder reminder" />
            </div>
            <div>
              <label className="text-xs font-medium">Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TEMPLATE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c} className="capitalize">{c.replace('_', ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium">English body</label>
            <Textarea value={bodyEn} onChange={(e) => setBodyEn(e.target.value)} rows={3} />
          </div>
          <div>
            <label className="text-xs font-medium">Arabic body</label>
            <Textarea dir="rtl" value={bodyAr} onChange={(e) => setBodyAr(e.target.value)} rows={3} />
          </div>
          {variables.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="text-xs text-muted-foreground mr-1">Variables:</span>
              {variables.map((v) => <Badge key={v} variant="outline" className="text-[10px]">{`{{${v}}}`}</Badge>)}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => onSave({ id: template?.id, name, category, body_en: bodyEn, body_ar: bodyAr, variables })}
            disabled={!name.trim() || (!bodyEn.trim() && !bodyAr.trim())}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatDuration(seconds?: number | null) {
  if (!seconds) return '-';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
