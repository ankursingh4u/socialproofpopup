/**
 * Social Proof Metafields Server Utilities
 * GraphQL operations for reading/writing popup configurations to Shopify metafields
 */

// Define a compatible interface for the admin client
interface AdminClient {
  graphql: (query: string, variables?: Record<string, unknown>) => Promise<Response>;
}

// Metafield constants
export const METAFIELD_NAMESPACE = "social_proof";
export const METAFIELD_KEY = "config";
export const METAFIELD_TYPE = "json";

/**
 * Social Proof Configuration Type
 */
export interface SocialProofConfig {
  popupEnabled: boolean;
  counterEnabled: boolean;
  demoMode: boolean;
  popupPosition: "BOTTOM_LEFT" | "BOTTOM_RIGHT" | "TOP_LEFT" | "TOP_RIGHT";
  popupDelay: number;
  displayDuration: number;
  showOnPages: string[];
  // Demo data for showing popups (no API calls needed)
  demoActivities: DemoActivity[];
  version: string;
}

export interface DemoActivity {
  id: string;
  productTitle: string;
  productImage: string;
  city: string;
  timeAgo: string;
}

export const DEFAULT_CONFIG: SocialProofConfig = {
  popupEnabled: true,
  counterEnabled: true,
  demoMode: true,
  popupPosition: "BOTTOM_LEFT",
  popupDelay: 5,
  displayDuration: 4,
  showOnPages: ["product", "collection", "home", "cart"],
  demoActivities: [
    {
      id: "demo-1",
      productTitle: "Classic Cotton T-Shirt",
      productImage: "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-1_large.png",
      city: "New York",
      timeAgo: "2 minutes ago",
    },
    {
      id: "demo-2",
      productTitle: "Premium Wireless Earbuds",
      productImage: "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-2_large.png",
      city: "Los Angeles",
      timeAgo: "5 minutes ago",
    },
    {
      id: "demo-3",
      productTitle: "Organic Face Cream",
      productImage: "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-3_large.png",
      city: "Chicago",
      timeAgo: "8 minutes ago",
    },
    {
      id: "demo-4",
      productTitle: "Running Shoes Pro",
      productImage: "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-4_large.png",
      city: "Houston",
      timeAgo: "12 minutes ago",
    },
    {
      id: "demo-5",
      productTitle: "Stainless Steel Watch",
      productImage: "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-5_large.png",
      city: "Miami",
      timeAgo: "15 minutes ago",
    },
  ],
  version: "1.0.0",
};

/**
 * GraphQL Queries
 */

// Query to get shop metafield
const GET_CONFIG_QUERY = `#graphql
  query GetSocialProofConfig {
    shop {
      id
      metafield(namespace: "social_proof", key: "config") {
        id
        namespace
        key
        value
        type
      }
    }
  }
`;

// Mutation to set/update shop metafield
const SET_CONFIG_MUTATION = `#graphql
  mutation SetSocialProofConfig($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        id
        namespace
        key
        value
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// Query to get shop ID
const GET_SHOP_ID_QUERY = `#graphql
  query GetShopId {
    shop {
      id
    }
  }
