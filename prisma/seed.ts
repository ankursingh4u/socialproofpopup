import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_PRODUCTS = [
  { title: "Classic Cotton T-Shirt", image: "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-1_large.png" },
  { title: "Premium Wireless Earbuds", image: "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-2_large.png" },
  { title: "Organic Face Cream", image: "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-3_large.png" },
  { title: "Running Shoes Pro", image: "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-4_large.png" },
  { title: "Stainless Steel Watch", image: "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-5_large.png" },
];

const DEMO_LOCATIONS = [
  { city: "New York", country: "United States" },
  { city: "Los Angeles", country: "United States" },
  { city: "Chicago", country: "United States" },
  { city: "Houston", country: "United States" },
  { city: "Miami", country: "United States" },
  { city: "London", country: "United Kingdom" },
  { city: "Paris", country: "France" },
  { city: "Tokyo", country: "Japan" },
  { city: "Sydney", country: "Australia" },
  { city: "Toronto", country: "Canada" },
];

async function seed() {
  console.log("Seeding database...");

  // Get existing shops
  const shops = await prisma.shop.findMany();

  if (shops.length === 0) {
    console.log("No shops found in database. Seed will run after a shop is created (when app is installed).");
    return;
  }

  for (const shop of shops) {
    console.log(`Seeding data for shop: ${shop.shopDomain}`);

    // Create 20 recent orders with staggered timestamps
    for (let i = 0; i < 20; i++) {
      const product = DEMO_PRODUCTS[i % DEMO_PRODUCTS.length];
      const location = DEMO_LOCATIONS[i % DEMO_LOCATIONS.length];

      await prisma.recentOrder.create({
        data: {
          shopId: shop.id,
          orderId: `demo-order-${Date.now()}-${i}`,
          productTitle: product.title,
          productImage: product.image,
          city: location.city,
          country: location.country,
          createdAt: new Date(Date.now() - i * 5 * 60000), // 5 min apart
        },
      });
    }

    // Create product stats
    for (let i = 0; i < DEMO_PRODUCTS.length; i++) {
      await prisma.productStats.upsert({
        where: {
          shopId_productId: {
            shopId: shop.id,
            productId: `demo-product-${i + 1}`,
          },
        },
        update: {
          purchaseCount: Math.floor(Math.random() * 100) + 15,
          lastPurchaseAt: new Date(),
        },
        create: {
          shopId: shop.id,
          productId: `demo-product-${i + 1}`,
          purchaseCount: Math.floor(Math.random() * 100) + 15,
          lastPurchaseAt: new Date(),
        },
      });
    }

    console.log(`Created 20 recent orders and ${DEMO_PRODUCTS.length} product stats for ${shop.shopDomain}`);
  }

  console.log("Seed completed!");
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
