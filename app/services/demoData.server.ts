/**
 * Demo Data Service
 * Generates fake but realistic-looking social proof data for demo mode
 */

// Constants
const DEMO_CITIES: Array<{ city: string; country: string }> = [
  { city: "New York", country: "United States" },
  { city: "London", country: "United Kingdom" },
  { city: "Paris", country: "France" },
  { city: "Tokyo", country: "Japan" },
  { city: "Sydney", country: "Australia" },
  { city: "Toronto", country: "Canada" },
  { city: "Berlin", country: "Germany" },
  { city: "Amsterdam", country: "Netherlands" },
  { city: "Singapore", country: "Singapore" },
  { city: "Dubai", country: "United Arab Emirates" },
  { city: "Stockholm", country: "Sweden" },
  { city: "Mumbai", country: "India" },
  { city: "São Paulo", country: "Brazil" },
  { city: "Melbourne", country: "Australia" },
  { city: "Chicago", country: "United States" },
];

const DEMO_PRODUCTS: Array<{ title: string; image: string }> = [
  {
    title: "Premium Wireless Headphones",
    image: "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-1_large.png",
  },
  {
    title: "Organic Cotton T-Shirt",
    image: "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-2_large.png",
  },
  {
    title: "Stainless Steel Water Bottle",
    image: "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-3_large.png",
  },
  {
    title: "Natural Skincare Set",
    image: "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-4_large.png",
  },
  {
    title: "Minimalist Leather Wallet",
    image: "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-5_large.png",
  },
];

const DEMO_FIRST_NAMES: string[] = [
  "Alex",
  "Jordan",
  "Taylor",
  "Morgan",
  "Casey",
  "Riley",
  "Quinn",
  "Avery",
  "Jamie",
  "Sam",
];

// Helper Functions
function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function generateTimeAgo(): { timeAgo: string; timestamp: string } {
  const random = Math.random();
  let minutesAgo: number;

  if (random < 0.2) {
    minutesAgo = 0;
  } else if (random < 0.5) {
    minutesAgo = Math.floor(Math.random() * 5) + 1;
  } else if (random < 0.8) {
    minutesAgo = Math.floor(Math.random() * 25) + 5;
  } else {
    minutesAgo = (Math.floor(Math.random() * 3) + 1) * 60;
  }

  // Generate ISO timestamp
  const timestamp = new Date(Date.now() - minutesAgo * 60000).toISOString();

  // Generate formatted timeAgo string
  let timeAgo: string;
  if (minutesAgo === 0) {
    timeAgo = "just now";
  } else if (minutesAgo < 60) {
    timeAgo = `${minutesAgo} minute${minutesAgo === 1 ? "" : "s"} ago`;
  } else {
    const hours = Math.floor(minutesAgo / 60);
    timeAgo = `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  return { timeAgo, timestamp };
}

// Main Functions
export interface DemoActivity {
  productTitle: string;
  productImage: string;
  city: string;
  country: string;
  timeAgo: string;
  timestamp: string;
}

export function generateDemoActivity(): DemoActivity {
  const product = getRandomItem(DEMO_PRODUCTS);
  const location = getRandomItem(DEMO_CITIES);
  const { timeAgo, timestamp } = generateTimeAgo();

  return {
    productTitle: product.title,
    productImage: product.image,
    city: location.city,
    country: location.country,
    timeAgo,
    timestamp,
  };
}

export interface DemoCounter {
  count: number;
  timeframe: string;
}

export function generateDemoCounter(productId: string): DemoCounter {
  // Use productId to seed a consistent but seemingly random count
  let hash = 0;
  for (let i = 0; i < productId.length; i++) {
    hash = (hash << 5) - hash + productId.charCodeAt(i);
    hash |= 0;
  }

  // Generate count between 15-150 based on hash
  const baseCount = Math.abs(hash % 136) + 15;

  return {
    count: baseCount,
    timeframe: "in the last 24 hours",
  };
}

export function generateDemoName(): string {
  const name = getRandomItem(DEMO_FIRST_NAMES);
  const location = getRandomItem(DEMO_CITIES);

  return `${name} from ${location.city}`;
}
