import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

const AREA_CODE_TO_STATE: Record<string, string> = {
  '201':'NJ','202':'DC','203':'CT','205':'AL','206':'WA','207':'ME','208':'ID','209':'CA',
  '210':'TX','212':'NY','213':'CA','214':'TX','215':'PA','216':'OH','217':'IL','218':'MN',
  '219':'IN','220':'OH','223':'PA','224':'IL','225':'LA','228':'MS','229':'GA','231':'MI',
  '234':'OH','239':'FL','240':'MD','248':'MI','251':'AL','252':'NC','253':'WA','254':'TX',
  '256':'AL','260':'IN','262':'WI','267':'PA','269':'MI','270':'KY','272':'PA','274':'WI',
  '276':'VA','278':'MI','281':'TX','301':'MD','302':'DE','303':'CO','304':'WV','305':'FL',
  '307':'WY','308':'NE','309':'IL','310':'CA','312':'IL','313':'MI','314':'MO','315':'NY',
  '316':'KS','317':'IN','318':'LA','319':'IA','320':'MN','321':'FL','323':'CA','325':'TX',
  '330':'OH','331':'IL','332':'NY','334':'AL','336':'NC','337':'LA','339':'MA','340':'VI',
  '346':'TX','347':'NY','351':'MA','352':'FL','360':'WA','361':'TX','364':'KY','380':'OH',
  '385':'UT','386':'FL','401':'RI','402':'NE','404':'GA','405':'OK','406':'MT','407':'FL',
  '408':'CA','409':'TX','410':'MD','412':'PA','413':'MA','414':'WI','415':'CA','417':'MO',
  '419':'OH','423':'TN','424':'CA','425':'WA','430':'TX','432':'TX','434':'VA','435':'UT',
  '440':'OH','442':'CA','443':'MD','445':'PA','458':'OR','463':'IN','469':'TX','470':'GA',
  '475':'CT','478':'GA','479':'AR','480':'AZ','484':'PA','501':'AR','502':'KY','503':'OR',
  '504':'LA','505':'NM','507':'MN','508':'MA','509':'WA','510':'CA','512':'TX','513':'OH',
  '515':'IA','516':'NY','517':'MI','518':'NY','520':'AZ','530':'CA','531':'NE','534':'WI',
  '539':'OK','540':'VA','541':'OR','551':'NJ','559':'CA','561':'FL','562':'CA','563':'IA',
  '564':'WA','567':'OH','570':'PA','571':'VA','573':'MO','574':'IN','575':'NM','580':'OK',
  '585':'NY','586':'MI','601':'MS','602':'AZ','603':'NH','605':'SD','606':'KY','607':'NY',
  '608':'WI','609':'NJ','610':'PA','612':'MN','614':'OH','615':'TN','616':'MI','617':'MA',
  '618':'IL','619':'CA','620':'KS','623':'AZ','626':'CA','627':'CA','628':'CA','629':'TN',
  '630':'IL','631':'NY','636':'MO','641':'IA','646':'NY','650':'CA','651':'MN','657':'CA',
  '660':'MO','661':'CA','662':'MS','667':'MD','669':'CA','678':'GA','681':'WV','682':'TX',
  '689':'FL','701':'ND','702':'NV','703':'VA','704':'NC','706':'GA','707':'CA','708':'IL',
  '712':'IA','713':'TX','714':'CA','715':'WI','716':'NY','717':'PA','718':'NY','719':'CO',
  '720':'CO','724':'PA','725':'NV','726':'TX','727':'FL','731':'TN','732':'NJ','734':'MI',
  '737':'TX','740':'OH','743':'NC','747':'CA','754':'FL','757':'VA','760':'CA','762':'GA',
  '763':'MN','765':'IN','769':'MS','770':'GA','772':'FL','773':'IL','774':'MA','775':'NV',
  '779':'IL','781':'MA','785':'KS','786':'FL','801':'UT','802':'VT','803':'SC','804':'VA',
  '805':'CA','806':'TX','808':'HI','810':'MI','812':'IN','813':'FL','814':'PA','815':'IL',
  '816':'MO','817':'TX','818':'CA','828':'NC','830':'TX','831':'CA','832':'TX','838':'NY',
  '843':'SC','845':'NY','847':'IL','848':'NJ','850':'FL','854':'SC','856':'NJ','857':'MA',
  '858':'CA','859':'KY','860':'CT','862':'NJ','863':'FL','864':'SC','865':'TN','870':'AR',
  '872':'IL','878':'PA','901':'TN','903':'TX','904':'FL','906':'MI','907':'AK','908':'NJ',
  '909':'CA','910':'NC','912':'GA','913':'KS','914':'NY','915':'TX','916':'CA','917':'NY',
  '918':'OK','919':'NC','920':'WI','925':'CA','928':'AZ','929':'NY','930':'IN','931':'TN',
  '936':'TX','937':'OH','938':'AL','940':'TX','941':'FL','947':'MI','949':'CA','951':'CA',
  '952':'MN','954':'FL','956':'TX','959':'CT','970':'CO','971':'OR','972':'TX','973':'NJ',
  '978':'MA','979':'TX','980':'NC','984':'NC','985':'LA','989':'MI',
};

function getStateFromPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  const areaCode = cleaned.length === 11 ? cleaned.substring(1, 4) : cleaned.substring(0, 3);
  return AREA_CODE_TO_STATE[areaCode] || 'CA';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { action, ...params } = await req.json();

    if (action === 'make-call') {
      const BLAND_API_KEY = Deno.env.get('BLAND_API_KEY');
      if (!BLAND_API_KEY) throw new Error('BLAND_API_KEY not configured');

      const { phoneNumber, businessType, contactName, businessName, queueId } = params;

      // Get state and matching caller ID
      const prospectState = getStateFromPhone(phoneNumber);
      const { data: phoneMatch } = await supabase
        .from('dynasty_phone_numbers')
        .select('phone_number')
        .eq('state', prospectState)
        .eq('is_active', true)
        .limit(1)
        .single();

      const fromNumber = phoneMatch?.phone_number || '+12142394316';

      const pathwayMap: Record<string, string> = {
        brandaro: Deno.env.get('BRANDARO_SALES_AGENT_ID') || 'PLACEHOLDER',
        surplus_funds: Deno.env.get('SF_CLIENT_AGENT_ID') || 'PLACEHOLDER',
        wholesale_re: Deno.env.get('RE_QUALIFIER_AGENT_ID') || 'PLACEHOLDER',
        gasmask: Deno.env.get('DC_SALES_AGENT_ID') || 'PLACEHOLDER',
      };

      const blandRes = await fetch('https://api.bland.ai/v1/calls', {
        method: 'POST',
        headers: { 'Authorization': BLAND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: phoneNumber,
          from: fromNumber,
          pathway_id: pathwayMap[businessType] || pathwayMap.brandaro,
          model: 'base',
          language: 'en',
          wait_for_greeting: true,
          record: true,
          max_duration: 12,
          variables: { name: contactName, business_name: businessName },
          webhook: `${Deno.env.get('SUPABASE_URL')}/functions/v1/dc-bland-webhook`,
        }),
      });

      const blandData = await blandRes.json();
      if (!blandRes.ok) throw new Error(`Bland API error: ${JSON.stringify(blandData)}`);

      // Fetch source tracking from queue record if available
      let sourceTable: string | null = null;
      let sourceLeadId: string | null = null;

      if (queueId) {
        const { data: queueRecord } = await supabase
          .from('dynasty_call_queue')
          .select('source_table, source_lead_id')
          .eq('id', queueId)
          .single();

        if (queueRecord) {
          sourceTable = queueRecord.source_table || null;
          sourceLeadId = queueRecord.source_lead_id || null;
        }

        await supabase.from('dynasty_call_queue').update({
          status: 'calling',
          bland_call_id: blandData.call_id,
          called_at: new Date().toISOString(),
        }).eq('id', queueId);
      }

      // Create call record WITH source tracking
      await supabase.from('dynasty_ai_calls').insert({
        call_id: blandData.call_id,
        business_unit: businessType,
        from_number: fromNumber,
        to_number: phoneNumber,
        contact_name: contactName,
        company_name: businessName,
        direction: 'outbound',
        outcome: 'in_progress',
        source_table: sourceTable,
        source_lead_id: sourceLeadId,
        call_type: 'ai_outbound',
      });

      return new Response(JSON.stringify({ success: true, call_id: blandData.call_id, from: fromNumber, state: prospectState, source_table: sourceTable }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'start-campaign') {
      const BLAND_API_KEY = Deno.env.get('BLAND_API_KEY');
      if (!BLAND_API_KEY) throw new Error('BLAND_API_KEY not configured');

      const { businessType, concurrency = 5 } = params;

      const { data: leads } = await supabase
        .from('dynasty_call_queue')
        .select('*')
        .eq('business_type', businessType)
        .eq('status', 'pending')
        .limit(concurrency);

      if (!leads?.length) {
        return new Response(JSON.stringify({ success: true, message: 'No pending leads', dispatched: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const results = [];
      for (const lead of leads) {
        try {
          const prospectState = getStateFromPhone(lead.phone_number);
          const { data: phoneMatch } = await supabase
            .from('dynasty_phone_numbers')
            .select('phone_number')
            .eq('state', prospectState)
            .eq('is_active', true)
            .limit(1)
            .single();

          const fromNumber = phoneMatch?.phone_number || '+12142394316';

          const pathwayMap: Record<string, string> = {
            brandaro: Deno.env.get('BRANDARO_SALES_AGENT_ID') || 'PLACEHOLDER',
            surplus_funds: Deno.env.get('SF_CLIENT_AGENT_ID') || 'PLACEHOLDER',
            wholesale_re: Deno.env.get('RE_QUALIFIER_AGENT_ID') || 'PLACEHOLDER',
            gasmask: Deno.env.get('DC_SALES_AGENT_ID') || 'PLACEHOLDER',
          };

          const blandRes = await fetch('https://api.bland.ai/v1/calls', {
            method: 'POST',
            headers: { 'Authorization': BLAND_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone_number: lead.phone_number,
              from: fromNumber,
              pathway_id: pathwayMap[lead.business_type] || pathwayMap.brandaro,
              model: 'base',
              language: 'en',
              wait_for_greeting: true,
              record: true,
              max_duration: 12,
              variables: { name: lead.contact_name, business_name: lead.business_name },
              webhook: `${Deno.env.get('SUPABASE_URL')}/functions/v1/dc-bland-webhook`,
            }),
          });

          const blandData = await blandRes.json();

          await supabase.from('dynasty_call_queue').update({
            status: 'calling', bland_call_id: blandData.call_id, called_at: new Date().toISOString(),
          }).eq('id', lead.id);

          await supabase.from('dynasty_ai_calls').insert({
            call_id: blandData.call_id, business_unit: lead.business_type,
            from_number: fromNumber, to_number: lead.phone_number,
            contact_name: lead.contact_name, company_name: lead.business_name,
            direction: 'outbound', outcome: 'in_progress',
            source_table: lead.source_table || null,
            source_lead_id: lead.source_lead_id || null,
            call_type: 'ai_outbound',
          });

          results.push({ id: lead.id, call_id: blandData.call_id, status: 'dispatched' });
        } catch (e) {
          await supabase.from('dynasty_call_queue').update({ status: 'failed' }).eq('id', lead.id);
          results.push({ id: lead.id, status: 'failed', error: e.message });
        }
      }

      return new Response(JSON.stringify({ success: true, dispatched: results.filter(r => r.status === 'dispatched').length, results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get-state') {
      const state = getStateFromPhone(params.phoneNumber);
      return new Response(JSON.stringify({ state }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
