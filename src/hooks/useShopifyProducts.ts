import { useQuery } from '@tanstack/react-query';

const SHOPIFY_STORE = 'unforgettable-times-usa.myshopify.com';
const STOREFRONT_TOKEN = 'de4eeeea6a5ba52399cce0466aaf7d49';
const STOREFRONT_API_URL = `https://${SHOPIFY_STORE}/api/2024-01/graphql.json`;

export interface ShopifyProduct {
  id: string;
  title: string;
  description: string;
  handle: string;
  productType: string;
  vendor: string;
  images: { url: string; altText: string | null }[];
  variants: {
    id: string;
    title: string;
    price: string;
    compareAtPrice: string | null;
    available: boolean;
  }[];
  priceRange: {
    minVariantPrice: string;
    maxVariantPrice: string;
  };
  availableForSale: boolean;
  onlineStoreUrl: string | null;
}

const PRODUCTS_QUERY = `
  query GetProducts($first: Int!) {
    products(first: $first) {
      edges {
        node {
          id
          title
          description
          handle
          productType
          vendor
          availableForSale
          onlineStoreUrl
          images(first: 5) {
            edges {
              node {
                url
                altText
              }
            }
          }
          variants(first: 10) {
            edges {
              node {
                id
                title
                priceV2 {
                  amount
                  currencyCode
                }
                compareAtPriceV2 {
                  amount
                  currencyCode
                }
                availableForSale
              }
            }
          }
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
            maxVariantPrice {
              amount
              currencyCode
            }
          }
        }
      }
    }
  }
`;

async function fetchShopifyProducts(limit = 50): Promise<ShopifyProduct[]> {
  const response = await fetch(STOREFRONT_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN,
    },
    body: JSON.stringify({
      query: PRODUCTS_QUERY,
      variables: { first: limit },
    }),
  });

  if (!response.ok) {
    throw new Error(`Shopify API error: ${response.status}`);
  }

  const json = await response.json();

  if (json.errors) {
    throw new Error(json.errors[0]?.message || 'Shopify GraphQL error');
  }

  const edges = json.data?.products?.edges || [];

  return edges.map((edge: any) => {
    const node = edge.node;
    return {
      id: node.id,
      title: node.title,
      description: node.description,
      handle: node.handle,
      productType: node.productType,
      vendor: node.vendor,
      availableForSale: node.availableForSale,
      onlineStoreUrl: node.onlineStoreUrl,
      images: (node.images?.edges || []).map((img: any) => ({
        url: img.node.url,
        altText: img.node.altText,
      })),
      variants: (node.variants?.edges || []).map((v: any) => ({
        id: v.node.id,
        title: v.node.title,
        price: v.node.priceV2.amount,
        compareAtPrice: v.node.compareAtPriceV2?.amount || null,
        available: v.node.availableForSale,
      })),
      priceRange: {
        minVariantPrice: node.priceRange.minVariantPrice.amount,
        maxVariantPrice: node.priceRange.maxVariantPrice.amount,
      },
    } as ShopifyProduct;
  });
}

export function useShopifyProducts(limit = 50) {
  return useQuery({
    queryKey: ['shopify-products', limit],
    queryFn: () => fetchShopifyProducts(limit),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}
