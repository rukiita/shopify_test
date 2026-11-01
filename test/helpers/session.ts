import db from "../../app/db.server";

// An offline session for `shop`, so `authenticate.webhook` returns an `admin` client.
// It has no expiry, so the library never tries to refresh it.
export function createOfflineSession(shop: string) {
  return db.session.create({
    data: {
      id: `offline_${shop}`,
      shop,
      state: "",
      isOnline: false,
      accessToken: "test-access-token",
    },
  });
}