`;

/**
 * Type definitions for GraphQL responses
 */
interface ShopMetafieldResponse {
  shop: {
    id: string;
    metafield: {
      id: string;
      namespace: string;
      key: string;
      value: string;
      type: string;
    } | null;
  };
}

interface MetafieldsSetResponse {
  metafieldsSet: {
    metafields: Array<{
      id: string;
      namespace: string;
      key: string;
      value: string;
    }>;
    userErrors: Array<{
      field: string[];
      message: string;
    }>;
  };
}

interface ShopIdResponse {
  shop: {
    id: string;
  };
}

/**
 * Get the shop's GID for metafield operations
 */
async function getShopId(admin: AdminClient): Promise<string> {
  const response = await admin.graphql(GET_SHOP_ID_QUERY);
  const json = await response.json() as { errors?: Array<{ message: string }>; data?: ShopIdResponse };

  if (json.errors) {
    console.error("GraphQL errors when fetching shop ID:", json.errors);
    throw new Error(
      json.errors.map((e) => e.message).join(", ") || "Failed to fetch shop ID"
    );
  }

  const data = json.data;
  if (!data?.shop?.id) {
    throw new Error("Failed to get shop ID from response");
  }

  return data.shop.id;
}

/**
 * Read social proof configuration from metafields
 * Returns the stored config or default if none exists
 */
export async function getConfig(admin: AdminClient): Promise<SocialProofConfig> {
  try {
    const response = await admin.graphql(GET_CONFIG_QUERY);
    const json = await response.json() as { errors?: Array<{ message: string }>; data?: ShopMetafieldResponse };

    if (json.errors) {
      console.error("GraphQL errors when fetching config:", json.errors);
      return DEFAULT_CONFIG;
    }

    const data = json.data;

    if (data?.shop?.metafield?.value) {
      try {
        const config = JSON.parse(data.shop.metafield.value) as SocialProofConfig;
        // Merge with defaults to ensure all fields exist
        return {
          ...DEFAULT_CONFIG,
          ...config,
        };
      } catch (parseError) {
        console.error("Error parsing config JSON:", parseError);
        return DEFAULT_CONFIG;
      }
    }

    return DEFAULT_CONFIG;
  } catch (error) {
    console.error("Error reading config:", error);
    return DEFAULT_CONFIG;
  }
}

/**
 * Write social proof configuration to metafields
 */
export async function setConfig(
  admin: AdminClient,
  config: Partial<SocialProofConfig>
): Promise<{ success: boolean; errors?: string[] }> {
  try {
    // Get current config and merge with updates
    const currentConfig = await getConfig(admin);
    const updatedConfig: SocialProofConfig = {
      ...currentConfig,
      ...config,
      version: DEFAULT_CONFIG.version,
    };

    const shopId = await getShopId(admin);

    const response = await admin.graphql(SET_CONFIG_MUTATION, {
      variables: {
        metafields: [
          {
            ownerId: shopId,
            namespace: METAFIELD_NAMESPACE,
            key: METAFIELD_KEY,
            type: METAFIELD_TYPE,
            value: JSON.stringify(updatedConfig),
          },
        ],
      },
    });

    const json = await response.json() as { errors?: Array<{ message: string }>; data?: MetafieldsSetResponse };

    if (json.errors) {
      console.error("GraphQL errors when setting config:", json.errors);
      return {
        success: false,
        errors: json.errors.map((e) => e.message),
      };
    }

    const data = json.data;

    if (data?.metafieldsSet?.userErrors && data.metafieldsSet.userErrors.length > 0) {
      return {
        success: false,
        errors: data.metafieldsSet.userErrors.map((e) => e.message),
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Error writing config:", error);
    return {
      success: false,
      errors: [error instanceof Error ? error.message : "Unknown error"],
    };
  }
}

/**
 * Update specific settings without overwriting others
 */
export async function updateSettings(
  admin: AdminClient,
  settings: Partial<Omit<SocialProofConfig, "version" | "demoActivities">>
): Promise<{ success: boolean; errors?: string[] }> {
  return setConfig(admin, settings);
}

/**
 * GraphQL mutation to create metafield definition
 */
const CREATE_METAFIELD_DEFINITION = `#graphql
  mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $definition) {
      createdDefinition {
        id
        name
        namespace
        key
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

interface MetafieldDefinitionCreateResponse {
  metafieldDefinitionCreate: {
    createdDefinition: {
      id: string;
      name: string;
      namespace: string;
      key: string;
    } | null;
    userErrors: Array<{
      field: string[];
      message: string;
      code: string;
    }>;
  };
}

/**
 * Ensure the metafield definition exists with storefront access enabled.
 * This is required for Liquid templates to access the metafield via shop.metafields.
 * Should be called on app authentication/installation.
 */
export async function ensureMetafieldDefinition(admin: AdminClient): Promise<void> {
  try {
    const response = await admin.graphql(CREATE_METAFIELD_DEFINITION, {
      variables: {
        definition: {
          name: "Social Proof Config",
          namespace: METAFIELD_NAMESPACE,
          key: METAFIELD_KEY,
          type: METAFIELD_TYPE,
          ownerType: "SHOP",
          access: {
            storefront: "PUBLIC_READ"
          }
        }
      }
    });

    const json = await response.json() as { errors?: Array<{ message: string }>; data?: MetafieldDefinitionCreateResponse };

    if (json.errors) {
      console.error("GraphQL errors when creating metafield definition:", json.errors);
      return;
    }

    const data = json.data;
    const userErrors = data?.metafieldDefinitionCreate?.userErrors;

    if (userErrors && userErrors.length > 0) {
      // TAKEN error code means definition already exists - this is expected and fine
      const alreadyExists = userErrors.some(e => e.code === "TAKEN");
      if (!alreadyExists) {
        console.error("User errors when creating metafield definition:", userErrors);
      }
      return;
    }

    if (data?.metafieldDefinitionCreate?.createdDefinition) {
      console.log("Metafield definition created successfully:", data.metafieldDefinitionCreate.createdDefinition);
    }
  } catch (error) {
    console.error("Error ensuring metafield definition:", error);
  }
}
