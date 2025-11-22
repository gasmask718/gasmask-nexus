import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🤖 Starting AI Communication Analysis...');

    // Fetch communication logs from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: commLogs, error: logsError } = await supabase
      .from('communication_logs')
      .select(`
        *,
        crm_contacts(id, name, type),
        stores(id, name),
        profiles!communication_logs_driver_id_fkey(id, name),
        influencers(id, name),
        wholesale_hubs(id, name)
      `)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (logsError) throw logsError;

    console.log(`📊 Analyzing ${commLogs?.length || 0} communication logs`);

    // Group communications by entity
    const entityMap = new Map();

    for (const log of commLogs || []) {
      let entityId: string | null = null;
      let entityType: string | null = null;
      let entityName = 'Unknown';

      if (log.contact_id) {
        entityId = log.contact_id;
        entityType = 'contact';
        entityName = log.crm_contacts?.name || 'Contact';
      } else if (log.store_id) {
        entityId = log.store_id;
        entityType = 'store';
        entityName = log.stores?.name || 'Store';
      } else if (log.driver_id) {
        entityId = log.driver_id;
        entityType = 'driver';
        entityName = log.profiles?.name || 'Driver';
      } else if (log.influencer_id) {
        entityId = log.influencer_id;
        entityType = 'influencer';
        entityName = log.influencers?.name || 'Influencer';
      } else if (log.wholesaler_id) {
        entityId = log.wholesaler_id;
        entityType = 'wholesaler';
        entityName = log.wholesale_hubs?.name || 'Wholesaler';
      }

      if (entityId && entityType) {
        if (!entityMap.has(entityId)) {
          entityMap.set(entityId, {
            entityId,
            entityType,
            entityName,
            logs: [],
          });
        }
        entityMap.get(entityId).logs.push(log);
      }
    }

    console.log(`🔍 Analyzing ${entityMap.size} unique entities`);

    const insights: any[] = [];
    const priorityQueue: any[] = [];
    const criticalAlerts: any[] = [];
    let totalPositive = 0;
    let totalNegative = 0;
    let totalNeutral = 0;

    // Analyze each entity with AI
    for (const [entityId, entityData] of entityMap) {
      const { entityType, entityName, logs } = entityData;

      // Build context for AI
      const recentLogs = logs.slice(0, 10);
      const logsText = recentLogs
        .map((l: any) => `${l.channel} (${l.direction}): ${l.summary}`)
        .join('\n');

      const daysSinceLastContact = logs.length > 0 
        ? Math.floor((Date.now() - new Date(logs[0].created_at).getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      // Call Lovable AI for analysis
      try {
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: `You are an AI communication analyst for GasMask OS. Analyze communication patterns and provide insights.`
              },
              {
                role: 'user',
                content: `Analyze this ${entityType} named "${entityName}":

Days since last contact: ${daysSinceLastContact}
Total communications (30 days): ${logs.length}
Recent communications:
${logsText}

Provide JSON response with:
{
  "sentiment": "positive|neutral|negative|mixed",
  "relationshipScore": 0-100,
  "urgency": 0-100,
  "keywords": ["keyword1", "keyword2"],
  "summary": "Brief 2-sentence summary",
  "nextAction": "Specific recommendation",
  "reason": "Why this needs attention"
}`
              }
            ],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices[0]?.message?.content || '{}';
          
          // Extract JSON from markdown code blocks if present
          let jsonContent = content;
          if (content.includes('```json')) {
            jsonContent = content.split('```json')[1].split('```')[0].trim();
          } else if (content.includes('```')) {
            jsonContent = content.split('```')[1].split('```')[0].trim();
          }
          
          const analysis = JSON.parse(jsonContent);

          // Update crm_contacts if it's a contact
          if (entityType === 'contact') {
            await supabase
              .from('crm_contacts')
              .update({
                relationship_score: analysis.relationshipScore,
                ai_keywords: analysis.keywords,
                ai_sentiment: analysis.sentiment,
                ai_last_summary: analysis.summary,
                ai_next_action: analysis.nextAction,
                ai_priority: analysis.urgency,
              })
              .eq('id', entityId);
          }

          // Track sentiment stats
          if (analysis.sentiment === 'positive') totalPositive++;
          else if (analysis.sentiment === 'negative') totalNegative++;
          else totalNeutral++;

          // Add to priority queue if urgency > 50
          if (analysis.urgency > 50) {
            const queueItem = {
              entity_type: entityType,
              entity_id: entityId,
              reason: analysis.reason,
              suggested_action: analysis.nextAction,
              urgency: analysis.urgency,
            };

            await supabase
              .from('ai_communication_queue')
              .insert(queueItem);

            priorityQueue.push({
              ...queueItem,
              entityName,
              daysSinceLastContact,
            });
          }

          // Critical alerts if urgency > 80 or negative sentiment + high urgency
          if (analysis.urgency > 80 || (analysis.sentiment === 'negative' && analysis.urgency > 60)) {
            criticalAlerts.push({
              entityType,
              entityName,
              reason: analysis.reason,
              urgency: analysis.urgency,
            });
          }

          insights.push({
            entityType,
            entityName,
            ...analysis,
            totalCommunications: logs.length,
            daysSinceLastContact,
          });
        }
      } catch (aiError) {
        console.error(`AI analysis failed for ${entityName}:`, aiError);
        // Continue with next entity
      }
    }

    const communicationStats = {
      totalEntities: entityMap.size,
      totalCommunications: commLogs?.length || 0,
      sentimentBreakdown: {
        positive: totalPositive,
        negative: totalNegative,
        neutral: totalNeutral,
      },
      priorityQueueSize: priorityQueue.length,
      criticalAlerts: criticalAlerts.length,
    };

    console.log('✅ AI Analysis Complete');
    console.log(`📊 Stats:`, communicationStats);

    return new Response(
      JSON.stringify({
        success: true,
        insights,
        priorityQueue,
        criticalAlerts,
        communicationStats,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('❌ AI Communication Analyzer Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});