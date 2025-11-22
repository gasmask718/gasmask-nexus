import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CallProcessingRequest {
  call_id: string;
  audio_url?: string;
  transcript?: string;
  caller_id: string;
  phone_number_id: string;
  direction: 'inbound' | 'outbound';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { call_id, audio_url, transcript, caller_id, phone_number_id, direction }: CallProcessingRequest = await req.json();

    // Get phone number and AI agent details
    const { data: phoneNumber } = await supabase
      .from('call_center_phone_numbers')
      .select('*, call_center_ai_agents(*)')
      .eq('id', phone_number_id)
      .single();

    if (!phoneNumber) {
      throw new Error('Phone number not found');
    }

    let callTranscript = transcript;
    let summary = '';
    let tags: string[] = [];
    let emotionDetected = 'neutral';
    let sentimentScore = 50;
    let autoTasks: any[] = [];

    // If we have a transcript, process it with AI
    if (callTranscript && callTranscript.length > 10) {
      const aiPrompt = `Analyze this phone call transcript and provide:
1. A brief summary (2-3 sentences)
2. Detected emotion (angry, upset, excited, confused, happy, neutral)
3. Sentiment score (0-100)
4. Relevant tags (sales, complaint, negotiation, contract, upset_customer, good_lead, follow_up_needed)
5. Recommended follow-up actions

Transcript:
${callTranscript}

Response in JSON format:
{
  "summary": "...",
  "emotion": "...",
  "sentimentScore": 0-100,
  "tags": ["tag1", "tag2"],
  "followUpActions": ["action1", "action2"]
}`;

      const aiResponse = await fetch('https://api.lovable.app/v1/inference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${lovableApiKey}`,
        },
        body: JSON.stringify({
          model: 'openai/gpt-5-mini',
          messages: [{
            role: 'user',
            content: aiPrompt
          }],
          response_format: { type: 'json_object' }
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        const analysis = JSON.parse(aiData.choices[0].message.content);
        
        summary = analysis.summary || '';
        emotionDetected = analysis.emotion || 'neutral';
        sentimentScore = analysis.sentimentScore || 50;
        tags = analysis.tags || [];

        // Create auto-tasks based on follow-up actions
        if (analysis.followUpActions && analysis.followUpActions.length > 0) {
          for (const action of analysis.followUpActions) {
            autoTasks.push({
              call_log_id: call_id,
              task_type: 'follow_up',
              title: action,
              description: `Generated from call with ${caller_id}`,
              business_name: phoneNumber.business_name,
              created_by_ai: true,
              status: 'pending'
            });
          }
        }
      }
    }

    // Check for red flag keywords
    const redFlagKeywords = [
      'lawyer', 'attorney', 'legal', 'sue', 'lawsuit',
      'refund', 'chargeback', 'fraud', 'scam',
      'complaint', 'report', 'bbb', 'ftc',
      'urgent', 'emergency', 'dangerous', 'unsafe'
    ];

    const detectedRedFlags: string[] = [];
    if (callTranscript) {
      const lowerTranscript = callTranscript.toLowerCase();
      for (const keyword of redFlagKeywords) {
        if (lowerTranscript.includes(keyword)) {
          detectedRedFlags.push(keyword);
        }
      }
    }

    // Create red flag alert if needed
    if (detectedRedFlags.length > 0) {
      await supabase.from('call_center_alerts').insert({
        call_log_id: call_id,
        alert_type: 'red_flag_keywords',
        severity: 'high',
        description: `Red flag keywords detected in call: ${detectedRedFlags.join(', ')}`,
        keywords_detected: detectedRedFlags
      });
    }

    // Update call log with analysis
    await supabase
      .from('call_center_logs')
      .update({
        transcript: callTranscript,
        summary,
        tags,
        emotion_detected: emotionDetected,
        sentiment_score: sentimentScore
      })
      .eq('id', call_id);

    // Insert auto-generated tasks
    if (autoTasks.length > 0) {
      await supabase.from('call_center_tasks').insert(autoTasks);
    }

    // Update analytics
    const today = new Date().toISOString().split('T')[0];
    await supabase.rpc('update_call_analytics', {
      p_business_name: phoneNumber.business_name,
      p_date: today,
      p_increment_calls: 1,
      p_increment_answered: 1
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        summary,
        emotion: emotionDetected,
        sentimentScore,
        tags,
        tasks_created: autoTasks.length,
        red_flags: detectedRedFlags.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Call Center AI Processor Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});