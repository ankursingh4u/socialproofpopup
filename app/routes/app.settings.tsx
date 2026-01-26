import { useState, useCallback, useEffect } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  useLoaderData,
  useActionData,
  useSubmit,
  useNavigation,
  Link,
} from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Checkbox,
  Select,
  RangeSlider,
  Text,
  Button,
  Banner,
  Box,
  Icon,
  Badge,
} from "@shopify/polaris";
import { LockIcon } from "@shopify/polaris-icons";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate, MONTHLY_PLAN } from "../shopify.server";
import { getConfig, setConfig, ensureMetafieldDefinition, formatOrdersAsActivities, syncActivitiesToMetafield, type SocialProofConfig } from "../lib/metafields.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, billing } = await authenticate.admin(request);

  // Check billing status
  const { hasActivePayment } = await billing.check({
    plans: [MONTHLY_PLAN],
    isTest: true,
  });

  // Ensure metafield definition exists with storefront access
  // This enables Liquid templates to read shop.metafields.social_proof.config
  await ensureMetafieldDefinition(admin);

  // Get config from metafields (no database needed for settings!)
  const config = await getConfig(admin);

  return json({ settings: config, isPro: hasActivePayment });
};

type ActionData = { success: true; syncedCount?: number } | { success: false; error: string };
type PopupPosition = "BOTTOM_LEFT" | "BOTTOM_RIGHT" | "TOP_LEFT" | "TOP_RIGHT";

