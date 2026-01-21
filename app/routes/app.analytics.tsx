import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  DataTable,
  EmptyState,
  Thumbnail,
  Badge,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const shop = await db.shop.findUnique({
    where: { shopDomain },
  });

  if (!shop) {
    return json({
      recentOrders: [],
      productStats: [],
      totalOrders: 0,
      totalProducts: 0,
    });
  }

  // Fetch recent orders (last 20)
  const recentOrders = await db.recentOrder.findMany({
    where: { shopId: shop.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  // Fetch product stats (top 10 by purchase count)
  const productStats = await db.productStats.findMany({
    where: { shopId: shop.id },
    orderBy: { purchaseCount: "desc" },
    take: 10,
  });

  // Get totals
  const totalOrders = await db.recentOrder.count({
    where: { shopId: shop.id },
  });

  const totalProducts = await db.productStats.count({
    where: { shopId: shop.id },
  });

  return json({
    recentOrders,
    productStats,
    totalOrders,
    totalProducts,
  });
};

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function Analytics() {
  const { recentOrders, productStats, totalOrders, totalProducts } =
    useLoaderData<typeof loader>();

  const hasData = totalOrders > 0 || totalProducts > 0;

  // Format recent orders for DataTable
  const recentOrderRows = recentOrders.map((order) => [
    <InlineStack gap="300" blockAlign="center" key={order.id}>
      <Thumbnail
        source={order.productImage || ""}
        alt={order.productTitle}
        size="small"
      />
      <Text as="span" variant="bodyMd">
        {order.productTitle.length > 30
          ? order.productTitle.substring(0, 30) + "..."
          : order.productTitle}
      </Text>
    </InlineStack>,
    `${order.city}, ${order.country}`,
    formatTimeAgo(order.createdAt),
  ]);

  // Format product stats for DataTable
  const productStatsRows = productStats.map((stat) => [
    stat.productId,
    stat.purchaseCount,
    stat.lastPurchaseAt ? formatTimeAgo(stat.lastPurchaseAt) : "N/A",
  ]);

  return (
    <Page
      backAction={{ content: "Home", url: "/app" }}
      title="Analytics"
    >
      <TitleBar title="Analytics" />
      <BlockStack gap="500">
        {!hasData ? (
          <Card>
            <EmptyState
              heading="No analytics data yet"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>
                Analytics will appear here once your store receives orders.
                Enable Demo Mode in Settings to see sample data on your
                storefront.
              </p>
            </EmptyState>
          </Card>
        ) : (
          <>
            {/* Summary Cards */}
            <Layout>
              <Layout.Section variant="oneHalf">
                <Card>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm" tone="subdued">
                      Total Orders Tracked
                    </Text>
                    <Text as="p" variant="headingXl">
                      {totalOrders}
                    </Text>
                  </BlockStack>
                </Card>
              </Layout.Section>
              <Layout.Section variant="oneHalf">
                <Card>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm" tone="subdued">
                      Products with Sales
                    </Text>
                    <Text as="p" variant="headingXl">
                      {totalProducts}
                    </Text>
                  </BlockStack>
                </Card>
              </Layout.Section>
            </Layout>

            {/* Recent Activity */}
            <Layout>
              <Layout.Section>
                <Card>
                  <BlockStack gap="400">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h2" variant="headingMd">
                        Recent Activity
                      </Text>
                      <Badge tone="info">{`${recentOrders.length} orders`}</Badge>
                    </InlineStack>
                    {recentOrders.length > 0 ? (
                      <DataTable
                        columnContentTypes={["text", "text", "text"]}
                        headings={["Product", "Location", "Time"]}
                        rows={recentOrderRows}
                      />
                    ) : (
                      <Text as="p" tone="subdued">
                        No recent orders to display.
                      </Text>
                    )}
                  </BlockStack>
                </Card>
              </Layout.Section>
            </Layout>

            {/* Top Products */}
            <Layout>
              <Layout.Section>
                <Card>
                  <BlockStack gap="400">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h2" variant="headingMd">
                        Top Products
                      </Text>
                      <Badge tone="success">{`${productStats.length} products`}</Badge>
                    </InlineStack>
                    {productStats.length > 0 ? (
                      <DataTable
                        columnContentTypes={["text", "numeric", "text"]}
                        headings={["Product ID", "Purchases", "Last Purchase"]}
                        rows={productStatsRows}
                      />
                    ) : (
                      <Text as="p" tone="subdued">
                        No product statistics to display.
                      </Text>
                    )}
                  </BlockStack>
                </Card>
              </Layout.Section>
            </Layout>
          </>
        )}
      </BlockStack>
    </Page>
  );
}
