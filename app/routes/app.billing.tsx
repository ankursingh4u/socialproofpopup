import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Button,
  Badge,
  InlineStack,
  Box,
  Divider,
  List,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate, MONTHLY_PLAN } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { billing } = await authenticate.admin(request);

    // Check current subscription status
    const { hasActivePayment, appSubscriptions } = await billing.check({
      plans: [MONTHLY_PLAN],
      isTest: true,
    });

    const currentSubscription = appSubscriptions.length > 0 ? appSubscriptions[0] : null;

    return json({
      hasActivePayment,
      currentSubscription: currentSubscription
        ? {
            name: currentSubscription.name,
            status: currentSubscription.status,
            trialDays: currentSubscription.trialDays,
          }
        : null,
      error: null,
    });
  } catch (error) {
    console.error("[Billing Loader] Error:", error);
    // If it's a redirect response, throw it
    if (error instanceof Response) {
      throw error;
    }
    // Return error state instead of crashing
    return json({
      hasActivePayment: false,
      currentSubscription: null,
      error: error instanceof Error ? error.message : "Failed to load billing status",
    });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { billing } = await authenticate.admin(request);

    // Get the app URL - prefer env var, fallback to request URL with https
    let appUrl = process.env.SHOPIFY_APP_URL;
    if (!appUrl) {
      const url = new URL(request.url);
      // Always use https in production
      appUrl = `https://${url.host}`;
    }
    const returnUrl = `${appUrl}/app/billing`;

    console.log("[Billing] Return URL:", returnUrl);
    console.log("[Billing] SHOPIFY_APP_URL env:", process.env.SHOPIFY_APP_URL);

    // Request subscription - this will redirect to Shopify's approval page
    await billing.request({
      plan: MONTHLY_PLAN,
      isTest: true,
      returnUrl,
    });

    return null;
  } catch (error) {
    // billing.request throws a redirect Response on success
    if (error instanceof Response) {
      throw error;
    }
    console.error("[Billing] Error:", error);
    throw error;
  }
};

export default function BillingPage() {
  const { hasActivePayment, currentSubscription, error } = useLoaderData<typeof loader>();
  const submit = useSubmit();

  const handleSubscribe = () => {
    submit({}, { method: "post" });
  };

  return (
    <Page>
      <TitleBar title="Subscription" />
      <BlockStack gap="500">
        {error && (
          <Card>
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd" tone="critical">
                Error Loading Billing
              </Text>
              <Text as="p" variant="bodyMd">
                {error}
              </Text>
            </BlockStack>
          </Card>
        )}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingLg">
                    Subscription Status
                  </Text>
                  <Badge tone={hasActivePayment ? "success" : "warning"}>
                    {hasActivePayment ? "Active" : "Inactive"}
                  </Badge>
                </InlineStack>

                {hasActivePayment && currentSubscription ? (
                  <BlockStack gap="300">
                    <Text as="p" variant="bodyMd">
                      You are subscribed to the <strong>{currentSubscription.name}</strong> plan.
                    </Text>
                    {currentSubscription.trialDays && currentSubscription.trialDays > 0 && (
                      <Badge tone="info">
                        {`Trial: ${currentSubscription.trialDays} days remaining`}
                      </Badge>
                    )}
                  </BlockStack>
                ) : (
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Subscribe to access all features of Social Proof Popups.
                  </Text>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          {!hasActivePayment && (
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingLg">
                    Pro Monthly Plan
                  </Text>

                  <InlineStack gap="200" blockAlign="baseline">
                    <Text as="span" variant="heading2xl">
                      $9.99
                    </Text>
                    <Text as="span" variant="bodyMd" tone="subdued">
                      / month
                    </Text>
                  </InlineStack>

                  <Badge tone="success">7-day free trial</Badge>

                  <Divider />

                  <BlockStack gap="300">
                    <Text as="h3" variant="headingMd">
                      What's included:
                    </Text>
                    <List type="bullet">
                      <List.Item>Unlimited social proof popups</List.Item>
                      <List.Item>Real-time purchase notifications</List.Item>
                      <List.Item>Full customization options</List.Item>
                      <List.Item>Analytics dashboard</List.Item>
                      <List.Item>Priority support</List.Item>
                    </List>
                  </BlockStack>

                  <Box paddingBlockStart="400">
                    <Button variant="primary" size="large" onClick={handleSubscribe} fullWidth>
                      Start 7-Day Free Trial
                    </Button>
                  </Box>

                  <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                    Cancel anytime. No commitment required.
                  </Text>
                </BlockStack>
              </Card>
            </Layout.Section>
          )}
        </Layout>
      </BlockStack>
    </Page>
  );
}
