import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/**
 * Shop Redact Webhook
 *
 * This webhook is triggered 48 hours after a store uninstalls the app.
 * The app must delete all data associated with the shop to comply with GDPR.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);
  console.log("Shop redact payload:", JSON.stringify(payload));

  try {
    // Find the shop record
    const shopRecord = await db.shop.findUnique({
      where: { shopDomain: shop },
    });

    if (shopRecord) {
      // Delete all related data (cascades handle RecentOrders, ProductStats, Settings)
      await db.shop.delete({
        where: { shopDomain: shop },
      });

      console.log(`Deleted shop record and all associated data for: ${shop}`);
    }

    // Also clean up any remaining sessions
    await db.session.deleteMany({
      where: { shop },
    });

    console.log(`Deleted all sessions for: ${shop}`);
    console.log(`Shop redact completed for: ${shop}`);
  } catch (error) {
    console.error(`Error processing shop redact for ${shop}:`, error);
    // Still return 200 to prevent webhook retries
  }

  return new Response(null, { status: 200 });
};
