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
    const { file_id, cleaned_rows, mapping, target_table, mode = 'append' } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Create import job
    const { data: job, error: jobError } = await supabase
      .from('data_import_jobs')
      .insert({
        file_id,
        status: 'running',
        rows_total: cleaned_rows.length,
      })
      .select()
      .single();

    if (jobError) throw jobError;

    let rows_inserted = 0;
    let rows_failed = 0;
    const errors: any[] = [];

    for (const row of cleaned_rows) {
      try {
        // Transform row according to mapping
        const transformedRow: any = {};
        for (const map of mapping) {
          const value = row[map.source_column];
          if (value !== undefined && value !== null && value !== '') {
            transformedRow[map.destination_field] = value;
          }
        }

        if (mode === 'upsert') {
          // Try to find existing record by name/phone/email
          let matchField = 'name';
          if (transformedRow.phone) matchField = 'phone';
          else if (transformedRow.email) matchField = 'email';

          const { data: existing } = await supabase
            .from(target_table)
            .select('id')
            .eq(matchField, transformedRow[matchField])
            .maybeSingle();

          if (existing) {
            // Update existing
            await supabase
              .from(target_table)
              .update(transformedRow)
              .eq('id', existing.id);
          } else {
            // Insert new
            await supabase.from(target_table).insert(transformedRow);
          }
        } else if (mode === 'update_only') {
          // Update only if exists
          let matchField = 'name';
          if (transformedRow.phone) matchField = 'phone';
          else if (transformedRow.email) matchField = 'email';

          const { data: existing } = await supabase
            .from(target_table)
            .select('id')
            .eq(matchField, transformedRow[matchField])
            .maybeSingle();

          if (existing) {
            await supabase
              .from(target_table)
              .update(transformedRow)
              .eq('id', existing.id);
          } else {
            rows_failed++;
            errors.push({ row: transformedRow, error: 'Record not found for update' });
            continue;
          }
        } else {
          // Append mode - just insert
          await supabase.from(target_table).insert(transformedRow);
        }

        rows_inserted++;
      } catch (err) {
        rows_failed++;
        errors.push({ row, error: err instanceof Error ? err.message : 'Unknown error' });
        console.error('Row insert error:', err);
      }
    }

    // Update job status
    await supabase
      .from('data_import_jobs')
      .update({
        status: rows_failed === 0 ? 'success' : 'failed',
        completed_at: new Date().toISOString(),
        rows_inserted,
        rows_failed,
      })
      .eq('id', job.id);

    // Update file status
    await supabase
      .from('uploaded_files')
      .update({
        status: rows_failed === 0 ? 'completed' : 'failed',
        processed_count: rows_inserted,
        error_count: rows_failed,
        errors: errors.length > 0 ? errors : null,
      })
      .eq('id', file_id);

    return new Response(
      JSON.stringify({
        success: true,
        job_id: job.id,
        rows_inserted,
        rows_failed,
        errors: errors.slice(0, 10), // Return first 10 errors
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error in import-cleaned-data:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
