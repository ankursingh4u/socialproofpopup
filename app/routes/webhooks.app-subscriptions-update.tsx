import { authenticate } from "../shopify.server";
import { setConfig } from "../lib/metafields.server";

/**
 * Webhook handler for app_subscriptions/update
 *
 * Fires whenever a subscription status changes — including trial expiry,
 * cancellation, or reactivation. Syncs the isPro metafield so the storefront
 * widget reflects the correct feature set without waiting for the next
 * admin page load.
 */
export const action = async ({ request }: { request: Request }) => {
  const { shop, admin, payload } = await authenticate.webhook(request);

  console.log(`[Webhook app_subscriptions/update] shop=${shop}`);

  if (!admin || !payload) {
    return new Response("OK", { status: 200 });
  }

  try {
    const subscription = payload as {
      app_subscription?: { status?: string; name?: string };
    };

    const status = subscription.app_subscription?.status?.toUpperCase();
    // Only ACTIVE subscriptions grant pro features; CANCELLED/EXPIRED/DECLINED do not
    const isPro = status === "ACTIVE";

    console.log(
      `[Webhook app_subscriptions/update] shop=${shop} status=${status} isPro=${isPro}`
    );

    const syncResult = await setConfig(admin, { isPro });
    if (!syncResult.success) {
      console.error(
        "[Webhook app_subscriptions/update] Metafield sync failed:",
        syncResult.errors
      );
    }
  } catch (error) {
    console.error("[Webhook app_subscriptions/update] Error:", error);
  }

  return new Response("OK", { status: 200 });
};
