/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CANONICAL INVOICE LINE MATH — single source of truth for unit conversion
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Every invoice write path in the OS must build its lines through these
 * helpers. Four sellable units are supported:
 *
 *   full_box    — one full box            (quantity_boxes = qty)
 *   half_box    — half of a box           (quantity_boxes = qty * 0.5)
 *   pack        — configured pack tier    (pack_size tubes per pack)
 *   loose_tube  — a single tube / bag     (1:1 canonical)
 *
 * Canonical tube math is ALWAYS derived here — never inline in a component.
 * Pack-aware boxes use packs_per_box × pack_size; legacy products fall back
 * to units_per_box.
 */

export type SaleChannel = 'retail' | 'wholesale' | 'street';
export type SaleUnitKind = 'full_box' | 'half_box' | 'pack' | 'loose_tube';
export type DbSaleUnit = 'box' | 'unit' | 'pack';
export type DiscountType = 'none' | 'percent' | 'amount';

export interface BuilderBrand {
  id: string;
  name: string;
  color?: string | null;
}

export interface BuilderProduct {
  id: string;
  name: string;
  sku?: string | null;
  store_price?: number | null;
  wholesale_price?: number | null;
  suggested_retail_price?: number | null;
  street_price?: number | null;
  cost?: number | null;
  units_per_box?: number | null;
  unit_type?: string | null;
  track_by?: string | null;
  sale_unit_default?: string | null;
  price_per_box?: number | null;
  price_per_unit?: number | null;
  price_per_tube?: number | null;
  pack_size?: number | null;
  packs_per_box?: number | null;
}

export interface BuilderLine {
  id: string;
  /** true when this line already exists in invoice_line_items (edit path) */
  persisted?: boolean;

  brand_id: string;
  brand_name: string;
  product_id: string;
  product_name: string;

  /** quantity expressed in the chosen unit kind */
  quantity: number;
  unit_kind: SaleUnitKind;
  /** value written to invoice_line_items.sale_unit */
  sale_unit: DbSaleUnit;
  sale_channel: SaleChannel;

  list_unit_price: number;
  unit_price: number;
  unit_price_used: number;
  discount_type: DiscountType;
  discount_value: number;
  discount_reason: string;
  price_override_reason: string;

  line_subtotal: number;
  total: number;

  cost_per_unit: number;
  profit: number;

  units_per_box: number;
  pack_size_snapshot: number;
  packs_per_box_snapshot: number | null;
  price_per_box_snapshot: number;
  price_per_tube_snapshot: number;

  quantity_boxes: number | null;
  quantity_tubes: number | null;
  computed_tubes_total: number;

  track_by: string;
}

export const UNIT_KIND_LABELS: Record<SaleUnitKind, string> = {
  full_box: 'Full Box',
  half_box: 'Half Box',
  pack: 'Pack',
  loose_tube: 'Loose Tube',
};

