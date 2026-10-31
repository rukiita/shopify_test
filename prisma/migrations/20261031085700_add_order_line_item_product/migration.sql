-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "totalPriceMinor" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "paymentGateways" TEXT NOT NULL,
    "customerEmail" TEXT,
    "customerFullName" TEXT,
    "customerAddress" TEXT,
    "tags" TEXT NOT NULL,
    "shopifyCreatedAt" DATETIME NOT NULL,
    "shopifyUpdatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LineItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "title" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    CONSTRAINT "LineItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LineItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tags" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "Order_shop_shopifyCreatedAt_idx" ON "Order"("shop", "shopifyCreatedAt");

-- CreateIndex
CREATE INDEX "LineItem_orderId_idx" ON "LineItem"("orderId");

-- CreateIndex
CREATE INDEX "LineItem_productId_idx" ON "LineItem"("productId");

-- CreateIndex
CREATE INDEX "Product_shop_idx" ON "Product"("shop");
