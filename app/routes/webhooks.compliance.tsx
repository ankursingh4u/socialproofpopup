import type { ActionFunctionArgs } from "@remix-run/node";
import crypto from "crypto";
import db from "../db.server";

/**
 * GDPR Compliance Webhooks Handler
 *
 * Handles all three mandatory compliance webhooks:
 * - customers/data_request: Customer requests their data
 * - customers/redact: Request to delete customer data
 * - shop/redact: Request to delete all shop data (48h after uninstall)
 *
 * HMAC verification is performed manually to ensure 401 response on failure.
 */

async function verifyWebhook(request: Request): Promise<{
  isValid: boolean;
  shop: string | null;
  topic: string | null;
  payload: unknown;
  rawBody: string;
}> {
  const hmacHeader = request.headers.get("X-Shopify-Hmac-SHA256");
  const shop = request.headers.get("X-Shopify-Shop-Domain");
  const topic = request.headers.get("X-Shopify-Topic");

  if (!hmacHeader || !shop || !topic) {
    return { isValid: false, shop: null, topic: null, payload: null, rawBody: "" };
  }

  const rawBody = await request.text();
  const secret = process.env.SHOPIFY_API_SECRET || "";

  const calculatedHmac = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");

  // Use timing-safe comparison to prevent timing attacks
  let isValid = false;
  try {
    const calculatedBuffer = Buffer.from(calculatedHmac, "base64");
    const headerBuffer = Buffer.from(hmacHeader, "base64");

    // timingSafeEqual requires buffers of equal length
    if (calculatedBuffer.length === headerBuffer.length) {
      isValid = crypto.timingSafeEqual(calculatedBuffer, headerBuffer);
    }
  } catch {
    isValid = false;
  }

  let payload = null;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    // Invalid JSON
  }

  return { isValid, shop, topic, payload, rawBody };
}

export const action = async ({ request }: ActionFunctionArgs) => {
  // Verify HMAC signature
  const { isValid, shop, topic, payload } = await verifyWebhook(request);

  // Return 401 Unauthorized if HMAC verification fails
  if (!isValid) {
    console.error("Webhook HMAC verification failed");
    return new Response("Unauthorized", { status: 401 });
  }

  console.log(`Received ${topic} compliance webhook for ${shop}`);

  try {
    switch (topic) {
      case "customers/data_request":
        await handleCustomersDataRequest(shop!, payload);
        break;

      case "customers/redact":
        await handleCustomersRedact(shop!, payload);
        break;

      case "shop/redact":
        await handleShopRedact(shop!, payload);
        break;

      default:
        console.log(`Unknown compliance topic: ${topic}`);
    }
  } catch (error) {
    console.error(`Error processing ${topic} webhook for ${shop}:`, error);
    // Still return 200 to prevent retries - error is logged
  }

  return new Response(null, { status: 200 });
};

/**
 * Handle customers/data_request webhook
 * Customer requests access to their stored data
 */
async function handleCustomersDataRequest(shop: string, payload: unknown) {
  const typedPayload = payload as {
    customer?: { id?: number; email?: string };
    orders_requested?: number[];
  };

  const customerEmail = typedPayload?.customer?.email;
  const customerId = typedPayload?.customer?.id;

  console.log(`Data request for customer ID: ${customerId}, email: ${customerEmail}`);

  // This app stores order data with city/country but no direct customer identifiers.
  // The data cannot be directly linked to individual customers without order IDs.
  // Log the request for compliance records.

  console.log(`Customer data request processed for shop: ${shop}`);
}

/**
 * Handle customers/redact webhook
 * Request to delete customer's personal data
 */
async function handleCustomersRedact(shop: string, payload: unknown) {
  const typedPayload = payload as {
    customer?: { id?: number; email?: string };
    orders_to_redact?: number[];
  };

  const customerId = typedPayload?.customer?.id;
  const customerEmail = typedPayload?.customer?.email;
  const ordersToRedact = typedPayload?.orders_to_redact || [];

  console.log(`Customer redact - ID: ${customerId}, email: ${customerEmail}`);
  console.log(`Orders to redact: ${JSON.stringify(ordersToRedact)}`);

  if (ordersToRedact.length > 0) {
    const shopRecord = await db.shop.findUnique({
      where: { shopDomain: shop },
    });

    if (shopRecord) {
      // Delete recent orders matching the order IDs
      const deleteResult = await db.recentOrder.deleteMany({
        where: {
          shopId: shopRecord.id,
          orderId: {
            in: ordersToRedact.map((id) => String(id)),
          },
        },
      });

      console.log(`Deleted ${deleteResult.count} recent orders for customer redaction`);
    }
  }

  console.log(`Customer redact completed for shop: ${shop}`);
}

/**
 * Handle shop/redact webhook
 * Delete all shop data 48 hours after app uninstall
 */
async function handleShopRedact(shop: string, payload: unknown) {
  console.log(`Shop redact payload: ${JSON.stringify(payload)}`);

  // Delete shop record (cascades to RecentOrders, ProductStats, Settings)
  const shopRecord = await db.shop.findUnique({
    where: { shopDomain: shop },
  });

  if (shopRecord) {
    await db.shop.delete({
      where: { shopDomain: shop },
    });
    console.log(`Deleted shop record and all associated data for: ${shop}`);
  }

  // Clean up any remaining sessions
  await db.session.deleteMany({
    where: { shop },
  });

  console.log(`Shop redact completed for: ${shop}`);
}
