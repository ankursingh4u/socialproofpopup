import { json, type LoaderFunctionArgs } from "@remix-run/node";
import db from "../db.server";
import {
  generateDemoActivity,
  generateDemoCounter,
} from "../services/demoData.server";
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
  const type = url.searchParams.get("type");
  const productId = url.searchParams.get("productId");
  const countParam = url.searchParams.get("count");
  const shopDomain = getShopDomain(request, url);

  if (!shopDomain) {
    return apiError(errors.missingShop());
  }

  try {
    // Verify shop exists and demoMode is enabled
    const shop = await db.shop.findUnique({
      where: { shopDomain },
      include: { settings: true },
    });

    if (!shop) {
      return apiError(errors.shopNotFound());
    }

    if (!shop.settings?.demoMode) {
      return apiError(errors.featureDisabled("Demo mode"));
    }

    // Handle different request types
    switch (type) {
      case "activity": {
        const activity = generateDemoActivity();
        return json(
          { success: true, data: activity, isDemo: true },
          { headers: corsHeaders }
        );
      }

      case "counter": {
        if (!productId) {
          return apiError(errors.missingParam("productId"));
        }
        const counter = generateDemoCounter(productId);
        return json(
          { success: true, data: counter, isDemo: true },
          { headers: corsHeaders }
        );
      }

      case "batch": {
        const count = Math.min(Math.max(parseInt(countParam || "5", 10), 1), 20);
        const activities = Array.from({ length: count }, () =>
          generateDemoActivity()
        );
        return json(
          { success: true, data: activities, isDemo: true },
          { headers: corsHeaders }
        );
      }

      default:
        return apiError(errors.invalidParam("type", "Use 'activity', 'counter', or 'batch'"));
    }
  } catch (error) {
    console.error("[api.demo-data] Database error:", { shopDomain, error });
    return apiError(errors.databaseError());
  }
};
