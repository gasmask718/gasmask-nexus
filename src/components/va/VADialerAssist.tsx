import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useVASession } from '@/contexts/VASessionContext';
import { VAScripts } from './VAScripts';
import { VARebuttals } from './VARebuttals';
import { VAFAQs } from './VAFAQs';
import { VAServicesPricing } from './VAServicesPricing';

export function VADialerAssist() {
  const { t } = useVASession();

  return (
    <div className="h-full flex flex-col">
      <Tabs defaultValue="services" className="flex-1 flex flex-col">
        <TabsList className="w-full bg-slate-800 rounded-t-xl rounded-b-none border-b border-slate-700 shrink-0">
          <TabsTrigger value="services" className="flex-1 text-xs">Services</TabsTrigger>
          <TabsTrigger value="faqs" className="flex-1 text-xs">{t('va.call.faqs')}</TabsTrigger>
          <TabsTrigger value="scripts" className="flex-1 text-xs">{t('va.call.scripts')}</TabsTrigger>
          <TabsTrigger value="rebuttals" className="flex-1 text-xs">{t('va.call.rebuttals')}</TabsTrigger>
        </TabsList>
        <div className="flex-1 overflow-y-auto">
          <TabsContent value="services" className="p-4 mt-0"><VAServicesPricing /></TabsContent>
          <TabsContent value="faqs" className="p-4 mt-0"><VAFAQs /></TabsContent>
          <TabsContent value="scripts" className="p-4 mt-0"><VAScripts /></TabsContent>
          <TabsContent value="rebuttals" className="p-4 mt-0"><VARebuttals /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
