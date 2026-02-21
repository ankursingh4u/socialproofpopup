import { authenticate } from "../shopify.server";
import { getConfig, setConfig } from "../lib/metafields.server";
import type { Activity } from "../lib/metafields.server";

const PLACEHOLDER_IMAGE =
  "https://cdn.shopify.com/shopifycloud/shopify/assets/no-image-2048-5e88c1b20e087fb7bbe9a3771824e743c244f437e4f8ba93bbf7b11b53f7824c.gif";

/**
 * Webhook handler for orders/create
 * DB-free: reads current activities from the shop's metafield, prepends the
 * new order's product(s), and writes the updated list back. No database needed.
 */
export const action = async ({ request }: { request: Request }) => {
  const { shop, admin, payload } = await authenticate.webhook(request);

  // admin is null for compliance webhooks but always present for orders/create
  if (!admin || !payload) {
    return new Response("OK", { status: 200 });
  }

  try {
    // Shopify sends orders/create payloads in REST format
    const order = payload as {
      id: number;
      created_at: string;
      shipping_address?: { city?: string; country?: string } | null;
      line_items: Array<{
        title: string;
        product_id?: number | null;
        properties?: Array<{ name: string; value: string }>;
      }>;
    };

    const city =
      order.shipping_address?.city ||
      order.shipping_address?.country ||
      "Someone";

    // Fetch line item images via Admin GraphQL (REST payload has no image URLs)
    const orderId = `gid://shopify/Order/${order.id}`;
    const imageMap: Record<string, string> = {};

    try {
      const imageQuery = `#graphql
        query GetOrderLineItemImages($id: ID!) {
          order(id: $id) {
            lineItems(first: 5) {
              nodes {
                title
                image {
                  url
                }
              }
            }
          }
        }
      `;
      const imgResponse = await admin.graphql(imageQuery, {
        variables: { id: orderId },
      });
      const imgJson = await imgResponse.json() as {
        data?: {
          order?: {
            lineItems?: {
              nodes: Array<{ title: string; image?: { url: string } | null }>;
            };
          };
        };
      };
      for (const node of imgJson.data?.order?.lineItems?.nodes || []) {
        imageMap[node.title] = node.image?.url || PLACEHOLDER_IMAGE;
      }
    } catch (imgError) {
      console.warn("[Webhook orders/create] Could not fetch line item images:", imgError);
    }

    // Build new Activity entries from this order's line items (max 5)
    const newActivities: Activity[] = order.line_items.slice(0, 5).map((item) => ({
      id: `${order.id}-${item.product_id ?? item.title}-${Date.now()}`,
      productTitle: item.title,
      productImage: imageMap[item.title] || PLACEHOLDER_IMAGE,
      city,
      timeAgo: "just now",
    }));

    // Read current config and prepend new activities (keep max 50)
    const currentConfig = await getConfig(admin);
    const updatedActivities = [
      ...newActivities,
      ...(currentConfig.activities || []),
    ].slice(0, 50);

    await setConfig(admin, { activities: updatedActivities });

    console.log(
      `[Webhook orders/create] shop=${shop} added=${newActivities.length} total=${updatedActivities.length}`
    );
  } catch (error) {
    console.error("[Webhook orders/create] Error processing order:", error);
  }

  return new Response("OK", { status: 200 });
};
