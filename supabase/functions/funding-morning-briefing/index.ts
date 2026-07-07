import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const today = new Date().toISOString().split('T')[0];
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString().split('T')[0];
    const in30days = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    // STEP 1 — gather in parallel
    const [stagesRes, remindersRes, pendingRes, scoreWinsRes, grantDeadlinesRes, fundingMtdRes] =
      await Promise.all([
        supabase.from('funding_clients').select('stage').neq('status', 'archived'),
        supabase.from('client_reminders')
          .select('id, title, priority, reminder_type, due_date, funding_clients!inner(full_name)')
          .lte('due_date', today).eq('is_completed', false)
          .order('priority', { ascending: false }).limit(10),
        supabase.from('funding_applications')
          .select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('client_score_history')
          .select('score_avg, score_date, funding_clients!inner(full_name)')
          .gte('score_date', monthStart)
          .order('score_avg', { ascending: false }).limit(5),
        supabase.from('client_grant_matches')
          .select('grant_name, deadline, grant_amount, status, funding_clients!inner(full_name)')
          .lte('deadline', in30days)
          .in('status', ['identified', 'eligible'])
          .order('deadline', { ascending: true }).limit(5),
        supabase.from('funding_clients')
          .select('funding_received')
          .gte('updated_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
          .gt('funding_received', 0),
      ]);

    const stages = (stagesRes.data ?? []) as Array<{ stage: string }>;
    const stageMap = stages.reduce((acc, r) => {
      const k = r.stage ?? 'unknown';
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const clientsTotal = stages.length;
    const clientsActive = stages.filter(r => !['complete', 'archived'].includes(r.stage)).length;
    const reminders = remindersRes.data ?? [];
    const remindersCount = reminders.length;
    const scoreWins = scoreWinsRes.data ?? [];
    const grantDeadlines = grantDeadlinesRes.data ?? [];
    const pendingCount = pendingRes.count ?? 0;
    const fundingMtd = (fundingMtdRes.data ?? [])
      .reduce((s: number, r: any) => s + Number(r.funding_received ?? 0), 0);

    // STEP 2 — Claude (null-guarded)
    const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    let aiSummary = '';
    if (ANTHROPIC_KEY) {
      try {
        const promptContent =
          'You are the Dynasty Funding Hub morning briefing AI.\n' +
          'Date: ' + today + '\n\n' +
          'Pipeline by stage:\n' + JSON.stringify(stageMap) + '\n\n' +
          'Reminders due today: ' + remindersCount + '\n' +
          reminders.map((r: any) => '- ' + r.title + ' (' + r.priority + ')').join('\n') + '\n\n' +
          'Pending applications: ' + pendingCount + '\n\n' +
          'Top score wins this month:\n' +
          scoreWins.map((r: any) => '- ' + (r.funding_clients?.full_name ?? '?') + ': avg ' + r.score_avg).join('\n') + '\n\n' +
          'Grant deadlines < 30 days:\n' +
          grantDeadlines.map((r: any) => '- ' + r.grant_name + ' due ' + r.deadline + ' ($' + r.grant_amount + ')').join('\n') + '\n\n' +
          'Funding received this month: $' + fundingMtd.toFixed(2) + '\n\n' +
          'Generate:\n' +
          '1. One sentence overall status\n' +
          '2. Top 3 action items for today (numbered, specific)\n' +
          '3. One alert if anything urgent\n' +
          '4. One win to celebrate\n\n' +
          'Plain text. Under 200 words. No markdown. No bullets.';

        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': ANTHROPIC_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 600,
            messages: [{ role: 'user', content: promptContent }],
          }),
        });
        if (resp.ok) {
          const data = await resp.json();
          aiSummary = data.content?.[0]?.text ?? '';
        } else {
          console.error('Anthropic non-OK:', resp.status, await resp.text());
        }
      } catch (e) {
        console.error('AI error:', e);
      }
    }
    const aiGenerated = aiSummary.length > 0;
    if (!aiSummary) {
      aiSummary =
        'Pipeline: ' + Object.entries(stageMap).map(([k, v]) => k + '=' + v).join(', ') +
        '. Reminders due: ' + remindersCount +
        '. Funding MTD: $' + fundingMtd.toFixed(2) + '.';
    }

    // STEP 3 — upsert
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from('funding_morning_briefings')
      .upsert({
        briefing_date: today,
        generated_at: nowIso,
        clients_total: clientsTotal,
        clients_active: clientsActive,
        total_active_clients: clientsActive,
        reminders_due_today: remindersCount,
        funding_received_mtd: fundingMtd,
        ai_summary: aiSummary,
        raw_data: {
          stages: stageMap,
          reminders,
          score_wins: scoreWins,
          grant_deadlines: grantDeadlines,
          pending_applications: pendingCount,
        },
        generated_by: 'edge_function',
        clients_summary: { by_stage: stageMap, total: clientsTotal, active: clientsActive },
        alerts: { reminders, grant_deadlines: grantDeadlines },
        operator_actions: { ai_summary: aiSummary, generated_at: nowIso },
      }, { onConflict: 'briefing_date' });

    if (error) throw error;

    return new Response(JSON.stringify({
      success: true,
      briefing_date: today,
      clients_total: clientsTotal,
      clients_active: clientsActive,
      reminders_due: remindersCount,
      funding_mtd: fundingMtd,
      ai_generated: aiGenerated,
      summary_preview: aiSummary.slice(0, 100) + (aiSummary.length > 100 ? '...' : ''),
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('Briefing error:', e);
    return new Response(JSON.stringify({ success: false, error: e?.message ?? String(e) }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
