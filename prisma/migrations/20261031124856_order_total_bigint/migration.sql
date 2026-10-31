/*
  Warnings:

  - You are about to alter the column `totalPriceMinor` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "totalPriceMinor" BIGINT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "paymentGateways" TEXT NOT NULL,
    "customerEmail" TEXT,
    "customerFullName" TEXT,
    "customerAddress" TEXT,
    "tags" TEXT NOT NULL,
    "shopifyCreatedAt" DATETIME NOT NULL,
    "shopifyUpdatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Order" ("currencyCode", "customerAddress", "customerEmail", "customerFullName", "id", "name", "number", "paymentGateways", "shop", "shopifyCreatedAt", "shopifyUpdatedAt", "tags", "totalPriceMinor") SELECT "currencyCode", "customerAddress", "customerEmail", "customerFullName", "id", "name", "number", "paymentGateways", "shop", "shopifyCreatedAt", "shopifyUpdatedAt", "tags", "totalPriceMinor" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE INDEX "Order_shop_shopifyCreatedAt_idx" ON "Order"("shop", "shopifyCreatedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
