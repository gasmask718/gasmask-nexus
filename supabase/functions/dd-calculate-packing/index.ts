import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { hydrateItems, loadBoxes, packItems } from '../_shared/ddBoxing.ts';

/**
 * Box selection + billable (dimensional) weight for a set of items.
 *
 * The algorithm itself lives in ../_shared/ddBoxing.ts because the label buyer
 * (dd-create-shipment) and the checkout quote (ddShipping.quoteShipping) must
 * pack identically — otherwise the customer is charged for a different parcel
 * than the one we buy postage for.
 *
 * Dimensions may be omitted per item; they are then read from products_all.
 */
const ItemSchema = z.object({
  product_id: z.string().min(1),
  quantity: z.number().int().positive().max(10000),
  length_in: z.number().positive().max(200).optional(),
  width_in: z.number().positive().max(200).optional(),
  height_in: z.number().positive().max(200).optional(),
  weight_oz: z.number().positive().max(50000).optional(),
  is_fragile: z.boolean().optional(),
  stackable: z.boolean().optional(),
});
const BodySchema = z.object({
  items: z.array(ItemSchema).min(1),
  carrier_preference: z.enum(['any', 'ups', 'fedex', 'usps']).optional(),
  prefer_flat_rate: z.boolean().optional(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return json({ error: 'Invalid packing request', details: parsed.error.flatten().fieldErrors }, 400);
    }
    const { items, carrier_preference = 'any', prefer_flat_rate = false } = parsed.data;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const hydrated = await hydrateItems(supabase, items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })));
    const merged = hydrated.map((h, idx) => {
      const s = items[idx];
      return {
        ...h,
        length_in: s.length_in ?? h.length_in,
        width_in: s.width_in ?? h.width_in,
        height_in: s.height_in ?? h.height_in,
        weight_oz: s.weight_oz ?? h.weight_oz,
        is_fragile: s.is_fragile ?? h.is_fragile,
        stackable: s.stackable ?? h.stackable,
      };
    });

    const boxes = await loadBoxes(supabase, carrier_preference);
    if (boxes.length === 0) return json({ error: 'No active boxes configured in dd_box_sizes' });

    const result = packItems(merged, boxes, { preferFlatRate: prefer_flat_rate });
    for (const [idx, h] of hydrated.entries()) {
      if (h.missing_dimensions && items[idx].length_in == null) {
        result.warnings.push(`Product ${h.product_id} has no weight/dimensions on file — packed on a conservative fallback parcel.`);
      }
    }
    return json(result);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});
