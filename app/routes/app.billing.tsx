import { useEffect } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, useSubmit, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Badge,
  InlineStack,
  InlineGrid,
  Banner,
  List,
  Divider,
  Button,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { PLAN_MONTHLY } from "../shopify.server";
import { checkBilling, isTestMode } from "../lib/billing.server";
import { getConfig, setConfig } from "../lib/metafields.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, billing } = await authenticate.admin(request);

  const { hasSubscription: hasActivePayment, subscription: currentSubscription } = await checkBilling(billing);

  // Sync isPro status to metafield
  const config = await getConfig(admin);
  if (config.isPro !== hasActivePayment) {
    const syncResult = await setConfig(admin, { isPro: hasActivePayment });
    if (!syncResult.success) {
      console.error("[Billing] Metafield sync failed:", syncResult.errors);
    }
  }

  // BUG 6: pass activated flag so the component can show an "activating" banner
  const url = new URL(request.url);
  const activated = url.searchParams.get("activated") === "1";

  return json({ hasActivePayment, currentSubscription, activated });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { billing, admin, session } = await authenticate.admin(request);

  // BUG 5: use shared isTestMode() from billing.server.ts — avoids duplicating
  // the env check and ensures both code paths always agree.
  const isTest = isTestMode();

  // Build returnUrl as an admin.shopify.com embedded-app URL so that after the
  // merchant approves billing, Shopify redirects them back *inside* the admin
  // iframe. Using the raw tunnel/vercel URL causes a blank screen with the new
  // embedded auth strategy because token-exchange fails outside the iframe.
  const shopName = session.shop.replace(".myshopify.com", "");
  const apiKey = process.env.SHOPIFY_API_KEY!;
  const returnUrl = `https://admin.shopify.com/store/${shopName}/apps/${apiKey}/app/billing?activated=1`;

  // Step 1: Guard — check for any existing subscription BEFORE requesting a new one.
  // billing.check() includes PENDING subscriptions (unlike the loader's custom
  // checkSubscription() which only checks status === "ACTIVE"). This catches the
  // stale-state scenario that causes appSubscriptionCreate to return userErrors.
  // billing.check() never throws a redirect — it always returns a plain object.
  const billingStatus = await billing.check({ isTest });

  const subs = billingStatus.appSubscriptions as Array<{ name: string; status: string; test: boolean }> | undefined;
  console.log("[Billing] check result:", JSON.stringify({
    hasActivePayment: billingStatus.hasActivePayment,
    subscriptions: subs?.map((s) => ({ name: s.name, status: s.status, test: s.test })),
  }, null, 2));
  console.log("[Billing] isTest:", isTest, "| returnUrl:", returnUrl);

  if (billingStatus.hasActivePayment) {
    // Already ACTIVE — redirect back, no double-subscription.
    return redirect("/app/billing");
  }

  // If there is a stale PENDING subscription (user abandoned the Shopify payment
  // page previously), Shopify will reject a new appSubscriptionCreate with userErrors.
  // Detect this early and return a friendly message instead of a confusing error.
  const hasPending = subs?.some((s) => s.status === "PENDING") ?? false;
  if (hasPending) {
    console.warn("[Billing] Stale PENDING subscription detected — advising user to wait.");
    return json({
      billingError:
        "A subscription approval is still pending. Please wait a minute and refresh, " +
        "or go to your Shopify admin → Apps to complete or cancel the pending request.",
    });
  }

  // Step 2: create subscription via direct GraphQL.
  // This surfaces real Shopify userErrors in the banner and returns
  // a confirmationUrl the component can navigate to via window.open(_top),
  // bypassing the App Bridge postMessage cross-origin failure entirely.
  const response = await admin.graphql(
    `#graphql
    mutation AppSubscriptionCreate(
      $name: String!
      $returnUrl: URL!
      $test: Boolean
      $lineItems: [AppSubscriptionLineItemInput!]!
    ) {
      appSubscriptionCreate(
        name: $name
        returnUrl: $returnUrl
        test: $test
        lineItems: $lineItems
      ) {
        userErrors { field message }
        confirmationUrl
        appSubscription { id status }
      }
    }`,
    {
      variables: {
        name: PLAN_MONTHLY,
        returnUrl,
        test: isTest,
        lineItems: [
          {
            plan: {
              appRecurringPricingDetails: {
                price: { amount: "9.99", currencyCode: "USD" },
                interval: "EVERY_30_DAYS",
              },
            },
          },
        ],
      },
    }
  );

  const responseJson = await response.json();
  const { userErrors, confirmationUrl } = responseJson.data.appSubscriptionCreate;

  console.log("[Billing] appSubscriptionCreate:", JSON.stringify(
    { userErrors, confirmationUrl, isTest, returnUrl }, null, 2
  ));

  if (userErrors?.length > 0) {
    const errorMsg = userErrors
      .map((e: { field: string[]; message: string }) => e.message)
      .join(". ");
    console.error("[Billing] userErrors:", JSON.stringify(userErrors, null, 2));
    return json({ billingError: errorMsg });
  }

  return json({ confirmationUrl });
};

