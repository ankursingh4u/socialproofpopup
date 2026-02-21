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
  Icon,
} from "@shopify/polaris";
import { LockIcon } from "@shopify/polaris-icons";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { checkBilling } from "../lib/billing.server";
import {
  getConfig,
  setConfig,
  ensureMetafieldDefinition,
  formatOrdersAsActivities,
  type SocialProofConfig,
  type ShopifyOrder,
} from "../lib/metafields.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, billing } = await authenticate.admin(request);

  // Check billing status via SDK
  const { hasSubscription } = await checkBilling(billing);

  const isPro = hasSubscription;

  // Ensure metafield definition exists with storefront access
  // This enables Liquid templates to read shop.metafields.social_proof.config
  await ensureMetafieldDefinition(admin);

  // Get config from metafields (no database needed for settings!)
  const config = await getConfig(admin);

  // Sync isPro to metafield if it differs from stored config
  if (config.isPro !== isPro) {
    const syncResult = await setConfig(admin, { isPro });
    if (!syncResult.success) {
      console.error("[Settings] Metafield sync failed:", syncResult.errors);
    }
  }

  return json({ settings: config, isPro });
};

type ActionData = { success: true } | { success: false; error: string };
type PopupPosition = "BOTTOM_LEFT" | "BOTTOM_RIGHT" | "TOP_LEFT" | "TOP_RIGHT";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, billing } = await authenticate.admin(request);

  // Check billing status via SDK
  const { hasSubscription } = await checkBilling(billing);

  const isPro = hasSubscription;

  const formData = await request.formData();
  const intent = formData.get("intent");

  // Parse form data - enforce defaults for Free users
  const popupEnabled = formData.get("popupEnabled") === "true";
  const counterEnabled = formData.get("counterEnabled") === "true";

  // Free users: locked position/timing
  const popupPosition = isPro
    ? (formData.get("popupPosition") as PopupPosition)
    : "BOTTOM_LEFT";
  const popupDelay = isPro
    ? parseInt(formData.get("popupDelay") as string, 10)
    : 5;
  const displayDuration = isPro
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
      popupPosition,
      popupDelay,
      displayDuration,
      showOnPages,
    });

    const result = await setConfig(admin, {
      popupEnabled,
      counterEnabled,
      popupPosition,
      popupDelay,
      displayDuration,
      showOnPages,
    });

    console.log("[Settings] Save result:", result);

    if (result.success) {
      // Populate initial activities from recent orders so popups fire immediately
      try {
        const recentOrdersQuery = `#graphql
          query GetRecentOrders {
            orders(first: 10, sortKey: CREATED_AT, reverse: true) {
              nodes {
                id
                createdAt
                shippingAddress {
                  city
                  country
                }
                lineItems(first: 5) {
                  nodes {
                    title
                    image {
                      url
                    }
                  }
                }
              }
            }
          }
        `;
        const ordersResponse = await admin.graphql(recentOrdersQuery);
        const ordersJson = await ordersResponse.json() as {
          data?: { orders?: { nodes: ShopifyOrder[] } };
        };
        const recentOrders = ordersJson.data?.orders?.nodes || [];

        if (recentOrders.length > 0) {
          const newActivities = formatOrdersAsActivities(recentOrders);
          const currentConfig = await getConfig(admin);
          const merged = [
            ...newActivities,
            ...(currentConfig.activities || []),
          ].slice(0, 50);
          await setConfig(admin, { activities: merged });
          console.log(`[Settings] Synced ${newActivities.length} activities from recent orders`);
        }
      } catch (activityError) {
        // Non-fatal: settings were saved successfully; activity sync is best-effort
        console.error("[Settings] Error syncing initial activities:", activityError);
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

  // Show toast and error banner on action result
  useEffect(() => {
    if (actionData) {
      if (actionData.success) {
        shopify.toast.show("Settings saved successfully");
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
            <p>Upgrade to Pro for full customization options (position, timing).</p>
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
