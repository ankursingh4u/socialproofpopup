import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/**
 * GDPR Compliance Webhooks Handler
 *
 * Handles all three mandatory compliance webhooks:
 * - CUSTOMERS_DATA_REQUEST: Customer requests their data
 * - CUSTOMERS_REDACT: Request to delete customer data
 * - SHOP_REDACT: Request to delete all shop data (48h after uninstall)
 *
 * Uses authenticate.webhook() for automatic HMAC verification.
 */

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} compliance webhook for ${shop}`);

  try {
    switch (topic) {
      case "CUSTOMERS_DATA_REQUEST":
        await handleCustomersDataRequest(shop, payload);
        break;

      case "CUSTOMERS_REDACT":
        await handleCustomersRedact(shop, payload);
        break;

      case "SHOP_REDACT":
        await handleShopRedact(shop, payload);
        break;

      default:
        console.log(`Unknown compliance topic: ${topic}`);
        return new Response("Unhandled webhook topic", { status: 404 });
    }
  } catch (error) {
    console.error(`Error processing ${topic} webhook for ${shop}:`, error);
    // Still return 200 to prevent retries - error is logged
  }

  return new Response(null, { status: 200 });
};

/**
 * Handle CUSTOMERS_DATA_REQUEST webhook
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
 * Handle CUSTOMERS_REDACT webhook
 * Request to delete customer's personal data
 */
async function handleCustomersRedact(shop: string, payload: unknown) {
  const typedPayload = payload as {
    customer?: { id?: number; email?: string };
    orders_to_redact?: number[];
  };

  const customerId = typedPayload?.customer?.id;
  const customerEmail = typedPayload?.customer?.email;

  console.log(`Customer redact - ID: ${customerId}, email: ${customerEmail}`);

  // This app no longer stores order data, so there is nothing to delete.
  console.log(`Customer redact completed for shop: ${shop} (no stored order data)`);
}

/**
 * Handle SHOP_REDACT webhook
 * Delete all shop data 48 hours after app uninstall
 */
async function handleShopRedact(shop: string, payload: unknown) {
  console.log(`Shop redact payload: ${JSON.stringify(payload)}`);

  // Delete shop record (cascades to Settings)
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
