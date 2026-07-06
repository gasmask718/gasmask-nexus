// Grant Deadline Reminder — daily cron
// Finds grant_applications with deadline in the next 7 days (open statuses only)
// and inserts a reminder task into grant_tasks (idempotent via unique index).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const today = new Date();
    const in7 = new Date();
    in7.setDate(today.getDate() + 7);
    const toISO = (d: Date) => d.toISOString().slice(0, 10);

    const { data: apps, error } = await supabase
      .from('grant_applications')
      .select('id, grant_name, deadline, status')
      .gte('deadline', toISO(today))
      .lte('deadline', toISO(in7))
      .not('status', 'in', '(awarded,denied,closed)');

    if (error) throw error;

    const rows = apps ?? [];
    let remindersAdded = 0;

    for (const ga of rows) {
      const dl = new Date(ga.deadline);
      const daysLeft = Math.max(
        0,
        Math.ceil((dl.getTime() - today.getTime()) / 86400000),
      );
      const title = `⚡ DEADLINE IN ${daysLeft} DAYS: ${ga.grant_name}`;

      const { error: insErr, count } = await supabase
        .from('grant_tasks')
        .upsert(
          {
            application_id: ga.id,
            title,
            description: null,
            due_date: ga.deadline,
            status: 'pending',
          },
          { onConflict: 'application_id,title', ignoreDuplicates: true, count: 'exact' },
        );

      if (insErr) {
        console.error('insert failed', ga.id, insErr);
        continue;
      }
      if ((count ?? 0) > 0) remindersAdded++;
    }

    const body = {
      checked: rows.length,
      urgent: rows.length, // all rows are within 7 days by query
      reminders_added: remindersAdded,
    };

    return new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
