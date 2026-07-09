/**
 * dd-process-image
 *
 * Enhances a product image: strips background via Remove.bg, uploads to
 * Cloudinary for CDN + WebP transform, generates thumbnail/medium/full
 * variants, and writes URLs back to products_all.
 *
 * Body: { product_id: uuid, image_base64: string, image_type: 'primary'|'secondary'|'lifestyle' }
 *
 * Return contract (always HTTP 200):
 *   success:  { primary_url, thumbnail_url, medium_url, success: true }
 *   demo:     { demo_mode: true, reason }
 *   error:    { error, success: false }
 */
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const RAW_BUCKET = 'dd-products-raw';
const PROCESSED_BUCKET = 'dd-products-processed';
const REMOVE_BG_URL = 'https://api.remove.bg/v1.0/removebg';

function ok(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function decodeBase64(b64: string): Uint8Array {
  const clean = b64.replace(/^data:[^;]+;base64,/, '');
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function sha1Hex(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-1', bytes);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function cloudinaryUpload(params: {
  cloud: string;
  apiKey: string;
  apiSecret: string;
  bytes: Uint8Array;
  publicId: string;
}): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000);
  // Signed upload: signature = sha1(sorted params + api_secret)
  const toSign = `public_id=${params.publicId}&timestamp=${timestamp}${params.apiSecret}`;
  const signature = await sha1Hex(new TextEncoder().encode(toSign));

  const form = new FormData();
  form.append('file', new Blob([params.bytes]));
  form.append('api_key', params.apiKey);
  form.append('timestamp', String(timestamp));
  form.append('public_id', params.publicId);
  form.append('signature', signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${params.cloud}/image/upload`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error(`cloudinary ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.public_id as string;
}

function cloudinaryVariant(cloud: string, publicId: string, width: number): string {
  // 1200 cap, white bg, WebP, auto quality
  const tx = `c_pad,b_white,w_${width},h_${width},f_webp,q_auto`;
  return `https://res.cloudinary.com/${cloud}/image/upload/${tx}/${publicId}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { product_id, image_base64, image_type = 'primary' } = body ?? {};

    if (!product_id) return ok({ error: 'product_id_required', success: false });
    if (!image_base64) return ok({ error: 'image_base64_required', success: false });
    if (!['primary', 'secondary', 'lifestyle'].includes(image_type)) {
      return ok({ error: 'invalid_image_type', success: false });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Read Remove.bg + Cloudinary keys from DB (workaround for Edge Function secret propagation issue)
    const { data: cfg, error: cfgErr } = await supabase
      .from('dd_ai_config')
      .select('remove_bg_api_key, cloudinary_cloud_name, cloudinary_api_key, cloudinary_api_secret')
      .eq('id', 1)
      .maybeSingle();
    if (cfgErr) return ok({ error: `config_lookup: ${cfgErr.message}`, success: false });
    const REMOVE_BG = cfg?.remove_bg_api_key ?? null;
    const CLOUD = cfg?.cloudinary_cloud_name ?? null;
    const CLOUD_KEY = cfg?.cloudinary_api_key ?? null;
    const CLOUD_SECRET = cfg?.cloudinary_api_secret ?? null;

    if (!REMOVE_BG || !CLOUD || !CLOUD_KEY || !CLOUD_SECRET) {
      return ok({
        demo_mode: true,
        reason: 'missing_keys',
        missing: {
          remove_bg: !REMOVE_BG,
          cloudinary: !CLOUD || !CLOUD_KEY || !CLOUD_SECRET,
        },
      });
    }

    const raw = decodeBase64(image_base64);
    const stamp = Date.now();
    const rawPath = `${product_id}/${image_type}_${stamp}.png`;

    // 1) store original in raw bucket
    const { error: rawErr } = await supabase.storage
      .from(RAW_BUCKET)
      .upload(rawPath, raw, { contentType: 'image/png', upsert: true });
    if (rawErr) return ok({ error: `raw_upload: ${rawErr.message}`, success: false });

    // 2) Remove.bg → PNG with alpha
    const rbForm = new FormData();
    rbForm.append('image_file', new Blob([raw]), 'in.png');
    rbForm.append('size', 'auto');
    rbForm.append('format', 'png');
    const rbRes = await fetch(REMOVE_BG_URL, {
      method: 'POST',
      headers: { 'X-Api-Key': REMOVE_BG },
      body: rbForm,
    });
    if (!rbRes.ok) {
      return ok({ error: `remove_bg ${rbRes.status}: ${await rbRes.text()}`, success: false });
    }
    const stripped = new Uint8Array(await rbRes.arrayBuffer());

    // 3) Cloudinary upload (signed)
    const publicId = `dd/${product_id}/${image_type}_${stamp}`;
    const uploadedId = await cloudinaryUpload({
      cloud: CLOUD,
      apiKey: CLOUD_KEY,
      apiSecret: CLOUD_SECRET,
      bytes: stripped,
      publicId,
    });

    // 4) generate 3 size variants via Cloudinary URL transforms
    const thumbnail_url = cloudinaryVariant(CLOUD, uploadedId, 200);
    const medium_url = cloudinaryVariant(CLOUD, uploadedId, 600);
    const primary_url = cloudinaryVariant(CLOUD, uploadedId, 1200);

    // 5) mirror stripped PNG into processed bucket (audit trail)
    const processedPath = `${product_id}/${image_type}_${stamp}.png`;
    await supabase.storage
      .from(PROCESSED_BUCKET)
      .upload(processedPath, stripped, { contentType: 'image/png', upsert: true });

    // 6) update products_all
    const { data: existing } = await supabase
      .from('products_all')
      .select('image_urls, primary_image_url')
      .eq('id', product_id)
      .maybeSingle();

    const merged = Array.isArray(existing?.image_urls) ? [...existing!.image_urls] : [];
    if (!merged.includes(primary_url)) merged.push(primary_url);

    const patch: Record<string, unknown> = {
      image_urls: merged,
      image_enhanced_at: new Date().toISOString(),
    };
    if (image_type === 'primary' || !existing?.primary_image_url) {
      patch.primary_image_url = primary_url;
    }

    const { error: upErr } = await supabase.from('products_all').update(patch).eq('id', product_id);
    if (upErr) return ok({ error: `db_update: ${upErr.message}`, success: false, primary_url, thumbnail_url, medium_url });

    return ok({ primary_url, thumbnail_url, medium_url, success: true });
  } catch (e) {
    return ok({ error: (e as Error).message ?? 'unknown_error', success: false });
  }
});
