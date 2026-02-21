import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  Button,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { checkBilling } from "../lib/billing.server";
import db from "../db.server";
import {
  ensureMetafieldDefinition, getConfig, setConfig,
  formatOrdersAsActivities,
  type ShopifyOrder,
} from "../lib/metafields.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, billing, session } = await authenticate.admin(request);

  // Ensure metafield definition exists with storefront access
  await ensureMetafieldDefinition(admin);

  // Check billing status via SDK
  const { hasSubscription } = await checkBilling(billing);

  // Sync isPro to metafield if it differs
  const currentConfig = await getConfig(admin);
  if (currentConfig.isPro !== hasSubscription) {
    const syncResult = await setConfig(admin, { isPro: hasSubscription });
    if (!syncResult.success) {
      console.error("[Dashboard] Metafield sync failed:", syncResult.errors);
    }
  }

  // Auto-seed activities from recent orders if metafield is empty.
  // This fires on every dashboard load until at least one activity exists.
  if (currentConfig.activities.length === 0) {
    try {
      const ordersResponse = await admin.graphql(`#graphql
        query GetRecentOrders {
          orders(first: 10, sortKey: CREATED_AT, reverse: true) {
            nodes {
              id
              createdAt
              shippingAddress { city country }
              lineItems(first: 5) {
                nodes { title image { url } }
              }
            }
          }
        }
      `);
      const ordersJson = await ordersResponse.json() as {
        data?: { orders?: { nodes: ShopifyOrder[] } };
      };
      const recentOrders = ordersJson.data?.orders?.nodes ?? [];
      if (recentOrders.length > 0) {
        const newActivities = formatOrdersAsActivities(recentOrders);
        await setConfig(admin, { activities: newActivities });
      }
    } catch (seedError) {
      console.error("[Dashboard] Activity seed failed (non-fatal):", seedError);
    }
  }

  const shopDomain = session.shop;

  // Find or create shop record
  let shop = await db.shop.findUnique({
    where: { shopDomain },
    include: { settings: true },
  });

  if (!shop) {
    shop = await db.shop.create({
      data: {
        shopDomain,
        accessToken: session.accessToken || "",
        settings: { create: {} }, // Creates with defaults
      },
      include: { settings: true },
    });
  } else if (!shop.settings) {
    // Create settings if shop exists but settings don't
    await db.settings.create({
      data: { shopId: shop.id },
    });
    shop = await db.shop.findUnique({
      where: { shopDomain },
      include: { settings: true },
    });
  }

  return json({ settings: shop?.settings, hasSubscription });
};

export default function Index() {
  const { settings, hasSubscription } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const isActive = settings?.popupEnabled ?? false;

  return (
    <Page>
      <TitleBar title="Social Proof Popups" />
      <BlockStack gap="500">
        <Layout>
          {/* App Status Card */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingLg">
                    Social Proof Popups
                  </Text>
                  <InlineStack gap="200">
                    <Badge tone={hasSubscription ? "success" : "warning"}>
                      {hasSubscription ? "Pro" : "Free"}
                    </Badge>
                    <Badge tone={isActive ? "success" : "critical"}>
                      {isActive ? "Active" : "Inactive"}
                    </Badge>
                  </InlineStack>
                </InlineStack>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Display recent purchase notifications to build trust and
                  increase conversions.
                </Text>

              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Quick Actions Card */}
          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Quick Actions
                </Text>
                <BlockStack gap="300">
                  <Button
                    variant="primary"
                    onClick={() => navigate("/app/settings")}
                    fullWidth
                  >
                    Configure Settings
                  </Button>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* How It Works Card */}
          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  How It Works
                </Text>
                <BlockStack gap="300">
                  <BlockStack gap="100">
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      1. Install & Configure
                    </Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Set up your popup preferences and customize the appearance.
                    </Text>
                  </BlockStack>
                  <BlockStack gap="100">
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      2. Capture Orders
                    </Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      The app automatically tracks purchases from your store.
                    </Text>
                  </BlockStack>
                  <BlockStack gap="100">
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      3. Display Popups
                    </Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Show social proof notifications to visitors and boost
                      conversions.
                    </Text>
                  </BlockStack>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
