-- Products stored before this migration get 0 (1970-01-01T00:00:00Z) as their
-- shopifyUpdatedAt. It is older than any fetched updatedAt, so the next ingestion
-- of an order with the product overwrites the row, as before.
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "shopifyUpdatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Product" ("id", "shop", "tags", "title", "shopifyUpdatedAt") SELECT "id", "shop", "tags", "title", 0 FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE INDEX "Product_shop_idx" ON "Product"("shop");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
