// owner-voice-tts — synthesize MP3 with ElevenLabs TTS
// POST JSON { text, voiceId? }. Returns audio/mpeg bytes.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const DEFAULT_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb'; // George — calm, executive

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get('ELEVENLABS_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'ELEVENLABS_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { text, voiceId } = await req.json();
    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'text required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // Cap to keep response snappy on mobile
    const safeText = text.slice(0, 2400);
    const vid = voiceId || DEFAULT_VOICE_ID;

    const resp = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${vid}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: safeText,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true, speed: 1.0 },
        }),
      },
    );

    if (!resp.ok) {
      const t = await resp.text();
      console.error('[owner-voice-tts] ElevenLabs error:', resp.status, t);
      return new Response(JSON.stringify({ error: `TTS failed (${resp.status})`, detail: t }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const audio = await resp.arrayBuffer();
    return new Response(audio, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('[owner-voice-tts] fatal:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
