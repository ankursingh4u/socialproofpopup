import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/**
 * Customers Data Request Webhook
 *
 * This webhook is triggered when a customer requests their data under GDPR.
 * The app must respond with a 200 status and provide any stored customer data.
 *
 * Since this app only stores order location data (city/country) without direct
 * customer identifiers, we log the request for manual review if needed.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);
  console.log("Customer data request payload:", JSON.stringify(payload));

  // This app stores order data with city/country but no direct customer identifiers.
  // The data is aggregated for social proof display and cannot be directly linked
  // to individual customers without the shop's order data.

  // Log the request for compliance records
  const customerEmail = (payload as { customer?: { email?: string } })?.customer?.email;
  console.log(`Data request for customer: ${customerEmail || "unknown"} from shop: ${shop}`);

  // Return 200 to acknowledge receipt
  return new Response(null, { status: 200 });
};