const PLACEHOLDER_IMAGE =
  "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-1_large.png";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session, billing } = await authenticate.admin(request);

  // Check billing status
  const { hasActivePayment } = await billing.check({
    plans: [MONTHLY_PLAN],
    isTest: true,
  });

  const formData = await request.formData();
  const intent = formData.get("intent");

  // Handle sync orders action
  if (intent === "syncOrders") {
    try {
      const shop = session.shop;

      // Fetch recent orders from Shopify
      const response = await admin.graphql(`
        query {
          orders(first: 10, sortKey: CREATED_AT, reverse: true) {
            edges {
              node {
                id
                name
                createdAt
                shippingAddress {
                  city
                  country
                }
                lineItems(first: 5) {
                  edges {
                    node {
                      title
                      product {
                        id
                        featuredImage {
                          url
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `);

      const data = await response.json();

      if (data.errors) {
        console.error("[SyncOrders] GraphQL errors:", data.errors);
        return json<ActionData>({
          success: false,
          error: data.errors[0]?.message || "Failed to fetch orders"
        });
      }

      const orders = data?.data?.orders?.edges || [];

      // Get or create shop record
      let shopRecord = await db.shop.findUnique({
        where: { shopDomain: shop },
      });

      if (!shopRecord) {
        shopRecord = await db.shop.create({
          data: {
            shopDomain: shop,
            accessToken: session.accessToken || "",
          },
        });
      }

      let syncedCount = 0;

      // Process each order
      for (const { node: order } of orders) {
        const orderId = order.id.replace("gid://shopify/Order/", "");
        const city = order.shippingAddress?.city || "Someone";
        const country = order.shippingAddress?.country || "";

        for (const { node: item } of order.lineItems.edges) {
          // Check if this order item already exists
          const existing = await db.recentOrder.findFirst({
            where: {
              shopId: shopRecord.id,
              orderId: orderId,
              productTitle: item.title,
            },
          });

          if (!existing) {
            await db.recentOrder.create({
              data: {
                shopId: shopRecord.id,
                orderId: orderId,
                productTitle: item.title,
                productImage: item.product?.featuredImage?.url || PLACEHOLDER_IMAGE,
                city: city,
                country: country,
              },
            });
            syncedCount++;
          }
        }
      }

      // Sync to metafields if Pro user
      if (hasActivePayment && syncedCount > 0) {
        const recentOrders = await db.recentOrder.findMany({
          where: { shopId: shopRecord.id },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            productTitle: true,
            productImage: true,
            city: true,
            createdAt: true,
          },
        });

        const activities = formatOrdersAsActivities(recentOrders);
        await syncActivitiesToMetafield(admin, activities, false, true);
      }

      return json<ActionData>({ success: true, syncedCount });
    } catch (error) {
      console.error("[SyncOrders] Error:", error);
      return json<ActionData>({ success: false, error: String(error) });
    }
  }

  // Parse form data - enforce defaults for Free users
  const popupEnabled = formData.get("popupEnabled") === "true";
  const counterEnabled = formData.get("counterEnabled") === "true";

  // Free users: always demo mode, locked position/timing
  const demoMode = hasActivePayment
    ? formData.get("demoMode") === "true"
    : true;
  const popupPosition = hasActivePayment
    ? (formData.get("popupPosition") as PopupPosition)
    : "BOTTOM_LEFT";
  const popupDelay = hasActivePayment
    ? parseInt(formData.get("popupDelay") as string, 10)
    : 5;
  const displayDuration = hasActivePayment
    ? parseInt(formData.get("displayDuration") as string, 10)
    : 4;

  // Build showOnPages array
  const showOnPages: string[] = [];
  if (formData.get("showOnProduct") === "true") showOnPages.push("product");
  if (formData.get("showOnCollection") === "true")
    showOnPages.push("collection");
  if (formData.get("showOnHome") === "true") showOnPages.push("home");
  if (formData.get("showOnCart") === "true") showOnPages.push("cart");

  try {
    // Save to metafields via GraphQL (no database!)
    console.log("[Settings] Saving config:", {
      popupEnabled,
      counterEnabled,
      demoMode,
      popupPosition,
      popupDelay,
      displayDuration,
      showOnPages,
    });

    const result = await setConfig(admin, {
      popupEnabled,
      counterEnabled,
      demoMode,
      popupPosition,
      popupDelay,
      displayDuration,
      showOnPages,
    });

    console.log("[Settings] Save result:", result);

    if (result.success) {
      // Also sync real orders to metafield
      if (session?.shop) {
        try {
          const shopRecord = await db.shop.findUnique({
            where: { shopDomain: session.shop },
            select: { id: true },
          });

          if (shopRecord) {
            const recentOrders = await db.recentOrder.findMany({
              where: { shopId: shopRecord.id },
              orderBy: { createdAt: "desc" },
              take: 10,
              select: {
                id: true,
                productTitle: true,
                productImage: true,
                city: true,
                createdAt: true,
              },
            });

            if (recentOrders.length > 0) {
              const activities = formatOrdersAsActivities(recentOrders);
              await syncActivitiesToMetafield(admin, activities, demoMode, hasActivePayment);
              console.log(`[Settings] Synced ${activities.length} real orders to metafield (isPro: ${hasActivePayment})`);
            }
          }
        } catch (syncError) {
          console.error("[Settings] Error syncing orders:", syncError);
          // Don't fail the save, just log the error
        }
      }

      return json<ActionData>({ success: true });
    } else {
      console.error("[Settings] Save failed:", result.errors);
      return json<ActionData>({
        success: false,
        error: result.errors?.join(", ") || "Failed to save settings"
      });
    }
  } catch (error) {
    console.error("[Settings] Error saving settings:", error);
    return json<ActionData>({ success: false, error: "Failed to save settings" });
  }
};

const positionOptions = [
  { label: "Bottom Left", value: "BOTTOM_LEFT" },
  { label: "Bottom Right", value: "BOTTOM_RIGHT" },
  { label: "Top Left", value: "TOP_LEFT" },
  { label: "Top Right", value: "TOP_RIGHT" },
];

