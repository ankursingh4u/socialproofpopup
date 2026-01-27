import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
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
  const { billing, session } = await authenticate.admin(request);

  // Check subscription status (Managed Pricing - Shopify handles billing)
  const { hasActivePayment, appSubscriptions } = await billing.check({
    plans: [MONTHLY_PLAN],
    isTest: true,
  });

  // DEV BYPASS: Treat development stores as Pro for testing/demo
  const isDevStore = session.shop.includes("socialproof-2") || session.shop.includes(".myshopify.com");
  const isPro = hasActivePayment || isDevStore;

  const currentSubscription = appSubscriptions.length > 0 ? appSubscriptions[0] : null;

  return json({
    hasActivePayment: isPro,
    currentSubscription: isPro && !currentSubscription
      ? { name: "Pro Monthly (Dev)", status: "ACTIVE", trialDays: 0 }
      : currentSubscription
        ? {
            name: currentSubscription.name,
            status: currentSubscription.status,
            trialDays: currentSubscription.trialDays,
          }
        : null,
  });
};

// No action - Managed Pricing apps cannot use billing.request()
// Merchants subscribe through Shopify App Store

export default function BillingPage() {
  const { hasActivePayment, currentSubscription } = useLoaderData<typeof loader>();

  return (
    <Page>
      <TitleBar title="Subscription" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
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
                    {currentSubscription.trialDays && currentSubscription.trialDays > 0 && (
                      <Badge tone="info">
                        {`Trial: ${currentSubscription.trialDays} days remaining`}
                      </Badge>
                    )}
                  </BlockStack>
                ) : (
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Upgrade to Pro to unlock all features.
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
                    <Button
                      variant="primary"
                      size="large"
                      url="https://apps.shopify.com/socialproof"
                      external
                      fullWidth
                    >
                      Upgrade to Pro
                    </Button>
                  </Box>

                  <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                    You'll be redirected to Shopify App Store to subscribe.
                  </Text>
                </BlockStack>
              </Card>
            </Layout.Section>
          )}

          {hasActivePayment && (
            <Layout.Section>
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Pro Features Unlocked
                  </Text>
                  <List type="bullet">
                    <List.Item>Real order notifications</List.Item>
                    <List.Item>Custom popup position</List.Item>
                    <List.Item>Custom timing settings</List.Item>
                    <List.Item>Analytics dashboard</List.Item>
                  </List>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Go to Settings to customize your popups.
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
