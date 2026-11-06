import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { NoObjectGeneratedError } from "npm:ai";
import { createParser } from "npm:eventsource-parser";
import { z } from "npm:zod";
import { transcribe } from "../_shared/transcribe.ts";
import { createResponsesCall } from "./responses.ts";

const GATEWAY = "https://ai.gateway.lovable.dev";
const TRANSCRIBE_MODEL = "openai/gpt-transcribe";
const CHECK_CARD_MODEL = "openai/gpt-6-astra";
const MAX_AUDIO_BYTES = 24 * 1024 * 1024;

const countBrandIds = ["gasmasktubes", "gasmask", "hotmama", "grabba_r_us", "hotscolatti-light", "hotscolatti-dark", "hotscalatimixpack", "hotscalatibros"] as const;
const countBrandNames: Record<string, string> = {
  gasmasktubes: "GasMask Tubes", gasmask: "GasMask Bags", hotmama: "Hot Mama", grabba_r_us: "Grabba R Us",
  "hotscolatti-light": "Hotscolatti Light", "hotscolatti-dark": "Hotscolatti Dark",
  hotscalatimixpack: "Hotscolatti Mix Pack", hotscalatibros: "Hotscolatti Bros",
};
const brandLabels: Record<string, string> = { gasmask_tubes: "GasMask Tubes", gasmask_bags: "GasMask Bags", hotmama: "Hot Mama", hotscolatti: "Hotscolatti", grabba_r_us: "Grabba R Us" };

const nullableText = z.string().nullable();
const checkCardSchema = z.object({
  store_id: z.string(), store_name: z.string(), store_address: z.string(), summary: z.string(),
  counts: z.array(z.object({ brand_id: z.enum(countBrandIds), brand_name: z.string(), count: z.number().int().nonnegative().nullable(), unit: z.string() })),
  order: z.object({
    requested: z.boolean(),
    items: z.array(z.object({ brand_key: z.enum(["gasmask_tubes", "gasmask_bags", "hotmama", "hotscolatti", "grabba_r_us"]), product_id: nullableText, name: z.string(), quantity: z.number(), store_price: z.number().nullable() })),
    deliver_by: z.enum(["next_visit", "tomorrow", "date"]), deliver_date: nullableText, note: nullableText,
  }),
  contact: z.object({ mentioned: z.boolean(), contact_id: nullableText, name: nullableText, phone: nullableText, role: nullableText, is_new: z.boolean() }),
  leads: z.array(z.object({ name: z.string(), address: z.string(), city: z.string(), state: z.string() })),
  note: nullableText,
  status_change: z.enum(["closed", "no_tobacco", "not_interested"]).nullable(),
  money: z.object({ mentioned: z.boolean(), amount: z.number().nullable(), note: nullableText }),
});
type CheckCard = z.infer<typeof checkCardSchema>;

function json(body: unknown, status = 200, extraHeaders: HeadersInit = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders } });
}
function last10(value: unknown) { return String(value || "").replace(/\D/g, "").slice(-10); }
function safeError(error: unknown) {
  const anyError = error as any;
  const status = Number(anyError?.status || anyError?.statusCode || 500);
  const message = String(anyError?.message || "Voice processing failed").slice(0, 1000);
  return { status: Number.isFinite(status) ? status : 500, message };
}

async function transcriptFromSse(response: Response) {
  if (!response.body) throw new Error("Transcription returned no audio transcript");
  let transcript = "";
  let doneText: string | null = null;
  let streamError: Error | null = null;
  const parser = createParser({
    onEvent(event) {
      try {
        const data = JSON.parse(event.data || "{}");
        if (event.event === "transcript.text.delta") transcript += String(data.delta || "");
        if (event.event === "transcript.text.done") doneText = String(data.text || transcript);
        if (event.event === "error") streamError = new Error(String(data.message || data.error?.message || "Transcription failed"));
      } catch (error) { streamError = error instanceof Error ? error : new Error(String(error)); }
    },
  });
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.feed(decoder.decode(value, { stream: true }));
    if (streamError) throw streamError;
  }
  parser.feed(decoder.decode());
  if (streamError) throw streamError;
  if (doneText === null) throw new Error("Transcription stream ended before the final transcript");
  const text = String(doneText).trim();
  if (!text) throw new Error("No speech was heard. Please record again closer to the microphone.");
  return text;
}

