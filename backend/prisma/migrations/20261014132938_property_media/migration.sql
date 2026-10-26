-- CreateTable
CREATE TABLE "PropertyMedia" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT,
    "url" TEXT,
    "provider" TEXT NOT NULL,
    "embedUrl" TEXT,
    "storageKey" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PropertyMedia_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PropertyMedia_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PropertyMedia_storageKey_key" ON "PropertyMedia"("storageKey");

-- CreateIndex
CREATE INDEX "PropertyMedia_propertyId_kind_sortOrder_idx" ON "PropertyMedia"("propertyId", "kind", "sortOrder");
