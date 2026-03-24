import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured')

    const { image_base64, media_type } = await req.json()
    if (!image_base64) throw new Error('No image provided')

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${media_type || 'image/png'};base64,${image_base64}`,
                },
              },
              {
                type: 'text',
                text: `You are analyzing a PrizePicks screenshot. Extract every player prop shown.

For each prop return a JSON array with this exact structure:
[
  {
    "player_name": "Full player name exactly as shown",
    "team": "Team abbreviation if visible, e.g. LAL, NYK",
    "prop_type": "points|rebounds|assists|threes|blocks|steals|pts_reb_ast|pts_reb|pts_ast|reb_ast|fantasy_points|turnovers|minutes",
    "line": 24.5,
    "game": "Away @ Home if visible",
    "position": "position if shown or null"
  }
]

PrizePicks always uses -122 odds equivalent (no juice displayed).
Return ONLY a valid JSON array. No explanation. No markdown code fences. Just the raw JSON array.
If you cannot read a value clearly set it to null.
Make sure line is always a number, not a string.`,
              },
            ],
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_prizepicks_props',
              description: 'Extract player props from a PrizePicks screenshot',
              parameters: {
                type: 'object',
                properties: {
                  props: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        player_name: { type: 'string' },
                        team: { type: 'string' },
                        prop_type: { type: 'string' },
                        line: { type: 'number' },
                        game: { type: 'string' },
                        position: { type: 'string' },
                      },
                      required: ['player_name', 'prop_type', 'line'],
                    },
                  },
                },
                required: ['props'],
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'extract_prizepicks_props' } },
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('AI gateway error:', response.status, errText)
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limited — try again in a moment' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted — add funds in Settings > Workspace > Usage' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      throw new Error(`AI gateway returned ${response.status}`)
    }

    const aiData = await response.json()

    // Try tool call first, fall back to content parsing
    let props: any[] = []

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0]
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments)
        props = parsed.props || parsed
      } catch {
        console.error('Failed to parse tool call args')
      }
    }

    // Fallback: parse from content
    if (!props.length) {
      const content = aiData.choices?.[0]?.message?.content || ''
      try {
        const cleaned = content.replace(/```json|```/g, '').trim()
        const parsed = JSON.parse(cleaned)
        props = Array.isArray(parsed) ? parsed : parsed.props || []
      } catch {
        console.error('Failed to parse content as JSON')
      }
    }

    // Normalize props
    props = props.map((p: any) => ({
      player_name: p.player_name || 'Unknown',
      team: p.team || null,
      prop_type: (p.prop_type || 'points').toLowerCase(),
      line: typeof p.line === 'number' ? p.line : parseFloat(p.line) || 0,
      game: p.game || null,
      position: p.position || null,
      sportsbook: 'prizepicks',
      over_odds: -122,
      under_odds: -122,
    }))

    console.log(`Extracted ${props.length} props from PrizePicks image`)

    return new Response(JSON.stringify({ props, count: props.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    console.error('sbo-analyze-prizepicks error:', e)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