export const UNIT_KIND_ICONS: Record<SaleUnitKind, string> = {
  full_box: '📦',
  half_box: '🧰',
  pack: '🎴',
  loose_tube: '🧪',
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Tubes (or bags) contained in one full box, pack-aware. */
export function tubesPerBox(product: BuilderProduct): number {
  const packSize = product.pack_size || 1;
  const packsPerBox = product.packs_per_box || null;
  if (packsPerBox && packSize > 1) return packsPerBox * packSize;
  return product.units_per_box || 1;
}

/** Channel-aware headline price for a product. */
export function priceForChannel(product: BuilderProduct, channel: SaleChannel): number {
  switch (channel) {
    case 'street':
      return product.street_price || product.suggested_retail_price || 0;
    case 'wholesale':
      return product.wholesale_price || 0;
    case 'retail':
    default:
      return product.suggested_retail_price || product.store_price || 0;
  }
}

export function boxPrice(product: BuilderProduct, channel: SaleChannel): number {
  if (channel === 'wholesale') {
    return product.wholesale_price ?? product.price_per_box ?? priceForChannel(product, channel);
  }
  return product.price_per_box ?? product.store_price ?? priceForChannel(product, channel);
}

export function tubePrice(product: BuilderProduct, channel: SaleChannel): number {
  const explicit = product.price_per_tube ?? product.price_per_unit;
  if (explicit != null && explicit > 0) return explicit;
  const ppb = boxPrice(product, channel);
  const upb = tubesPerBox(product);
  return upb > 0 && ppb > 0 ? round2(ppb / upb) : priceForChannel(product, channel);
}

/** List price for one unit of the given kind. */
export function listPriceForUnit(
  product: BuilderProduct,
  channel: SaleChannel,
  kind: SaleUnitKind,
): number {
  const ppb = boxPrice(product, channel);
  const ppt = tubePrice(product, channel);
  const packSize = product.pack_size || 1;
  switch (kind) {
    case 'full_box':
      return round2(ppb);
    case 'half_box':
      return round2(ppb / 2);
    case 'pack':
      return round2(ppt * packSize);
    case 'loose_tube':
    default:
      return round2(ppt);
  }
}

/**
 * Half box is only sellable when the box splits into a whole number of tubes.
 * Returns a human message naming the product when it is blocked, else null.
 */
export function halfBoxBlockReason(product: BuilderProduct): string | null {
  const upb = tubesPerBox(product);
  if (!upb || upb <= 1) {
    return `${product.name} has no box size configured — half box unavailable. Set units per box first.`;
  }
  if (upb % 2 !== 0) {
    return `${product.name} has an odd box size (${upb}) — half box would split a tube. Fix units per box first.`;
  }
  return null;
}

/** Which units this product can actually be sold in. */
export function availableUnitKinds(product: BuilderProduct): SaleUnitKind[] {
  const kinds: SaleUnitKind[] = [];
  const upb = tubesPerBox(product);
  if (upb > 1) {
    kinds.push('full_box');
    if (!halfBoxBlockReason(product)) kinds.push('half_box');
  }
  if ((product.pack_size || 1) > 1) kinds.push('pack');
  kinds.push('loose_tube');
  return kinds;
}

export function dbSaleUnit(kind: SaleUnitKind): DbSaleUnit {
  if (kind === 'pack') return 'pack';
  if (kind === 'loose_tube') return 'unit';
  return 'box';
}

interface CanonicalUnits {
  quantity_boxes: number | null;
  quantity_tubes: number | null;
  computed_tubes_total: number;
}

/** Canonical tube/box breakdown for a quantity of the given unit kind. */
export function canonicalUnits(
  product: Pick<BuilderProduct, 'units_per_box' | 'pack_size' | 'packs_per_box'>,
  kind: SaleUnitKind,
  quantity: number,
): CanonicalUnits {
  const packSize = product.pack_size || 1;
  const perBox = tubesPerBox(product as BuilderProduct);

  switch (kind) {
    case 'full_box':
      return {
        quantity_boxes: quantity,
        quantity_tubes: null,
        computed_tubes_total: Math.round(quantity * perBox),
      };
    case 'half_box':
      return {
        quantity_boxes: quantity * 0.5,
        quantity_tubes: null,
        computed_tubes_total: Math.round(quantity * 0.5 * perBox),
      };
    case 'pack':
      return {
        quantity_boxes: null,
        quantity_tubes: Math.round(quantity * packSize),
        computed_tubes_total: Math.round(quantity * packSize),
      };
    case 'loose_tube':
    default:
      return {
        quantity_boxes: null,
        quantity_tubes: Math.round(quantity),
        computed_tubes_total: Math.round(quantity),
      };
  }
}

/** Build a fresh line from a product selection. */
export function buildLine(params: {
  brand: BuilderBrand;
  product: BuilderProduct;
  channel: SaleChannel;
  kind: SaleUnitKind;
  quantity: number;
}): BuilderLine {
  const { brand, product, channel, kind, quantity } = params;
  const listUnitPrice = listPriceForUnit(product, channel, kind);
  const units = canonicalUnits(product, kind, quantity);
  const costPerUnit = product.cost || 0;
  const subtotal = round2(listUnitPrice * quantity);

  return {
    id: crypto.randomUUID(),
    persisted: false,
    brand_id: brand.id,
    brand_name: brand.name,
    product_id: product.id,
    product_name: product.name,
    quantity,
    unit_kind: kind,
    sale_unit: dbSaleUnit(kind),
    sale_channel: channel,
    list_unit_price: listUnitPrice,
    unit_price: listUnitPrice,
    unit_price_used: listUnitPrice,
    discount_type: 'none',
    discount_value: 0,
    discount_reason: '',
    price_override_reason: '',
    line_subtotal: subtotal,
    total: subtotal,
    cost_per_unit: costPerUnit,
    profit: round2((listUnitPrice - costPerUnit) * quantity),
    units_per_box: product.units_per_box || 1,
    pack_size_snapshot: product.pack_size || 1,
    packs_per_box_snapshot: product.packs_per_box ?? null,
    price_per_box_snapshot: round2(boxPrice(product, channel)),
    price_per_tube_snapshot: round2(tubePrice(product, channel)),
    ...units,
    track_by: product.track_by || 'tubes',
  };
}

/** Recompute a line after its quantity changed. */
export function withQuantity(line: BuilderLine, quantity: number): BuilderLine {
  const units = canonicalUnits(
    {
      units_per_box: line.units_per_box,
      pack_size: line.pack_size_snapshot,
      packs_per_box: line.packs_per_box_snapshot,
    },
    line.unit_kind,
    quantity,
  );
  const subtotal = round2(line.unit_price_used * quantity);
  return {
    ...line,
    quantity,
    line_subtotal: subtotal,
    total: subtotal,
    profit: round2((line.unit_price_used - line.cost_per_unit) * quantity),
    ...units,
  };
}

/** Recompute a line after a manual unit-price override. */
export function withPrice(line: BuilderLine, price: number): BuilderLine {
  const subtotal = round2(price * line.quantity);
  return {
    ...line,
    unit_price: price,
    unit_price_used: price,
    line_subtotal: subtotal,
    total: subtotal,
    profit: round2((price - line.cost_per_unit) * line.quantity),
    price_override_reason:
      price !== line.list_unit_price ? line.price_override_reason || '' : '',
  };
}

/** Recompute a line after a discount change. */
export function withDiscount(
  line: BuilderLine,
  discountType: DiscountType,
  discountValue: number,
  reason: string,
): BuilderLine {
  let finalPrice = line.list_unit_price;
  if (discountType === 'percent') {
    finalPrice = round2(line.list_unit_price * (1 - discountValue / 100));
  } else if (discountType === 'amount') {
    finalPrice = Math.max(round2(line.list_unit_price - discountValue), 0);
  }
  const subtotal = round2(finalPrice * line.quantity);
  return {
    ...line,
    discount_type: discountType,
    discount_value: discountValue,
    discount_reason: reason,
    unit_price: finalPrice,
    unit_price_used: finalPrice,
    line_subtotal: subtotal,
    total: subtotal,
    profit: round2((finalPrice - line.cost_per_unit) * line.quantity),
  };
}

/** Switch a line to a different sellable unit, re-pricing off list. */
export function withUnitKind(line: BuilderLine, kind: SaleUnitKind): BuilderLine {
  const pseudoProduct: BuilderProduct = {
    id: line.product_id,
    name: line.product_name,
    units_per_box: line.units_per_box,
    pack_size: line.pack_size_snapshot,
    packs_per_box: line.packs_per_box_snapshot,
    price_per_box: line.price_per_box_snapshot,
    price_per_tube: line.price_per_tube_snapshot,
  };
  const listUnitPrice = listPriceForUnit(pseudoProduct, line.sale_channel, kind);
  const units = canonicalUnits(pseudoProduct, kind, line.quantity);
  const subtotal = round2(listUnitPrice * line.quantity);
  return {
    ...line,
    unit_kind: kind,
    sale_unit: dbSaleUnit(kind),
    list_unit_price: listUnitPrice,
    unit_price: listUnitPrice,
    unit_price_used: listUnitPrice,
    discount_type: 'none',
    discount_value: 0,
    line_subtotal: subtotal,
    total: subtotal,
    profit: round2((listUnitPrice - line.cost_per_unit) * line.quantity),
    ...units,
  };
}

export interface BuilderTotals {
  subtotal: number;
  totalTubes: number;
  totalBoxes: number;
  totalProfit: number;
  lineCount: number;
}

export function summarize(lines: BuilderLine[]): BuilderTotals {
  return {
    subtotal: round2(lines.reduce((s, l) => s + l.line_subtotal, 0)),
    totalTubes: lines.reduce((s, l) => s + (l.computed_tubes_total || 0), 0),
    totalBoxes: round2(lines.reduce((s, l) => s + (l.quantity_boxes || 0), 0)),
    totalProfit: round2(lines.reduce((s, l) => s + (l.profit || 0), 0)),
    lineCount: lines.length,
  };
}

/** Map a builder line to an invoice_line_items row. */
export function toLineItemRow(
  line: BuilderLine,
  invoiceId: string,
  opts: { pricingMode?: SaleChannel; lineSource?: string } = {},
) {
  return {
    invoice_id: invoiceId,
    brand_id: line.brand_id,
    brand: line.brand_name,
    brand_name: line.brand_name,
    product_id: line.product_id,
    product_name: line.product_name,
    product_name_snapshot: line.product_name,
    brand_name_snapshot: line.brand_name,
    quantity: line.quantity,
    unit_price: line.unit_price_used,
    total: line.line_subtotal,
    sale_channel: line.sale_channel,
    sale_unit: line.sale_unit,
    unit_kind: line.unit_kind,
    cost_per_unit_at_sale: line.cost_per_unit,
    profit_at_sale: line.profit,
    units_per_box_snapshot: line.units_per_box,
    quantity_boxes: line.quantity_boxes,
    quantity_tubes: line.quantity_tubes,
    computed_tubes_total: line.computed_tubes_total,
    list_unit_price: line.list_unit_price,
    unit_price_used: line.unit_price_used,
    discount_type: line.discount_type,
    discount_value: line.discount_value,
    discount_reason: line.discount_reason || null,
    price_override_reason: line.price_override_reason || null,
    line_subtotal: line.line_subtotal,
    pack_size_snapshot: line.pack_size_snapshot,
    packs_per_box_snapshot: line.packs_per_box_snapshot,
    price_per_box_snapshot: line.price_per_box_snapshot,
    price_per_tube_snapshot: line.price_per_tube_snapshot,
    pricing_mode: opts.pricingMode ?? line.sale_channel,
    line_source: opts.lineSource ?? 'manual_entry',
  };
}

/** Rehydrate a persisted invoice_line_items row back into a builder line. */
export function fromLineItemRow(row: any): BuilderLine {
  const kind: SaleUnitKind =
    (row.unit_kind as SaleUnitKind) ||
    (row.sale_unit === 'pack'
      ? 'pack'
      : row.sale_unit === 'unit'
        ? 'loose_tube'
        : row.quantity_boxes != null && Number(row.quantity_boxes) === Number(row.quantity) * 0.5
          ? 'half_box'
          : 'full_box');

  const quantity = Number(row.quantity) || 0;
  const unitPrice = Number(row.unit_price_used ?? row.unit_price) || 0;
  const subtotal = Number(row.line_subtotal ?? row.total) || round2(unitPrice * quantity);

  return {
    id: row.id,
    persisted: true,
    brand_id: row.brand_id,
    brand_name: row.brand_name ?? row.brand ?? '',
    product_id: row.product_id,
    product_name: row.product_name ?? row.product_name_snapshot ?? '',
    quantity,
    unit_kind: kind,
    sale_unit: (row.sale_unit as DbSaleUnit) || dbSaleUnit(kind),
    sale_channel: (row.sale_channel as SaleChannel) || 'retail',
    list_unit_price: Number(row.list_unit_price ?? unitPrice) || 0,
    unit_price: unitPrice,
    unit_price_used: unitPrice,
    discount_type: (row.discount_type as DiscountType) || 'none',
    discount_value: Number(row.discount_value) || 0,
    discount_reason: row.discount_reason || '',
    price_override_reason: row.price_override_reason || '',
    line_subtotal: subtotal,
    total: subtotal,
    cost_per_unit: Number(row.cost_per_unit_at_sale) || 0,
    profit: Number(row.profit_at_sale) || 0,
    units_per_box: Number(row.units_per_box_snapshot) || 1,
    pack_size_snapshot: Number(row.pack_size_snapshot) || 1,
    packs_per_box_snapshot: row.packs_per_box_snapshot ?? null,
    price_per_box_snapshot: Number(row.price_per_box_snapshot) || 0,
    price_per_tube_snapshot: Number(row.price_per_tube_snapshot) || 0,
    quantity_boxes: row.quantity_boxes ?? null,
    quantity_tubes: row.quantity_tubes ?? null,
    computed_tubes_total: Number(row.computed_tubes_total) || 0,
    track_by: 'tubes',
  };
}
