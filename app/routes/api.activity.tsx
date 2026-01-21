import { json, type LoaderFunctionArgs } from "@remix-run/node";
import db from "../db.server";
import { generateDemoActivity } from "../services/demoData.server";
import { corsPreflightResponse, apiError, getShopDomain } from "../utils/api.server";
import { errors } from "../utils/errors.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Shop-Domain",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return corsPreflightResponse();
  }

  const url = new URL(request.url);
  const shopDomain = getShopDomain(request, url);

  if (!shopDomain) {
    return apiError(errors.missingShop());
  }

  try {
    // Find shop
    const shop = await db.shop.findUnique({
      where: { shopDomain },
      include: { settings: true },
    });

    if (!shop) {
      return apiError(errors.shopNotFound());
    }

    // If demo mode is enabled, redirect to demo endpoint behavior
    if (shop.settings?.demoMode) {
      const activity = generateDemoActivity();
      return json(
        { success: true, data: activity, isDemo: true },
        { headers: corsHeaders }
      );
    }

    // Fetch real recent order data
    const recentOrder = await db.recentOrder.findFirst({
      where: { shopId: shop.id },
      orderBy: { createdAt: "desc" },
    });

    if (!recentOrder) {
      // No real orders yet - fall back to demo data
      const activity = generateDemoActivity();
      return json(
        { success: true, data: activity, isDemo: true },
        { headers: corsHeaders }
      );
    }

    // Format activity data from real order
    const activity = {
      productTitle: recentOrder.productTitle,
      productImage: recentOrder.productImage,
      city: recentOrder.city,
      country: recentOrder.country,
      timestamp: recentOrder.createdAt.toISOString(),
      timeAgo: formatTimeAgo(recentOrder.createdAt),
    };

    return json(
      { success: true, data: activity, isDemo: false },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("[api.activity] Database error:", { shopDomain, error });
    return apiError(errors.databaseError());
  }
};

/**
 * Format a date to relative time string
 */
function formatTimeAgo(date: Date): string {
  const now = Date.now();
  const time = date.getTime();
  const diff = now - time;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;

  return "recently";
}
