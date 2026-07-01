// Fetch a voicemail drop template's transcript for Bland voicemail injection.
// Returns null (never throws) if template is missing, inactive, or lacks a
// transcript. Callers should spread the result into the /v1/calls payload:
//
//   const vmTranscript = await fetchVoicemailTranscript(supabase, body.voicemail_drop_template_id);
//   const payload = {
//     ...,
//     ...(vmTranscript ? { voicemail: { message: vmTranscript, action: 'leave_message' } } : {}),
//   };
//
// Bland /v1/calls only accepts a TTS `message` string for voicemail (no audio_url),
// so we pull the template.transcript column, not audio_url.
export async function fetchVoicemailTranscript(
  supabase: any,
  templateId: string | null | undefined,
): Promise<string | null> {
  if (!templateId) return null;
  try {
    const { data, error } = await supabase
      .from("dc_voicemail_templates")
      .select("id, transcript, is_active")
      .eq("id", templateId)
      .maybeSingle();
    if (error) {
      console.warn(`[voicemail] template ${templateId} fetch error — falling back to agent prompt voicemail script`, error.message);
      return null;
    }
    if (!data) {
      console.warn(`[voicemail] template ${templateId} not found — falling back to agent prompt voicemail script`);
      return null;
    }
    if (data.is_active === false) {
      console.warn(`[voicemail] template ${templateId} is inactive — falling back to agent prompt voicemail script`);
      return null;
    }
    const t = (data.transcript || "").trim();
    if (!t) {
      console.warn(`[voicemail] template ${templateId} has no transcript — falling back to agent prompt voicemail script`);
      return null;
    }
    return t;
  } catch (e: any) {
    console.warn(`[voicemail] template ${templateId} fetch exception — falling back to agent prompt voicemail script`, e?.message);
    return null;
  }
}
