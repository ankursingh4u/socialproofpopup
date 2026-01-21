import { json, type LoaderFunctionArgs } from "@remix-run/node";
import db from "../db.server";
import { generateDemoCounter } from "../services/demoData.server";
import { corsPreflightResponse, apiError, getShopDomain } from "../utils/api.server";
import { errors } from "../utils/errors.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Shop-Domain",
  "Cache-Control": "public, max-age=60",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return corsPreflightResponse();
  }

  const url = new URL(request.url);
  const productId = url.searchParams.get("productId");
  const shopDomain = getShopDomain(request, url);

  if (!shopDomain) {
    return apiError(errors.missingShop());
  }

  if (!productId) {
    return apiError(errors.missingParam("productId"));
  }

  try {
    // Find shop and settings
    const shop = await db.shop.findUnique({
      where: { shopDomain },
      include: { settings: true },
    });

    if (!shop) {
      return apiError(errors.shopNotFound());
    }

    // Check if counter is enabled
    if (!shop.settings?.counterEnabled) {
      return apiError(errors.featureDisabled("Counter"));
    }

    // Get real product stats first
    const productStats = await db.productStats.findUnique({
      where: {
        shopId_productId: {
          shopId: shop.id,
          productId: productId,
        },
      },
    });

    // If real data exists, return it (regardless of demo mode)
    if (productStats && productStats.purchaseCount > 0) {
      return json(
        {
          success: true,
          data: {
            count: productStats.purchaseCount,
            timeframe: "24 hours",
            isDemo: false,
          },
        },
        { headers: corsHeaders }
      );
    }

    // No real data - use demo if enabled
    if (shop.settings?.demoMode) {
      const demoCounter = generateDemoCounter(productId);
      return json(
        {
          success: true,
          data: {
            count: demoCounter.count,
            timeframe: "24 hours",
            isDemo: true,
          },
        },
        { headers: corsHeaders }
      );
    }

    // No real data, demo mode off - return 0
    return json(
      {
        success: true,
        data: {
          count: 0,
          timeframe: "24 hours",
          isDemo: false,
        },
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("[api.storefront.counter] Database error:", { shopDomain, productId, error });
    return apiError(errors.databaseError());
  }
};
