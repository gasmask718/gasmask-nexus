// Capture a street number into quick_contacts the moment a call or text fires.
// Dedupes per ambassador: the same number captured twice reuses the first row,
// so the Recent list stays clean. Never throws — capture is best-effort and
// must not break the send path it rides on.
export async function captureQuickContact(
  admin: any,
  opts: {
    ambassadorId: string;
    ambassadorName: string | null;
    phone: string;
    firstAction: 'called' | 'texted';
  },
): Promise<string | null> {
  try {
    const digits = String(opts.phone).replace(/\D/g, '');
    if (digits.length < 10) return null;
    const phone10 = digits.slice(-10);

    const { data: existing } = await admin
      .from('quick_contacts')
      .select('id')
      .eq('phone10', phone10)
      .eq('captured_by_ambassador_id', opts.ambassadorId)
      .limit(1)
      .maybeSingle();
    if (existing?.id) return existing.id;

    const { data, error } = await admin
      .from('quick_contacts')
      .insert({
        phone10,
        first_action: opts.firstAction,
        captured_by_ambassador_id: opts.ambassadorId,
        captured_by_name: opts.ambassadorName,
        captured_at: new Date().toISOString(),
        status: 'new',
      })
      .select('id')
      .single();
    if (error) {
      console.error('[quick-contact] capture failed', error);
      return null;
    }
    return data?.id ?? null;
  } catch (e) {
    console.error('[quick-contact] capture threw', e);
    return null;
  }
}
