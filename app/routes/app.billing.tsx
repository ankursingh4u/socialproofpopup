import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation, useActionData } from "@remix-run/react";
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
  Banner,
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
    if (error instanceof Response) {
      throw error;
    }
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

    // Request subscription - redirects to Shopify approval page
    await billing.request({
      plan: MONTHLY_PLAN,
      isTest: true,
    });

    return json({ success: true });
  } catch (error) {
    // billing.request throws a redirect on success
    if (error instanceof Response) {
      throw error;
    }
    console.error("[Billing Action] Error:", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

export default function BillingPage() {
  const { hasActivePayment, currentSubscription, error } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isLoading = navigation.state === "submitting";

  const handleSubscribe = () => {
    submit({}, { method: "post" });
  };

  const displayError = error || (actionData && 'error' in actionData ? actionData.error : null);

  return (
    <Page>
      <TitleBar title="Subscription" />
      <BlockStack gap="500">
        {displayError && (
          <Banner tone="critical" title="Billing Error">
            <p>{displayError}</p>
          </Banner>
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
                    <Text as="p" variant="bodySm" tone="subdued">
                      Manage your subscription in your Shopify admin billing settings.
                    </Text>
                  </BlockStack>
                ) : (
                  <BlockStack gap="300">
                    <Text as="p" variant="bodyMd" tone="subdued">
                      You're on the Free plan. Upgrade to Pro to unlock all features.
                    </Text>
                  </BlockStack>
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
                      <List.Item>Real order notifications (not demo data)</List.Item>
                      <List.Item>Custom popup position</List.Item>
                      <List.Item>Custom timing settings</List.Item>
                      <List.Item>Analytics dashboard</List.Item>
                      <List.Item>Priority support</List.Item>
                    </List>
                  </BlockStack>

                  <Box paddingBlockStart="400">
                    <Button
                      variant="primary"
                      size="large"
                      onClick={handleSubscribe}
                      loading={isLoading}
                      fullWidth
                    >
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
