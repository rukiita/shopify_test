import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { testConfig } from "@shopify/shopify-app-react-router/test-helpers";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

const config = {
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October26,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    expiringOfflineAccessTokens: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
};

// Tests run with the fixed key, secret and app URL from testConfig() (ADR-0006).
// NODE_ENV is checked too: the test secret is public, so a stray SHOPIFY_TESTING
// in production must not make the app accept webhooks signed with it.
// Sessions stay in Prisma, so route tests read and write the test database.
const isTesting =
  Boolean(process.env.SHOPIFY_TESTING) && process.env.NODE_ENV === "test";

const shopify = shopifyApp(
  isTesting
    ? {
        ...config,
        ...testConfig({
          sessionStorage: config.sessionStorage,
          future: config.future,
        }),
      }
    : config,
);

export default shopify;
export const apiVersion = ApiVersion.October26;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
