import { redirect } from "@remix-run/node";
import { PLAN_MONTHLY } from "../shopify.server";

// Structural type for the billing object returned by authenticate.admin()
// Avoids importing the private generic BillingContext<Config> type from the SDK.
interface AppBilling {
  require(options: {
    plans: string[];
    isTest?: boolean;
    onFailure: (error: unknown) => Promise<Response>;
  }): Promise<unknown>;
  check(options?: {
    plans?: string[];
    isTest?: boolean;
  }): Promise<{
    hasActivePayment: boolean;
    appSubscriptions: Array<{
      name: string;
      status: string;
      trialDays?: number | null;
    }>;
  }>;
}

// BUG 5: exported so action files can reuse it instead of duplicating the logic
export const isTestMode = () => process.env.NODE_ENV !== "production";

/**
 * Hard billing wall — reserved for future premium-only routes.
 *
 * Currently unused (dead code). Do NOT delete; call this in any loader that
 * should be completely inaccessible to free-tier merchants (as opposed to
 * checkBilling(), which gates UI only and lets the page render for free users).
 *
 * Usage:
 *   const { billing } = await authenticate.admin(request);
 *   await requireBilling(billing); // throws redirect to /app/billing if unsubscribed
 */
export async function requireBilling(billing: AppBilling): Promise<void> {
  await billing.require({
    plans: [PLAN_MONTHLY],
    isTest: isTestMode(),
    onFailure: async () => redirect("/app/billing"),
  });
}

/**
 * Check subscription status without enforcement.
 *
 * Use in loaders that need to know subscription state but should not
 * hard-redirect (e.g., the billing page itself, settings page for free/paid UI).
 *
 * Usage:
 *   const { billing } = await authenticate.admin(request);
 *   const { hasSubscription, subscription } = await checkBilling(billing);
 */
export async function checkBilling(billing: AppBilling): Promise<{
  hasSubscription: boolean;
  subscription: {
    name: string;
    status: string;
    trialDays: number | null;
  } | null;
}> {
  const result = await billing.check({
    plans: [PLAN_MONTHLY],
    isTest: isTestMode(),
  });

  const sub = result.appSubscriptions[0] ?? null;

  return {
    hasSubscription: result.hasActivePayment,
    subscription: sub
      ? {
          name: sub.name,
          status: sub.status,
          trialDays: sub.trialDays ?? null,
        }
      : null,
  };
}