export default function BillingPage() {
  const { hasActivePayment, currentSubscription, activated } = useLoaderData<typeof loader>();
  const actionData = useActionData<{ billingError?: string; confirmationUrl?: string }>();
  const submit = useSubmit();
  const navigation = useNavigation();

  const isSubscribing = navigation.state === "submitting";

  useEffect(() => {
    if (actionData?.confirmationUrl) {
      window.open(actionData.confirmationUrl, "_top");
    }
  }, [actionData?.confirmationUrl]);

  const handleSubscribe = () => {
    submit(null, { method: "post" });
  };

  return (
    <Page>
      <TitleBar title="Subscription" />
      <BlockStack gap="500">
        {actionData?.billingError && (
          <Banner tone="critical" title="Subscription error">
            <p>{actionData.billingError}</p>
          </Banner>
        )}
        {activated && !hasActivePayment && (
          <Banner tone="info" title="Subscription activating">
            <p>
              Your subscription is being activated. This may take a moment to
              reflect. Refresh the page shortly if the status has not updated.
            </p>
          </Banner>
        )}
        {/* Status card — full width */}
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h2" variant="headingLg">
                Subscription Status
              </Text>
              <Badge tone={hasActivePayment ? "success" : "warning"}>
                {hasActivePayment ? "Pro Plan Active" : "Free Plan"}
              </Badge>
            </InlineStack>

            {hasActivePayment && currentSubscription ? (
              <BlockStack gap="300">
                <Text as="p" variant="bodyMd">
                  You are subscribed to the <strong>{currentSubscription.name}</strong> plan.
                </Text>
              </BlockStack>
            ) : (
              <Text as="p" variant="bodyMd" tone="subdued">
                Upgrade to Pro to unlock all features.
              </Text>
            )}
          </BlockStack>
        </Card>

        {/* Side-by-side plan cards */}
        <InlineGrid columns={["oneHalf", "oneHalf"]} gap="400">
          {/* Free Plan */}
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingLg">
                  Free Plan
                </Text>
                <Badge>$0 / month</Badge>
              </InlineStack>

              <Divider />

              <List type="bullet">
                <List.Item>Fixed bottom-left position</List.Item>
                <List.Item>Standard 5s delay / 4s display</List.Item>
                <List.Item>Real order notifications</List.Item>
              </List>

              {!hasActivePayment && (
                <Badge tone="success">Current Plan</Badge>
              )}
            </BlockStack>
          </Card>

          {/* Pro Plan */}
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingLg">
                  Pro Plan
                </Text>
                <InlineStack gap="200" blockAlign="center">
                  <Text as="span" variant="bodyMd">$9.99 / month</Text>
                </InlineStack>
              </InlineStack>

              <Divider />

              <List type="bullet">
                <List.Item>Custom popup position (4 corners)</List.Item>
                <List.Item>Custom delay (3–15s) &amp; display duration (2–8s)</List.Item>
                <List.Item>Real order notifications</List.Item>
              </List>

              {hasActivePayment ? (
                <Badge tone="success">Current Plan</Badge>
              ) : (
                <Button
                  variant="primary"
                  size="large"
                  fullWidth
                  onClick={handleSubscribe}
                  loading={isSubscribing}
                >
                  Get Pro
                </Button>
              )}
            </BlockStack>
          </Card>
        </InlineGrid>
      </BlockStack>
    </Page>
  );
}
