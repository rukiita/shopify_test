import { createHmac, randomUUID } from "node:crypto";
import { testConfig } from "@shopify/shopify-app-react-router/test-helpers";

const {
  apiKey: TEST_API_KEY,
  apiSecretKey: TEST_API_SECRET,
  appUrl: TEST_APP_URL,
} = testConfig();

const base64url = (value: string | Buffer) =>
  Buffer.from(value).toString("base64url");

// A session token as App Bridge sends it from the embedded app: a JWT signed with
// HS256 and the app's secret, so `authenticate.admin` verifies it for real.
export function sessionToken(shop: string, secret = TEST_API_SECRET) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: `https://${shop}/admin`,
      dest: `https://${shop}`,
      aud: TEST_API_KEY,
      sub: "1",
      exp: now + 60,
      nbf: now - 1,
      iat: now - 1,
      jti: randomUUID(),
      sid: randomUUID(),
    }),
  );
  const signature = base64url(
    createHmac("sha256", secret).update(`${header}.${payload}`).digest(),
  );
  return `${header}.${payload}.${signature}`;
}

// A POST from the embedded app to an app route, e.g. `/app/sync`.
export function adminRequest(path: string, shop: string, token?: string) {
  return new Request(new URL(path, TEST_APP_URL), {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}
