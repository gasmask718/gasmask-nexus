/**
 * ProductJsonLd — schema.org Product structured data.
 *
 * Emits a single <script type="application/ld+json"> block following Google's
 * structured data guidelines for Product markup:
 *   name, image, description, offers { price, priceCurrency, availability, url },
 *   brand (Brand), category.
 * Fields with no real value are omitted rather than guessed — Google penalises
 * fabricated markup that doesn't match visible page content.
 */

export interface ProductJsonLdProps {
  name: string;
  description?: string | null;
  images?: string[] | null;
  price?: number | null;
  currency?: string;
  inventoryQty?: number | null;
  brand?: string | null;
  category?: string | null;
  sku?: string | null;
  url?: string;
}

export function buildProductJsonLd({
  name,
  description,
  images,
  price,
  currency = 'USD',
  inventoryQty,
  brand,
  category,
  sku,
  url,
}: ProductJsonLdProps): Record<string, unknown> {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
  };

  if (description) data.description = description;
  if (images && images.length > 0) data.image = images;
  if (sku) data.sku = sku;
  if (brand) data.brand = { '@type': 'Brand', name: brand };
  if (category) data.category = category;

  if (price !== null && price !== undefined) {
    data.offers = {
      '@type': 'Offer',
      price: Number(price).toFixed(2),
      priceCurrency: currency,
      availability:
        inventoryQty !== null && inventoryQty !== undefined && inventoryQty <= 0
          ? 'https://schema.org/OutOfStock'
          : 'https://schema.org/InStock',
      ...(url ? { url } : {}),
    };
  }

  return data;
}

export default function ProductJsonLd(props: ProductJsonLdProps) {
  const json = JSON.stringify(buildProductJsonLd(props));
  return (
    <script
      type="application/ld+json"
      data-testid="product-jsonld"
      // JSON.stringify output is escaped below to avoid breaking out of the script tag.
      dangerouslySetInnerHTML={{ __html: json.replace(/</g, '\\u003c') }}
    />
  );
}
