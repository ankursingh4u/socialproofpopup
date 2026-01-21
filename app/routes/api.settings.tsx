import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import db from "../db.server";
import { corsPreflightResponse, apiSuccess, apiError, getShopDomain, generateETag, checkETagMatch, notModifiedResponse } from "../utils/api.server";
import { errors } from "../utils/errors.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Shop-Domain",
  "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
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
    // Look up shop and settings
    const shop = await db.shop.findUnique({
      where: { shopDomain },
      include: { settings: true },
    });

    // Return default settings (with demo mode) if shop not found
    // This allows the widget to work even before merchant opens the admin app
    if (!shop) {
      return json(
        {
          success: true,
          data: {
            popupEnabled: true,
            counterEnabled: true,
            demoMode: true,
            popupPosition: "BOTTOM_LEFT",
            popupDelay: 5,
            displayDuration: 4,
            showOnPages: ["product", "collection", "home", "cart"],
          },
        },
        { headers: corsHeaders }
      );
    }

    // Return default settings if none exist
    const settings = shop.settings;

    if (!settings) {
      return json(
        {
          success: true,
          data: {
            popupEnabled: true,
            counterEnabled: true,
            demoMode: true,
            popupPosition: "BOTTOM_LEFT",
            popupDelay: 5,
            displayDuration: 4,
            showOnPages: ["product", "collection", "home", "cart"],
          },
        },
        { headers: corsHeaders }
      );
    }

    // Parse showOnPages from JSON string
    let showOnPages: string[];
    try {
      showOnPages = JSON.parse(settings.showOnPages);
    } catch {
      showOnPages = ["product", "collection", "home", "cart"];
    }

    const responseData = {
      popupEnabled: settings.popupEnabled,
      counterEnabled: settings.counterEnabled,
      demoMode: settings.demoMode,
      popupPosition: settings.popupPosition,
      popupDelay: settings.popupDelay,
      displayDuration: settings.displayDuration,
      showOnPages,
    };

    const etag = generateETag(responseData);
    if (checkETagMatch(request, etag)) {
      return notModifiedResponse(etag);
    }

    return apiSuccess(responseData, { "ETag": etag });
  } catch (error) {
    console.error("[api.settings] Database error:", { shopDomain, error });
    return apiError(errors.databaseError());
  }
};
