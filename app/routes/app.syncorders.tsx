import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import { Page, Card, Button, BlockStack, Text, Banner, DataTable } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

const PLACEHOLDER_IMAGE =
  "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-1_large.png";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  // Get shop record
  const shopRecord = await db.shop.findUnique({
    where: { shopDomain: shop },
    include: {
      recentOrders: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  return json({
    shop,
    ordersCount: shopRecord?.recentOrders.length || 0,
    recentOrders: shopRecord?.recentOrders || [],
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  try {
    // Fetch recent orders from Shopify (without protected customer data)
    const response = await admin.graphql(`
      query {
        orders(first: 10, sortKey: CREATED_AT, reverse: true) {
          edges {
            node {
              id
              name
              createdAt
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

    // Log for debugging
    console.log("Orders API response:", JSON.stringify(data, null, 2));

    if (data.errors) {
      console.error("GraphQL errors:", data.errors);
      return json({ success: false, error: data.errors[0]?.message || "GraphQL error" }, { status: 500 });
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
      // City/country not available without Protected Customer Data access
      // Using placeholder values for now
      const city = "Customer";
      const country = "Location";

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

    return json({ success: true, syncedCount, totalOrders: orders.length });
  } catch (error) {
    console.error("Error syncing orders:", error);
    return json({ success: false, error: String(error) }, { status: 500 });
  }
};

export default function SyncOrdersPage() {
  const { shop, ordersCount, recentOrders } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isLoading = navigation.state === "submitting";

  const handleSync = () => {
    submit({}, { method: "post" });
  };

  const rows = recentOrders.map((order: any) => [
    order.productTitle,
    order.city,
    order.country,
    new Date(order.createdAt).toLocaleDateString(),
  ]);

  return (
    <Page>
      <TitleBar title="Sync Orders" />
      <BlockStack gap="500">
        <Banner tone="info">
          <p>
            This page manually syncs orders from Shopify since webhook access requires Protected Customer Data approval.
            Use this to test if order tracking works.
          </p>
        </Banner>

        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Order Sync Status
            </Text>
            <Text as="p" variant="bodyMd">
              Shop: <strong>{shop}</strong>
            </Text>
            <Text as="p" variant="bodyMd">
              Orders tracked: <strong>{ordersCount}</strong>
            </Text>
            <Button variant="primary" onClick={handleSync} loading={isLoading}>
              Sync Orders Now
            </Button>
          </BlockStack>
        </Card>

        {recentOrders.length > 0 && (
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Tracked Orders
              </Text>
              <DataTable
                columnContentTypes={["text", "text", "text", "text"]}
                headings={["Product", "City", "Country", "Date"]}
                rows={rows}
              />
            </BlockStack>
          </Card>
        )}
      </BlockStack>
    </Page>
  );
}
