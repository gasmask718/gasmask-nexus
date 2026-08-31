import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useVACompanyScript, useVACompanyRebuttals } from '@/hooks/useVACompanyScript';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BookOpen, Package, MessageSquareWarning, Target, Sparkles, ListChecks, Loader2,
} from 'lucide-react';

const TAB_TRIGGER =
  'data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-300 text-slate-400 text-[11px] gap-1 px-2';

function Loading() {
  return (
    <div className="space-y-2 p-3">
      <Skeleton className="h-4 w-2/3 bg-slate-700/50" />
      <Skeleton className="h-16 w-full bg-slate-700/50" />
      <Skeleton className="h-16 w-full bg-slate-700/50" />
    </div>
  );
}

function ScriptTab({ companySlug }: { companySlug?: string | null }) {
  const { data, isLoading } = useVACompanyScript(companySlug);
  if (isLoading) return <Loading />;
  return (
    <Accordion type="multiple" defaultValue={['step-1']} className="px-2">
      {data?.map((s: any) => (
        <AccordionItem
          key={s.id}
          value={`step-${s.step_number}`}
          className="border-slate-700/50"
        >
          <AccordionTrigger className="text-left hover:no-underline py-2">
            <div className="flex items-center gap-2 text-xs">
              <Badge className="bg-cyan-500/20 text-cyan-300 px-1.5 py-0 text-[10px]">
                {s.step_number}
              </Badge>
              <span className="text-white font-semibold">
                {s.display_label || s.step_name}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-3">
            <div className="text-xs leading-relaxed text-slate-200 whitespace-pre-wrap font-mono bg-slate-900/60 rounded-md p-3 border border-slate-700/50">
              {s.va_says}
            </div>
            {s.coaching_tip && (
              <div className="mt-2 text-[11px] text-amber-300/90 italic">
                💡 {s.coaching_tip}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

function PackagesTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['brandaro-packages'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('brandaro_packages')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      return data || [];
    },
  });
  if (isLoading) return <Loading />;
  return (
    <div className="p-2 space-y-2">
      {data?.map((p: any) => (
        <div
          key={p.id}
          className={`rounded-lg border p-3 ${
            p.is_target
              ? 'border-cyan-400/60 bg-cyan-500/5'
              : 'border-slate-700/50 bg-slate-900/40'
          }`}
        >
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-white capitalize">
                {p.package_name}
              </h4>
              {p.is_target && (
                <Badge className="bg-cyan-500 text-white text-[9px] px-1.5 py-0">
                  TARGET
                </Badge>
              )}
            </div>
            <span className="text-cyan-300 font-bold text-sm">{p.price}</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {p.payment_terms}
          </div>
          <div className="text-xs text-slate-200 mt-2">{p.included_highlights}</div>
          <div className="text-[11px] text-slate-500 italic mt-1">
            Best for: {p.best_for}
          </div>
        </div>
      ))}
    </div>
  );
}

function ObjectionsTab({ companySlug }: { companySlug?: string | null }) {
  const { data, isLoading } = useVACompanyRebuttals(companySlug);
  if (isLoading) return <Loading />;
  return (
    <Accordion type="multiple" className="px-2">
      {data?.map((r: any) => (
        <AccordionItem
          key={r.id}
          value={r.objection_key}
          className="border-slate-700/50"
        >
          <AccordionTrigger className="text-left hover:no-underline py-2">
            <span className="text-xs text-white font-medium">"{r.label}"</span>
          </AccordionTrigger>
          <AccordionContent className="pb-3 space-y-2">
            {r.human_response && (
              <div className="text-xs text-slate-200 bg-slate-900/60 rounded-md p-3 border border-slate-700/50">
                <div className="text-[10px] uppercase text-emerald-400 font-bold mb-1">
                  Rebuttal
                </div>
                {r.human_response}
              </div>
            )}
            {r.soft_rebuttal && (
              <div className="text-xs text-slate-300 bg-slate-900/40 rounded-md p-2 border border-slate-700/30">
                <div className="text-[10px] uppercase text-slate-400 mb-1">Soft</div>
                {r.soft_rebuttal}
              </div>
            )}
            {r.aggressive_rebuttal && (
              <div className="text-xs text-slate-300 bg-slate-900/40 rounded-md p-2 border border-slate-700/30">
                <div className="text-[10px] uppercase text-rose-400 mb-1">
                  Aggressive
                </div>
                {r.aggressive_rebuttal}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

function ClosingTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['brandaro-closing-techniques'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('brandaro_closing_techniques')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      return data || [];
    },
  });
  if (isLoading) return <Loading />;
  return (
    <div className="p-2 space-y-2">
      {data?.map((c: any) => (
        <div
          key={c.id}
          className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-3"
        >
          <div className="text-xs font-bold text-cyan-300 mb-1">
            {c.technique_name}
          </div>
          <div className="text-xs text-slate-200 italic">"{c.script}"</div>
        </div>
      ))}
    </div>
  );
}

function HooksTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['brandaro-industry-hooks'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('brandaro_industry_hooks')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      return data || [];
    },
  });
  if (isLoading) return <Loading />;
  return (
    <Accordion type="multiple" className="px-2">
      {data?.map((h: any) => (
        <AccordionItem
          key={h.id}
          value={h.id}
          className="border-slate-700/50"
        >
          <AccordionTrigger className="text-left hover:no-underline py-2">
            <span className="text-xs text-white font-semibold">{h.industry}</span>
          </AccordionTrigger>
          <AccordionContent className="pb-3">
            <div className="text-xs text-slate-200 italic">"{h.hook}"</div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

function WorkflowsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['brandaro-post-call-workflows'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('brandaro_post_call_workflows')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      return data || [];
    },
  });
  if (isLoading) return <Loading />;
  return (
    <div className="p-2 space-y-2">
      {data?.map((w: any) => (
        <div
          key={w.id}
          className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-3"
        >
          <div className="text-xs font-bold text-cyan-300 mb-1">{w.outcome}</div>
          <div className="text-xs text-slate-200 leading-relaxed">{w.steps}</div>
        </div>
      ))}
    </div>
  );
}

interface VAScriptsRebuttalsPanelProps {
  /** Active VA company slug. Brandaro-only knowledge tabs are hidden for others. */
  companySlug?: string | null;
}

export function VAScriptsRebuttalsPanel({ companySlug }: VAScriptsRebuttalsPanelProps = {}) {
  const [tab, setTab] = useState('script');
  // Packages / Closing / Hooks / Workflows are Brandaro sales assets — never
  // show Brandaro content inside another company's lane.
  const showBrandaroAssets = !companySlug || companySlug === 'brandaro';
  return (
    <div className="h-full flex flex-col bg-slate-800/40">
      <div className="px-3 py-2 border-b border-slate-700/50 flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-cyan-400" />
        <h3 className="text-sm font-bold text-white">Scripts &amp; Rebuttals</h3>
      </div>
      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="bg-slate-900/60 border-b border-slate-700/50 rounded-none w-full justify-start p-1 h-auto flex-wrap">
          <TabsTrigger value="script" className={TAB_TRIGGER}>
            <BookOpen className="h-3 w-3" /> Script
          </TabsTrigger>
          {showBrandaroAssets && (
            <TabsTrigger value="packages" className={TAB_TRIGGER}>
              <Package className="h-3 w-3" /> Packages
            </TabsTrigger>
          )}
          <TabsTrigger value="objections" className={TAB_TRIGGER}>
            <MessageSquareWarning className="h-3 w-3" /> Objections
          </TabsTrigger>
          {showBrandaroAssets && (
            <>
              <TabsTrigger value="closing" className={TAB_TRIGGER}>
                <Target className="h-3 w-3" /> Closing
              </TabsTrigger>
              <TabsTrigger value="hooks" className={TAB_TRIGGER}>
                <Sparkles className="h-3 w-3" /> Hooks
              </TabsTrigger>
              <TabsTrigger value="workflows" className={TAB_TRIGGER}>
                <ListChecks className="h-3 w-3" /> Workflows
              </TabsTrigger>
            </>
          )}
        </TabsList>
        <ScrollArea className="flex-1 min-h-0">
          <TabsContent value="script" className="m-0"><ScriptTab companySlug={companySlug} /></TabsContent>
          <TabsContent value="objections" className="m-0"><ObjectionsTab companySlug={companySlug} /></TabsContent>
          {showBrandaroAssets && (
            <>
              <TabsContent value="packages" className="m-0"><PackagesTab /></TabsContent>
              <TabsContent value="closing" className="m-0"><ClosingTab /></TabsContent>
              <TabsContent value="hooks" className="m-0"><HooksTab /></TabsContent>
              <TabsContent value="workflows" className="m-0"><WorkflowsTab /></TabsContent>
            </>
          )}
        </ScrollArea>
      </Tabs>
    </div>
  );
}
