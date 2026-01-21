import { json, type LoaderFunctionArgs } from "@remix-run/node";
import db from "../db.server";
import { generateDemoActivity } from "../services/demoData.server";
import { corsPreflightResponse, apiError, getShopDomain } from "../utils/api.server";
import { errors } from "../utils/errors.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Shop-Domain",
  "Cache-Control": "public, max-age=30",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return corsPreflightResponse();
  }

  const url = new URL(request.url);
  const countParam = url.searchParams.get("count");
  const pageParam = url.searchParams.get("page");
  const shopDomain = getShopDomain(request, url);

  if (!shopDomain) {
    return apiError(errors.missingShop());
  }

  // Parse count param (default 5, max 20)
  let count = 5;
  if (countParam) {
    const parsed = parseInt(countParam, 10);
    if (!isNaN(parsed) && parsed > 0) {
      count = Math.min(parsed, 20);
    }
  }

  try {
    // Find shop with settings
    const shop = await db.shop.findUnique({
      where: { shopDomain },
      include: { settings: true },
    });

    // Return demo data if shop not found
    // This allows the widget to work even before merchant opens the admin app
    if (!shop) {
      const demoData = Array.from({ length: count }, (_, i) => {
        const activity = generateDemoActivity();
        return {
          id: `demo-${i + 1}`,
          productTitle: activity.productTitle,
          productImage: activity.productImage,
          city: activity.city,
          timeAgo: activity.timeAgo,
          isDemo: true,
        };
      });
      return json(
        {
          success: true,
          settings: { position: "BOTTOM_LEFT", delay: 5, duration: 4 },
          data: demoData,
        },
        { headers: corsHeaders }
      );
    }

    // Check if popup is enabled
    if (shop.settings && !shop.settings.popupEnabled) {
      return json(
        { success: true, enabled: false },
        { headers: corsHeaders }
      );
    }

    // Check page filtering
    if (pageParam && shop.settings?.showOnPages) {
      try {
        const showOnPages: string[] = JSON.parse(shop.settings.showOnPages);
        if (!showOnPages.includes(pageParam)) {
          return json(
            { success: true, enabled: false },
            { headers: corsHeaders }
          );
        }
      } catch {
        // If JSON parsing fails, ignore page filtering
      }
    }

    // Build settings response
    const settings = {
      position: shop.settings?.popupPosition || "BOTTOM_LEFT",
      delay: shop.settings?.popupDelay ?? 5,
      duration: shop.settings?.displayDuration ?? 4,
    };

    // Always fetch real orders first
    const recentOrders = await db.recentOrder.findMany({
      where: { shopId: shop.id },
      orderBy: { createdAt: "desc" },
      take: count,
    });

    // Format real orders
    const realData = recentOrders.map((order) => ({
      id: `order-${order.id}`,
      productTitle: order.productTitle,
      productImage: order.productImage,
      city: order.city,
      timeAgo: formatTimeAgo(order.createdAt),
      isDemo: false,
    }));

    // If we have enough real orders, return them
    if (realData.length >= count) {
      return json(
        { success: true, settings, data: realData },
        { headers: corsHeaders }
      );
    }

    // Check if demo mode is enabled for supplementing
    const useDemoMode = shop.settings?.demoMode ?? true;

    if (useDemoMode) {
      // Generate demo data to fill the gap
      const demoCount = count - realData.length;
      const demoData = Array.from({ length: demoCount }, (_, i) => {
        const activity = generateDemoActivity();
        return {
          id: `demo-${i + 1}`,
          productTitle: activity.productTitle,
          productImage: activity.productImage,
          city: activity.city,
          timeAgo: activity.timeAgo,
          isDemo: true,
        };
      });

      // Return mixed data (real first, then demo)
      return json(
        { success: true, settings, data: [...realData, ...demoData] },
        { headers: corsHeaders }
      );
    }

    // No demo mode, return whatever real data we have (may be empty)
    return json(
      { success: true, settings, data: realData },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("[api.storefront.activity] Database error:", { shopDomain, error });
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
