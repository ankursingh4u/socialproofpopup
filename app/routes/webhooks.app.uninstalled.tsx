import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  let shop: string;
  let session: Awaited<ReturnType<typeof authenticate.webhook>>["session"];
  let topic: string;

  try {
    const auth = await authenticate.webhook(request);
    shop = auth.shop;
    session = auth.session;
    topic = auth.topic;
  } catch (error) {
    console.error("Webhook HMAC verification failed:", error);
    return new Response("Unauthorized", { status: 401 });
  }

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // If this webhook already ran, the session may have been deleted previously.
  if (session) {
    await db.session.deleteMany({ where: { shop } });
  }

  return new Response();
};
