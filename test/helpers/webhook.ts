import { createHmac, randomUUID } from "node:crypto";
import { testConfig } from "@shopify/shopify-app-react-router/test-helpers";
import { apiVersion } from "../../app/shopify.server";

const { apiSecretKey: TEST_API_SECRET, appUrl: TEST_APP_URL } = testConfig();

interface WebhookRequestOptions {
  /** Route path, e.g. `/webhooks/app/uninstalled` */
  path: string;
  /** Topic as Shopify sends it, e.g. `app/uninstalled` */
  topic: string;
  shop: string;
  body: unknown;
  /** Defaults to the secret `testConfig()` uses. Pass another one to test a bad signature */
  secret?: string;
}

// Builds a webhook request the way Shopify sends it: the raw body signed with
// HMAC-SHA256 in `X-Shopify-Hmac-Sha256`, so `authenticate.webhook` verifies it for real.
export function signedWebhookRequest({
  path,
  topic,
  shop,
  body,
  secret = TEST_API_SECRET,
}: WebhookRequestOptions) {
  const rawBody = JSON.stringify(body);
  const hmac = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");

  return new Request(new URL(path, TEST_APP_URL), {
    method: "POST",
    body: rawBody,
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Hmac-Sha256": hmac,
      "X-Shopify-Topic": topic,
      "X-Shopify-Shop-Domain": shop,
      "X-Shopify-API-Version": apiVersion,
      "X-Shopify-Webhook-Id": randomUUID(),
    },
  });
}
