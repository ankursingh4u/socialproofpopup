import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/**
 * Customers Redact Webhook
 *
 * This webhook is triggered when a store owner requests deletion of customer data,
 * or when a customer requests their data be deleted under GDPR.
 *
 * Since this app only stores order location data (city/country) without direct
 * customer identifiers or email addresses, there is no customer-specific data
 * to delete. The recent orders are stored by shop, not by customer ID.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);
  console.log("Customer redact payload:", JSON.stringify(payload));

  try {
    // Extract customer info from payload for logging
    const typedPayload = payload as {
      customer?: { id?: number; email?: string };
      orders_to_redact?: number[];
    };

    const customerId = typedPayload?.customer?.id;
    const customerEmail = typedPayload?.customer?.email;
    const ordersToRedact = typedPayload?.orders_to_redact || [];

    console.log(`Customer redact request - Customer ID: ${customerId}, Email: ${customerEmail}`);
    console.log(`Orders to redact: ${JSON.stringify(ordersToRedact)}`);

    // If there are specific orders to redact and we have them stored
    if (ordersToRedact.length > 0) {
      const shopRecord = await db.shop.findUnique({
        where: { shopDomain: shop },
      });

      if (shopRecord) {
        // Delete any recent orders that match the order IDs to redact
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

    // Log completion for compliance records
    console.log(`Customer redact completed for shop: ${shop}`);
  } catch (error) {
    console.error(`Error processing customer redact for ${shop}:`, error);
    // Still return 200 to prevent webhook retries
  }

  return new Response(null, { status: 200 });
};
