/**
 * AmbassadorFeedback — Ambassador-facing Feedback tab.
 * Shows the user's own submissions + status, plus a "New feedback" button.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AmbassadorLayout } from '@/components/ambassador/AmbassadorLayout';
import { FeedbackDialog } from '@/components/feedback/FeedbackDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Inbox } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useTranslation } from '@/hooks/useTranslation';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  new: 'secondary',
  reviewing: 'outline',
  in_progress: 'default',
  resolved: 'default',
  wont_fix: 'destructive',
};

export default function AmbassadorFeedback() {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      new: t('amb.feedback.status.new'),
      reviewing: t('amb.feedback.status.reviewing'),
      in_progress: t('amb.feedback.status.in_progress'),
      resolved: t('amb.feedback.status.resolved'),
      wont_fix: t('amb.feedback.status.wont_fix'),
    };
    return map[s] ?? s;
  };

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['feedback_submissions', 'mine'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feedback_submissions')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <AmbassadorLayout title={t('amb.feedback.title')} subtitle={t('amb.feedback.subtitle')}>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            {t('amb.feedback.your_subs')}
          </p>
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> {t('amb.feedback.new')}
          </Button>
        </div>

        {isLoading ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">{t('amb.feedback.loading')}</CardContent></Card>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground space-y-2">
              <Inbox className="h-8 w-8 mx-auto opacity-50" />
              <p>{t('amb.feedback.none_yet')}</p>
              <p className="text-xs">{t('amb.feedback.use_report_btn')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((it: any) => (
              <Card key={it.id}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start gap-2 flex-wrap">
                    <div>
                      <CardTitle className="text-base">{it.title}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        {it.type} · {it.page_context || '—'} · {formatDistanceToNow(new Date(it.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <Badge variant={STATUS_VARIANT[it.status] || 'secondary'}>
                      {statusLabel(it.status)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{it.description}</p>
                  {it.admin_notes && (
                    <div className="mt-3 p-3 rounded bg-muted text-sm">
                      <p className="text-xs font-medium text-muted-foreground mb-1">{t('amb.feedback.reply_from_team')}</p>
                      <p className="whitespace-pre-wrap">{it.admin_notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <FeedbackDialog open={open} onOpenChange={setOpen} />
    </AmbassadorLayout>
  );
}
