import { authenticate } from "../shopify.server";
import db from "../db.server";

/**
 * Webhook handler for app/uninstalled
 *
 * Clears active sessions when a merchant uninstalls the app.
 * Full data deletion (shop record, metafields) is handled by the
 * SHOP_REDACT compliance webhook which fires 48 hours after uninstall.
 */
export const action = async ({ request }: { request: Request }) => {
  const { shop } = await authenticate.webhook(request);

  console.log(`[Webhook app/uninstalled] shop=${shop}`);

  try {
    await db.session.deleteMany({ where: { shop } });
    console.log(`[Webhook app/uninstalled] Cleared sessions for: ${shop}`);
  } catch (error) {
    console.error("[Webhook app/uninstalled] Error:", error);
  }

  return new Response("OK", { status: 200 });
};
