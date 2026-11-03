-- AlterTable
ALTER TABLE "Client" ADD COLUMN "preferredAreas" TEXT;
ALTER TABLE "Client" ADD COLUMN "preferredBedrooms" INTEGER;
ALTER TABLE "Client" ADD COLUMN "preferredPurpose" TEXT;
ALTER TABLE "Client" ADD COLUMN "preferredTypes" TEXT;

-- AlterTable
ALTER TABLE "PropertyInterest" ADD COLUMN "priceAtSave" INTEGER;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Property" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'RESIDENTIAL',
    "subcategory" TEXT NOT NULL DEFAULT 'PRIVATE',
    "purpose" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "price" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'QAR',
    "areaSqm" REAL,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "floor" INTEGER,
    "buildingNumber" TEXT,
    "tower" TEXT,
    "yearBuilt" INTEGER,
    "country" TEXT NOT NULL DEFAULT 'Qatar',
    "city" TEXT NOT NULL DEFAULT 'Doha',
    "area" TEXT NOT NULL,
    "street" TEXT,
    "buildingName" TEXT,
    "googleMapsUrl" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "furnishing" TEXT,
    "description" TEXT,
    "parkingSpaces" INTEGER NOT NULL DEFAULT 0,
    "hasBalcony" BOOLEAN NOT NULL DEFAULT false,
    "hasMaidRoom" BOOLEAN NOT NULL DEFAULT false,
    "hasPool" BOOLEAN NOT NULL DEFAULT false,
    "hasGym" BOOLEAN NOT NULL DEFAULT false,
    "hasSeaView" BOOLEAN NOT NULL DEFAULT false,
    "hasMarinaView" BOOLEAN NOT NULL DEFAULT false,
    "hasGarden" BOOLEAN NOT NULL DEFAULT false,
    "hasBbq" BOOLEAN NOT NULL DEFAULT false,
    "hasSecurity" BOOLEAN NOT NULL DEFAULT false,
    "hasCentralAc" BOOLEAN NOT NULL DEFAULT false,
    "hasInternet" BOOLEAN NOT NULL DEFAULT false,
    "billsIncluded" BOOLEAN NOT NULL DEFAULT false,
    "propertyFinderUrl" TEXT,
    "externalUrl" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "lastPostedAt" DATETIME,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "websitePublished" BOOLEAN NOT NULL DEFAULT true,
    "websitePublishedAt" DATETIME,
    "isExclusive" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "titleAr" TEXT,
    "descriptionAr" TEXT,
    "completionStatus" TEXT NOT NULL DEFAULT 'READY',
    "ownershipType" TEXT,
    "availableFrom" DATETIME,
    "handover" TEXT,
    "developer" TEXT,
    "serviceChargeSqm" REAL,
    "plotSqm" REAL,
    "totalFloors" INTEGER,
    "amenities" TEXT,
    "highlights" TEXT,
    "nearby" TEXT,
    "paymentPlan" TEXT,
    "ownerId" TEXT,
    "agentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Property_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Property_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Property" ("agentId", "area", "areaSqm", "bathrooms", "bedrooms", "billsIncluded", "buildingName", "buildingNumber", "category", "city", "country", "createdAt", "currency", "description", "externalUrl", "floor", "furnishing", "googleMapsUrl", "hasBalcony", "hasBbq", "hasCentralAc", "hasGarden", "hasGym", "hasInternet", "hasMaidRoom", "hasMarinaView", "hasPool", "hasSeaView", "hasSecurity", "id", "isFeatured", "lastPostedAt", "latitude", "longitude", "ownerId", "parkingSpaces", "price", "propertyFinderUrl", "purpose", "reference", "seoDescription", "seoTitle", "status", "street", "subcategory", "title", "tower", "type", "updatedAt", "yearBuilt") SELECT "agentId", "area", "areaSqm", "bathrooms", "bedrooms", "billsIncluded", "buildingName", "buildingNumber", "category", "city", "country", "createdAt", "currency", "description", "externalUrl", "floor", "furnishing", "googleMapsUrl", "hasBalcony", "hasBbq", "hasCentralAc", "hasGarden", "hasGym", "hasInternet", "hasMaidRoom", "hasMarinaView", "hasPool", "hasSeaView", "hasSecurity", "id", "isFeatured", "lastPostedAt", "latitude", "longitude", "ownerId", "parkingSpaces", "price", "propertyFinderUrl", "purpose", "reference", "seoDescription", "seoTitle", "status", "street", "subcategory", "title", "tower", "type", "updatedAt", "yearBuilt" FROM "Property";
DROP TABLE "Property";
ALTER TABLE "new_Property" RENAME TO "Property";
CREATE UNIQUE INDEX "Property_reference_key" ON "Property"("reference");
CREATE INDEX "Property_status_idx" ON "Property"("status");
CREATE INDEX "Property_category_subcategory_status_idx" ON "Property"("category", "subcategory", "status");
CREATE INDEX "Property_websitePublished_status_idx" ON "Property"("websitePublished", "status");
CREATE INDEX "Property_purpose_status_idx" ON "Property"("purpose", "status");
CREATE INDEX "Property_type_idx" ON "Property"("type");
CREATE INDEX "Property_area_idx" ON "Property"("area");
CREATE INDEX "Property_price_idx" ON "Property"("price");
CREATE INDEX "Property_bedrooms_idx" ON "Property"("bedrooms");
CREATE INDEX "Property_agentId_idx" ON "Property"("agentId");
CREATE INDEX "Property_ownerId_idx" ON "Property"("ownerId");
CREATE INDEX "Property_createdAt_idx" ON "Property"("createdAt");
CREATE INDEX "Property_title_idx" ON "Property"("title");
CREATE TABLE "new_Viewing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "leadId" TEXT,
    "clientId" TEXT,
    "agentId" TEXT,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "bookedByClient" BOOLEAN NOT NULL DEFAULT false,
    "clientNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Viewing_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Viewing_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Viewing_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Viewing_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Viewing" ("agentId", "clientId", "createdAt", "endsAt", "id", "leadId", "notes", "propertyId", "startsAt", "status", "updatedAt") SELECT "agentId", "clientId", "createdAt", "endsAt", "id", "leadId", "notes", "propertyId", "startsAt", "status", "updatedAt" FROM "Viewing";
DROP TABLE "Viewing";
ALTER TABLE "new_Viewing" RENAME TO "Viewing";
CREATE INDEX "Viewing_startsAt_idx" ON "Viewing"("startsAt");
CREATE INDEX "Viewing_agentId_startsAt_idx" ON "Viewing"("agentId", "startsAt");
CREATE INDEX "Viewing_status_idx" ON "Viewing"("status");
CREATE INDEX "Viewing_propertyId_idx" ON "Viewing"("propertyId");
CREATE INDEX "Viewing_leadId_idx" ON "Viewing"("leadId");
CREATE INDEX "Viewing_clientId_idx" ON "Viewing"("clientId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Backfill (data-preserving): existing listings count as published since they were created;
-- existing shortlists remember today's price so price-drop alerts start from now.
UPDATE "Property" SET "websitePublishedAt" = "createdAt" WHERE "websitePublished" = 1 AND "websitePublishedAt" IS NULL;
UPDATE "PropertyInterest" SET "priceAtSave" = (SELECT "price" FROM "Property" WHERE "Property"."id" = "PropertyInterest"."propertyId") WHERE "priceAtSave" IS NULL;