export default function Settings() {
  const { settings, isPro } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const shopify = useAppBridge();

  const isLoading = navigation.state === "submitting";
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Initialize form state from loader data (now from metafields!)
  const [formState, setFormState] = useState({
    popupEnabled: settings?.popupEnabled ?? true,
    counterEnabled: settings?.counterEnabled ?? true,
    demoMode: settings?.demoMode ?? true,
    popupPosition: (settings?.popupPosition ?? "BOTTOM_LEFT") as PopupPosition,
    popupDelay: settings?.popupDelay ?? 5,
    displayDuration: settings?.displayDuration ?? 4,
    showOnProduct: settings?.showOnPages?.includes("product") ?? true,
    showOnCollection: settings?.showOnPages?.includes("collection") ?? true,
    showOnHome: settings?.showOnPages?.includes("home") ?? true,
    showOnCart: settings?.showOnPages?.includes("cart") ?? true,
  });

  // Store original values for comparison
  const [originalState] = useState(formState);

  // Track if form has unsaved changes
  const isDirty = JSON.stringify(formState) !== JSON.stringify(originalState);

  // Handle save
  const handleSave = useCallback(() => {
    const formData = new FormData();
    formData.append("popupEnabled", String(formState.popupEnabled));
    formData.append("counterEnabled", String(formState.counterEnabled));
    formData.append("demoMode", String(formState.demoMode));
    formData.append("popupPosition", formState.popupPosition);
    formData.append("popupDelay", String(formState.popupDelay));
    formData.append("displayDuration", String(formState.displayDuration));
    formData.append("showOnProduct", String(formState.showOnProduct));
    formData.append("showOnCollection", String(formState.showOnCollection));
    formData.append("showOnHome", String(formState.showOnHome));
    formData.append("showOnCart", String(formState.showOnCart));

    submit(formData, { method: "post" });
  }, [formState, submit]);

  // Handle discard
  const handleDiscard = useCallback(() => {
    setFormState(originalState);
  }, [originalState]);

  // Handle sync orders
  const handleSyncOrders = useCallback(() => {
    const formData = new FormData();
    formData.append("intent", "syncOrders");
    submit(formData, { method: "post" });
  }, [submit]);

  // Show toast and error banner on action result
  useEffect(() => {
    if (actionData) {
      if (actionData.success) {
        if (actionData.syncedCount !== undefined) {
          shopify.toast.show(`Synced ${actionData.syncedCount} orders`);
        } else {
          shopify.toast.show("Settings saved successfully");
        }
        setErrorBanner(null);
      } else {
        shopify.toast.show("Failed to save settings", { isError: true });
        const message = typeof actionData.error === 'string'
          ? actionData.error
          : (actionData.error as { message?: string })?.message || 'Unknown error';
        setErrorBanner(message);
      }
    }
  }, [actionData, shopify]);

  return (
    <Page>
      <TitleBar title="Settings" />
      <BlockStack gap="500">
        {errorBanner && (
          <Banner
            tone="critical"
            title="Error saving settings"
            onDismiss={() => setErrorBanner(null)}
          >
            <p>{errorBanner}</p>
          </Banner>
        )}

        {!isPro && (
          <Banner
            title="You're on the Free plan"
            tone="info"
            action={{ content: "Upgrade to Pro", url: "/app/billing" }}
          >
            <p>Upgrade to Pro for real order data and full customization (position, timing).</p>
          </Banner>
        )}

        {isDirty && (
          <Banner tone="warning">
            <Text as="p" variant="bodyMd">
              You have unsaved changes
            </Text>
          </Banner>
        )}

        <Layout>
          {/* General Settings */}
          <Layout.AnnotatedSection
            title="General Settings"
            description="Control the overall behavior of social proof popups on your store."
          >
            <Card>
              <BlockStack gap="400">
                <Checkbox
                  label="Enable Social Proof Popups"
                  checked={formState.popupEnabled}
                  onChange={(checked) =>
                    setFormState({ ...formState, popupEnabled: checked })
                  }
                />
                <Checkbox
                  label="Enable Purchase Counter"
                  checked={formState.counterEnabled}
                  onChange={(checked) =>
                    setFormState({ ...formState, counterEnabled: checked })
                  }
                />
                {isPro ? (
                  <>
                    <Checkbox
                      label="Demo Mode"
                      helpText="Show sample popups with fake data for testing purposes"
                      checked={formState.demoMode}
                      onChange={(checked) =>
                        setFormState({ ...formState, demoMode: checked })
                      }
                    />
                    {!formState.demoMode && (
                      <Box paddingBlockStart="200">
                        <InlineStack gap="300" blockAlign="center">
                          <Button onClick={handleSyncOrders} loading={isLoading}>
                            Sync Orders from Shopify
                          </Button>
                          <Text as="span" variant="bodySm" tone="subdued">
                            Pull existing orders to show in popups
                          </Text>
                        </InlineStack>
                      </Box>
                    )}
                  </>
                ) : (
                  <Box paddingBlockStart="200">
                    <InlineStack gap="200" blockAlign="center">
                      <Badge tone="info">Demo Mode Active</Badge>
                      <Text as="span" variant="bodySm" tone="subdued">
                        Free plan shows demo data only
                      </Text>
                    </InlineStack>
                  </Box>
                )}
              </BlockStack>
            </Card>
          </Layout.AnnotatedSection>

          {/* Popup Appearance */}
          <Layout.AnnotatedSection
            title="Popup Appearance"
            description="Customize how and where popups appear on your store."
          >
            <Card>
              <BlockStack gap="400">
                {!isPro && (
                  <Banner tone="warning">
                    <InlineStack gap="200" blockAlign="center">
                      <Icon source={LockIcon} tone="subdued" />
                      <Text as="span" variant="bodySm">
                        Customization requires Pro plan.{" "}
                        <Link to="/app/billing">Upgrade now</Link>
                      </Text>
                    </InlineStack>
                  </Banner>
                )}
                <Select
                  label="Position"
                  options={positionOptions}
                  value={formState.popupPosition}
                  disabled={!isPro}
                  onChange={(value) =>
                    setFormState({
                      ...formState,
                      popupPosition: value as PopupPosition,
                    })
                  }
                />
                <RangeSlider
                  label="Delay before first popup"
                  value={formState.popupDelay}
                  min={3}
                  max={15}
                  output
                  disabled={!isPro}
                  suffix={
                    <Text as="span" variant="bodyMd">
                      {formState.popupDelay} seconds
                    </Text>
                  }
                  onChange={(value) =>
                    setFormState({
                      ...formState,
                      popupDelay: value as number,
                    })
                  }
                />
                <RangeSlider
                  label="Display duration"
                  value={formState.displayDuration}
                  min={2}
                  max={8}
                  output
                  disabled={!isPro}
                  suffix={
                    <Text as="span" variant="bodyMd">
                      {formState.displayDuration} seconds
                    </Text>
                  }
                  onChange={(value) =>
                    setFormState({
                      ...formState,
                      displayDuration: value as number,
                    })
                  }
                />
              </BlockStack>
            </Card>
          </Layout.AnnotatedSection>

          {/* Display Pages */}
          <Layout.AnnotatedSection
            title="Display Pages"
            description="Choose which pages will show social proof popups."
          >
            <Card>
              <BlockStack gap="400">
                <Checkbox
                  label="Product pages"
                  checked={formState.showOnProduct}
                  onChange={(checked) =>
                    setFormState({ ...formState, showOnProduct: checked })
                  }
                />
                <Checkbox
                  label="Collection pages"
                  checked={formState.showOnCollection}
                  onChange={(checked) =>
                    setFormState({ ...formState, showOnCollection: checked })
                  }
                />
                <Checkbox
                  label="Homepage"
                  checked={formState.showOnHome}
                  onChange={(checked) =>
                    setFormState({ ...formState, showOnHome: checked })
                  }
                />
                <Checkbox
                  label="Cart page"
                  checked={formState.showOnCart}
                  onChange={(checked) =>
                    setFormState({ ...formState, showOnCart: checked })
                  }
                />
              </BlockStack>
            </Card>
          </Layout.AnnotatedSection>

          {/* Action Buttons */}
          <Layout.Section>
            <InlineStack align="end" gap="300">
              <Button onClick={handleDiscard} disabled={!isDirty}>
                Discard
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                loading={isLoading}
              >
                Save
              </Button>
            </InlineStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
