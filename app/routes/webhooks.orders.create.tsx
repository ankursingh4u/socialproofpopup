import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

// Placeholder image when product image fetch fails
const PLACEHOLDER_IMAGE =
  "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-1_large.png";

// Type definitions for webhook payload
interface LineItem {
  product_id: number;
  title: string;
}

interface Address {
  city?: string;
  country?: string;
}

interface OrderPayload {
  id: number;
  line_items: LineItem[];
  shipping_address?: Address;
  billing_address?: Address;
}

// Helper to fetch product image via GraphQL
async function fetchProductImage(
  admin: Awaited<ReturnType<typeof authenticate.webhook>>["admin"],
  productId: number,
): Promise<string | null> {
  try {
    const response = await admin?.graphql(
      `
      query getProductImage($id: ID!) {
        product(id: $id) {
          featuredImage {
            url
          }
        }
      }
    `,
      {
        variables: { id: `gid://shopify/Product/${productId}` },
      },
    );

    const data = await response?.json();
    return data?.data?.product?.featuredImage?.url || null;
  } catch {
    return null;
  }
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload, admin, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Always return 200 to prevent Shopify retries
  // Process in try/catch and log errors
  try {
    const orderPayload = payload as OrderPayload;

    // Find shop record by domain
    const shopRecord = await db.shop.findUnique({
      where: { shopDomain: shop },
    });

    if (!shopRecord) {
      console.warn(`Shop not found for domain: ${shop}. Skipping order processing.`);
      return new Response();
    }

    // Extract address (prefer shipping, fallback to billing)
    const address = orderPayload.shipping_address || orderPayload.billing_address || {};

    // Process each line item
    for (const item of orderPayload.line_items) {
      // Fetch product image via GraphQL
      const productImage = await fetchProductImage(admin, item.product_id);

      // Create RecentOrder record
      await db.recentOrder.create({
        data: {
          shopId: shopRecord.id,
          orderId: String(orderPayload.id),
          productTitle: item.title,
          productImage: productImage || PLACEHOLDER_IMAGE,
          city: address.city || "Unknown",
          country: address.country || "Unknown",
        },
      });

      // Upsert ProductStats
      await db.productStats.upsert({
        where: {
          shopId_productId: {
            shopId: shopRecord.id,
            productId: String(item.product_id),
          },
        },
        update: {
          purchaseCount: { increment: 1 },
          lastPurchaseAt: new Date(),
        },
        create: {
          shopId: shopRecord.id,
          productId: String(item.product_id),
          purchaseCount: 1,
          lastPurchaseAt: new Date(),
        },
      });
    }

    // Cleanup old records - keep only last 100 RecentOrder records per shop
    const oldRecords = await db.recentOrder.findMany({
      where: { shopId: shopRecord.id },
      orderBy: { createdAt: "desc" },
      skip: 100,
      select: { id: true },
    });

    if (oldRecords.length > 0) {
      await db.recentOrder.deleteMany({
        where: { id: { in: oldRecords.map((r) => r.id) } },
      });
      console.log(`Cleaned up ${oldRecords.length} old order records for ${shop}`);
    }

    console.log(
      `Processed order ${orderPayload.id} with ${orderPayload.line_items.length} items for ${shop}`,
    );
  } catch (error) {
    console.error(`Error processing orders/create webhook for ${shop}:`, error);
    // Still return 200 to prevent Shopify retries
  }

  return new Response();
};