function sanitizeCard(raw: CheckCard, store: any, products: any[], contacts: any[]): CheckCard {
  const productsByBrand: Record<string, any[]> = { gasmask_tubes: [], gasmask_bags: [], hotmama: [], hotscolatti: [], grabba_r_us: [] };
  for (const product of products) {
    const name = String(product.name || "").trim();
    if (/^gasmask tubes$/i.test(name)) productsByBrand.gasmask_tubes.push(product);
    else if (/^gasmask bags$/i.test(name)) productsByBrand.gasmask_bags.push(product);
    else if (/^hot\s?mama/i.test(name)) productsByBrand.hotmama.push(product);
    else if (/^hotscolatti/i.test(name)) productsByBrand.hotscolatti.push(product);
    else if (/^grabba r us$/i.test(name)) productsByBrand.grabba_r_us.push(product);
  }
  const counts = (raw.counts || []).slice(0, 20).flatMap(count => {
    if (!countBrandIds.includes(count.brand_id) || count.count === null || !Number.isInteger(count.count) || count.count < 0 || count.count > 100000) return [];
    return [{ brand_id: count.brand_id, brand_name: countBrandNames[count.brand_id], count: count.count, unit: count.brand_id === "gasmask" ? "bags" : "tubes" }];
  });
  const items = (raw.order?.items || []).slice(0, 10).flatMap(item => {
    const quantity = Number(item.quantity);
    if (!brandLabels[item.brand_key] || !Number.isFinite(quantity) || quantity <= 0 || quantity > 100 || Math.round(quantity * 2) !== quantity * 2) return [];
    const candidates = productsByBrand[item.brand_key];
    const product = candidates.find(p => p.id === item.product_id) || candidates[0];
    return [{ brand_key: item.brand_key, product_id: product?.id || null, name: product?.name || brandLabels[item.brand_key], quantity, store_price: product?.store_price == null ? null : Number(product.store_price) }];
  });
  const matchedContact = contacts.find(c => c.id === raw.contact?.contact_id) || contacts.find(c => last10(c.phone) && last10(c.phone) === last10(raw.contact?.phone));
  const deliverBy = ["next_visit", "tomorrow", "date"].includes(raw.order?.deliver_by) ? raw.order.deliver_by : "next_visit";
  const deliverDate = /^\d{4}-\d{2}-\d{2}$/.test(raw.order?.deliver_date || "") ? raw.order.deliver_date : null;
  return {
    store_id: store.id,
    store_name: store.store_name,
    store_address: [store.address, store.city, store.state, store.zip].filter(Boolean).join(", "),
    summary: String(raw.summary || "Voice update").slice(0, 500),
    counts,
    order: { requested: Boolean(raw.order?.requested && items.length), items, deliver_by: deliverBy, deliver_date: deliverDate, note: raw.order?.note?.slice(0, 1000) || null },
    contact: {
      mentioned: Boolean(raw.contact?.mentioned), contact_id: matchedContact?.id || null,
      name: String(raw.contact?.name || matchedContact?.name || "").slice(0, 150) || null,
      phone: String(raw.contact?.phone || matchedContact?.phone || "").slice(0, 40) || null,
      role: ["owner", "manager", "worker"].includes(raw.contact?.role || "") ? raw.contact.role : "worker",
      is_new: !matchedContact,
    },
    leads: (raw.leads || []).slice(0, 10).map(lead => ({ name: String(lead.name || "").slice(0, 160), address: String(lead.address || "").slice(0, 240), city: String(lead.city || "").slice(0, 100), state: String(lead.state || "").slice(0, 2).toUpperCase() })).filter(lead => lead.name || lead.address),
    note: raw.note?.slice(0, 5000) || null,
    status_change: ["closed", "no_tobacco", "not_interested"].includes(raw.status_change || "") ? raw.status_change : null,
    money: { mentioned: Boolean(raw.money?.mentioned), amount: Number.isFinite(raw.money?.amount) && Number(raw.money?.amount) >= 0 ? Number(raw.money.amount) : null, note: raw.money?.note?.slice(0, 1000) || null },
  };
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ error: "Lovable AI is not configured" }, 401);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authorization = req.headers.get("Authorization") || "";
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return json({ error: "Sign in required" }, 401);
  let noteId = "";
  try {
    const body = await req.json();
    noteId = String(body.noteId || "");
    if (!/^[0-9a-f-]{36}$/i.test(noteId)) return json({ error: "A valid voice note id is required" }, 400);
  } catch { return json({ error: "Invalid request" }, 400); }

  const service = createClient(supabaseUrl, serviceKey);
  const { data: note, error: noteError } = await service.from("store_voice_notes").select("*").eq("id", noteId).single();
  if (noteError || !note) return json({ error: "Voice update not found" }, 404);
  if (note.created_by !== user.id) return json({ error: "Only the person who recorded this update can process it" }, 403);
  const { data: allowed, error: accessError } = await userClient.rpc("store_voice_update_can_access", { p_store_id: note.store_id });
  if (accessError || !allowed) return json({ error: accessError?.message || "You do not have access to this store" }, 403);
  if (note.status === "confirmed") return json({ error: "This voice update is already confirmed" }, 400);

  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();
  const send = async (event: any) => { await writer.write(encoder.encode(`${JSON.stringify(event)}\n`)); };
  let latestRunId: string | undefined;

  const work = (async () => {
    try {
      await service.from("store_voice_notes").update({ status: "transcribing", processing_error: null, updated_at: new Date().toISOString() }).eq("id", noteId);
      await send({ type: "status", message: "Uploading audio for transcription…" });
      const { data: audio, error: audioError } = await service.storage.from("store-voice-notes").download(note.file_url);
      if (audioError || !audio || !audio.size || audio.size > MAX_AUDIO_BYTES) throw Object.assign(new Error(audioError?.message || "Audio is empty or too large"), { status: 400 });
      const file = new File([audio], "store-update.wav", { type: "audio/wav" });
      const transcription = await transcribe({ baseURL: GATEWAY, apiKey, model: TRANSCRIBE_MODEL, maxFileBytes: MAX_AUDIO_BYTES, audioOnly: true }, file, { signal: req.signal });
      latestRunId = transcription.headers.get("X-Lovable-AIG-Run-ID") || undefined;
      if (!transcription.ok) {
        const body = await transcription.text();
        let message = body.slice(0, 1000);
        try { const parsed = JSON.parse(body); message = parsed.message || parsed.error?.message || message; } catch { /* safe response excerpt */ }
        throw Object.assign(new Error(message), { status: transcription.status });
      }
      await send({ type: "status", message: "Transcribing English or Spanish speech…" });
      const transcript = await transcriptFromSse(transcription);
      await service.from("store_voice_notes").update({ transcript, status: "transcribed", updated_at: new Date().toISOString() }).eq("id", noteId);
      await send({ type: "transcript", transcript });
      await send({ type: "status", message: "Building the check card — nothing is saved yet…" });

      const [{ data: store, error: storeError }, { data: products }, { data: contacts }] = await Promise.all([
        service.from("store_master").select("id,store_name,address,city,state,zip").eq("id", note.store_id).single(),
        service.from("products").select("id,name,store_price,price_per_box").eq("is_active", true).or("is_deleted.is.null,is_deleted.eq.false"),
        service.from("store_contacts").select("id,name,phone,role").eq("store_id", note.store_id).is("deleted_at", null),
      ]);
      if (storeError || !store) throw new Error("Store details could not be loaded");
      const instructions = `Turn an ambassador's store-visit transcript into a strict check card. Extract only statements supported by the transcript; never invent facts, geography, quantities, contacts, or statuses. English and Spanish inputs are expected, including noisy store speech. Counts mean physical stock left: GasMask Tubes uses gasmasktubes; GasMask Bags uses gasmask and unit bags; other brands use their listed ids. Orders mean boxes, including half boxes. A payment or money mention is only a red handoff: never create an invoice, payment, or receipt. Status change is allowed only when explicitly and clearly stated. Other-store leads need only what was actually said; leave unknown fields blank. Existing contacts and the active product catalog are provided in the user message. Return every schema property; use null or empty arrays when absent.`;
      const catalog = (products || []).map(p => ({ id: p.id, name: p.name, store_price: p.store_price })).filter(p => /gasmask|hot\s?mama|hotscolatti|grabba r us/i.test(p.name));
      const userMessage = `Store (fixed, do not change): ${JSON.stringify(store)}\nExisting contacts: ${JSON.stringify(contacts || [])}\nActive order catalog: ${JSON.stringify(catalog)}\nTranscript:\n${transcript}`;
      const { result, getRunId } = createResponsesCall(req, { baseURL: GATEWAY, apiKey, model: CHECK_CARD_MODEL }, [{ role: "user", content: userMessage }], instructions, checkCardSchema, latestRunId);
      let output: CheckCard;
      try { output = await result.output as CheckCard; }
      catch (error) {
        if (NoObjectGeneratedError.isInstance(error)) throw Object.assign(new Error("The check card could not be read. Please speak again or correct the recording."), { status: 400 });
        throw error;
      }
      latestRunId = getRunId() || latestRunId;
      const checkCard = sanitizeCard(output, store, products || [], contacts || []);
      const { error: saveError } = await service.from("store_voice_notes").update({ check_card: checkCard, summary: checkCard.summary, status: "ready_for_confirmation", processing_error: null, updated_at: new Date().toISOString() }).eq("id", noteId);
      if (saveError) throw new Error(saveError.message);
      await send({ type: "result", noteId, check_card: checkCard });
    } catch (error) {
      const failure = safeError(error);
      await service.from("store_voice_notes").update({ status: "failed", processing_error: failure.message, updated_at: new Date().toISOString() }).eq("id", noteId);
      await send({ type: "error", status: failure.status, message: failure.message });
    } finally {
      await writer.close();
    }
  })();
  (globalThis as any).EdgeRuntime?.waitUntil?.(work);

  const headers = new Headers({ ...corsHeaders, "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache", "X-Accel-Buffering": "no" });
  if (latestRunId) headers.set("X-Lovable-AIG-Run-ID", latestRunId);
  return new Response(stream.readable, { status: 200, headers });
});
