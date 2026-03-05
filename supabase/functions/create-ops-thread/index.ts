import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth' }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify caller
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    // Check admin role
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const elevatedRoles = ['admin', 'owner', 'va'];
    const hasElevated = roles?.some(r => elevatedRoles.includes(r.role));
    if (!hasElevated) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
    }

    const body = await req.json();
    const { type = 'message', title, message_body, priority = 'normal', entity_type, entity_id, targeting, metadata } = body;

    if (!title || !message_body) {
      return new Response(JSON.stringify({ error: 'title and message_body required' }), { status: 400, headers: corsHeaders });
    }

    // Resolve recipients from targeting
    const recipientUserIds = new Set<string>();
    const tgt = targeting || {};

    // Direct user IDs
    if (tgt.user_ids?.length) {
      tgt.user_ids.forEach((id: string) => recipientUserIds.add(id));
    }

    // By role
    if (tgt.roles?.length) {
      const { data: roleUsers } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', tgt.roles);
      roleUsers?.forEach(r => recipientUserIds.add(r.user_id));
    }

    if (recipientUserIds.size === 0) {
      return new Response(JSON.stringify({ error: 'No recipients resolved from targeting' }), { status: 400, headers: corsHeaders });
    }

    if (recipientUserIds.size > 500) {
      return new Response(JSON.stringify({ error: 'Max 500 recipients per thread' }), { status: 400, headers: corsHeaders });
    }

    // Create thread
    const { data: thread, error: threadErr } = await supabase
      .from('ops_inbox_threads')
      .insert({
        type,
        title,
        priority,
        entity_type: entity_type || null,
        entity_id: entity_id || null,
        created_by: user.id,
        targeting: tgt,
        metadata: metadata || {},
      })
      .select()
      .single();

    if (threadErr) throw threadErr;

    // Create initial message
    const { error: msgErr } = await supabase
      .from('ops_inbox_messages')
      .insert({
        thread_id: thread.id,
        sender_user_id: user.id,
        sender_type: 'admin',
        body: message_body,
      });

    if (msgErr) throw msgErr;

    // Create recipient rows
    const recipientRows = Array.from(recipientUserIds).map(uid => ({
      thread_id: thread.id,
      user_id: uid,
    }));

    const { error: recipErr } = await supabase
      .from('ops_inbox_recipients')
      .insert(recipientRows);

    if (recipErr) throw recipErr;

    // Audit
    await supabase.from('ops_inbox_events').insert({
      event_type: 'created',
      actor_id: user.id,
      thread_id: thread.id,
      metadata: { recipient_count: recipientUserIds.size, targeting: tgt },
    });

    return new Response(JSON.stringify({ thread_id: thread.id, recipients: recipientUserIds.size }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
