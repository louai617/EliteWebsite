-- CreateTable
CREATE TABLE "TaskEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" TEXT NOT NULL,
    "fromValue" TEXT,
    "toValue" TEXT,
    "message" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyTaskTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "taskType" TEXT NOT NULL DEFAULT 'GENERAL',
    "activityType" TEXT,
    "targetCount" INTEGER NOT NULL DEFAULT 1,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "dueHour" INTEGER NOT NULL DEFAULT 18,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "assigneeId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailyTaskTemplate_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "agentId" TEXT NOT NULL,
    "loggedById" TEXT,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "businessDate" TEXT NOT NULL,
    "outcome" TEXT,
    "notes" TEXT,
    "durationMin" INTEGER,
    "dedupeKey" TEXT,
    "taskId" TEXT,
    "leadId" TEXT,
    "clientId" TEXT,
    "propertyId" TEXT,
    "viewingId" TEXT,
    "dealId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentActivity_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AgentActivity_loggedById_fkey" FOREIGN KEY ("loggedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AgentActivity_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AgentActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AgentActivity_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AgentActivity_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AgentActivity_viewingId_fkey" FOREIGN KEY ("viewingId") REFERENCES "Viewing" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AgentActivity_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "callsMade" INTEGER NOT NULL DEFAULT 0,
    "leadsReceived" INTEGER NOT NULL DEFAULT 0,
    "leadsAnswered" INTEGER NOT NULL DEFAULT 0,
    "leadsConverted" INTEGER NOT NULL DEFAULT 0,
    "propertiesPosted" INTEGER NOT NULL DEFAULT 0,
    "propertiesReposted" INTEGER NOT NULL DEFAULT 0,
    "newListings" INTEGER NOT NULL DEFAULT 0,
    "viewingsCompleted" INTEGER NOT NULL DEFAULT 0,
    "followUpsCompleted" INTEGER NOT NULL DEFAULT 0,
    "qualificationsDone" INTEGER NOT NULL DEFAULT 0,
    "tasksCompleted" INTEGER NOT NULL DEFAULT 0,
    "tasksOutstanding" INTEGER NOT NULL DEFAULT 0,
    "tasksOverdue" INTEGER NOT NULL DEFAULT 0,
    "dailyTasksAssigned" INTEGER NOT NULL DEFAULT 0,
    "dailyTasksCompleted" INTEGER NOT NULL DEFAULT 0,
    "avgLeadResponseMinutes" REAL,
    "avgTaskCompletionHours" REAL,
    "score" REAL,
    "scoreBreakdown" TEXT,
    "summary" TEXT,
    "blockers" TEXT,
    "submittedAt" DATETIME,
    "finalizedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailyReport_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScoringRule" (
    "metric" TEXT NOT NULL PRIMARY KEY,
    "points" REAL NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SystemJob" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "details" TEXT,
    "error" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME
);

-- CreateTable
CREATE TABLE "ExternalListing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "propertyId" TEXT,
    "sourceUrl" TEXT,
    "checksum" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "rawPayload" TEXT,
    "firstImportedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastImportedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRunId" TEXT,
    CONSTRAINT "ExternalListing_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "trigger" TEXT NOT NULL,
    "dryRun" BOOLEAN NOT NULL DEFAULT false,
    "total" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "unchanged" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedById" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    CONSTRAINT "ImportRun_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "externalId" TEXT,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "propertyId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportRecord_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ImportRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "ownerId" TEXT,
    "agentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Property_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Property_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Property" ("agentId", "area", "areaSqm", "bathrooms", "bedrooms", "billsIncluded", "buildingName", "buildingNumber", "city", "country", "createdAt", "currency", "description", "externalUrl", "floor", "furnishing", "googleMapsUrl", "hasBalcony", "hasBbq", "hasCentralAc", "hasGarden", "hasGym", "hasInternet", "hasMaidRoom", "hasMarinaView", "hasPool", "hasSeaView", "hasSecurity", "id", "isFeatured", "latitude", "longitude", "ownerId", "parkingSpaces", "price", "propertyFinderUrl", "purpose", "reference", "seoDescription", "seoTitle", "status", "street", "title", "tower", "type", "updatedAt", "yearBuilt") SELECT "agentId", "area", "areaSqm", "bathrooms", "bedrooms", "billsIncluded", "buildingName", "buildingNumber", "city", "country", "createdAt", "currency", "description", "externalUrl", "floor", "furnishing", "googleMapsUrl", "hasBalcony", "hasBbq", "hasCentralAc", "hasGarden", "hasGym", "hasInternet", "hasMaidRoom", "hasMarinaView", "hasPool", "hasSeaView", "hasSecurity", "id", "isFeatured", "latitude", "longitude", "ownerId", "parkingSpaces", "price", "propertyFinderUrl", "purpose", "reference", "seoDescription", "seoTitle", "status", "street", "title", "tower", "type", "updatedAt", "yearBuilt" FROM "Property";
DROP TABLE "Property";
ALTER TABLE "new_Property" RENAME TO "Property";
CREATE UNIQUE INDEX "Property_reference_key" ON "Property"("reference");
CREATE INDEX "Property_status_idx" ON "Property"("status");
CREATE INDEX "Property_category_subcategory_status_idx" ON "Property"("category", "subcategory", "status");
CREATE INDEX "Property_purpose_status_idx" ON "Property"("purpose", "status");
CREATE INDEX "Property_type_idx" ON "Property"("type");
CREATE INDEX "Property_area_idx" ON "Property"("area");
CREATE INDEX "Property_price_idx" ON "Property"("price");
CREATE INDEX "Property_bedrooms_idx" ON "Property"("bedrooms");
CREATE INDEX "Property_agentId_idx" ON "Property"("agentId");
CREATE INDEX "Property_ownerId_idx" ON "Property"("ownerId");
CREATE INDEX "Property_createdAt_idx" ON "Property"("createdAt");
CREATE INDEX "Property_title_idx" ON "Property"("title");
CREATE TABLE "new_Settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "companyName" TEXT NOT NULL DEFAULT 'ELITE Real Estate',
    "defaultCurrency" TEXT NOT NULL DEFAULT 'QAR',
    "saleCommissionPercent" REAL NOT NULL DEFAULT 2,
    "rentalCommissionPercent" REAL NOT NULL DEFAULT 8.33,
    "agentSharePercent" REAL NOT NULL DEFAULT 40,
    "leadResponseSlaMinutes" INTEGER NOT NULL DEFAULT 60,
    "autoLeadResponseTasks" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Settings" ("agentSharePercent", "companyName", "defaultCurrency", "id", "rentalCommissionPercent", "saleCommissionPercent", "updatedAt") SELECT "agentSharePercent", "companyName", "defaultCurrency", "id", "rentalCommissionPercent", "saleCommissionPercent", "updatedAt" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'GENERAL',
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "dueDate" DATETIME,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "clientVisible" BOOLEAN NOT NULL DEFAULT false,
    "dailyDate" TEXT,
    "templateId" TEXT,
    "targetCount" INTEGER,
    "autoKey" TEXT,
    "assigneeId" TEXT,
    "createdById" TEXT,
    "assignedById" TEXT,
    "viewingId" TEXT,
    "leadId" TEXT,
    "clientId" TEXT,
    "propertyId" TEXT,
    "dealId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DailyTaskTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_viewingId_fkey" FOREIGN KEY ("viewingId") REFERENCES "Viewing" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("assigneeId", "clientId", "completedAt", "createdAt", "createdById", "dealId", "description", "dueDate", "id", "leadId", "priority", "propertyId", "status", "title", "updatedAt") SELECT "assigneeId", "clientId", "completedAt", "createdAt", "createdById", "dealId", "description", "dueDate", "id", "leadId", "priority", "propertyId", "status", "title", "updatedAt" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE UNIQUE INDEX "Task_autoKey_key" ON "Task"("autoKey");
CREATE INDEX "Task_assigneeId_status_idx" ON "Task"("assigneeId", "status");
CREATE INDEX "Task_assigneeId_dailyDate_idx" ON "Task"("assigneeId", "dailyDate");
CREATE INDEX "Task_status_dueDate_idx" ON "Task"("status", "dueDate");
CREATE INDEX "Task_type_idx" ON "Task"("type");
CREATE INDEX "Task_viewingId_idx" ON "Task"("viewingId");
CREATE INDEX "Task_leadId_idx" ON "Task"("leadId");
CREATE INDEX "Task_clientId_idx" ON "Task"("clientId");
CREATE INDEX "Task_propertyId_idx" ON "Task"("propertyId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "phone" TEXT,
    "role" TEXT NOT NULL DEFAULT 'AGENT',
    "avatarUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" DATETIME,
    "clientId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("avatarUrl", "createdAt", "email", "id", "isActive", "lastLoginAt", "name", "passwordHash", "phone", "role", "updatedAt") SELECT "avatarUrl", "createdAt", "email", "id", "isActive", "lastLoginAt", "name", "passwordHash", "phone", "role", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_clientId_key" ON "User"("clientId");
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "TaskEvent_taskId_createdAt_idx" ON "TaskEvent"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "DailyTaskTemplate_isActive_idx" ON "DailyTaskTemplate"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AgentActivity_dedupeKey_key" ON "AgentActivity"("dedupeKey");

-- CreateIndex
CREATE INDEX "AgentActivity_agentId_businessDate_idx" ON "AgentActivity"("agentId", "businessDate");

-- CreateIndex
CREATE INDEX "AgentActivity_businessDate_type_idx" ON "AgentActivity"("businessDate", "type");

-- CreateIndex
CREATE INDEX "AgentActivity_leadId_idx" ON "AgentActivity"("leadId");

-- CreateIndex
CREATE INDEX "AgentActivity_propertyId_idx" ON "AgentActivity"("propertyId");

-- CreateIndex
CREATE INDEX "DailyReport_date_idx" ON "DailyReport"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyReport_agentId_date_key" ON "DailyReport"("agentId", "date");

-- CreateIndex
CREATE INDEX "ExternalListing_propertyId_idx" ON "ExternalListing"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalListing_source_externalId_key" ON "ExternalListing"("source", "externalId");

-- CreateIndex
CREATE INDEX "ImportRun_source_startedAt_idx" ON "ImportRun"("source", "startedAt");

-- CreateIndex
CREATE INDEX "ImportRecord_runId_status_idx" ON "ImportRecord"("runId", "status");

-- ───────────── Data backfill (existing records are kept; only new columns are filled) ─────────────

-- Property hierarchy: derive Residential/Commercial from the existing type. Everything starts as
-- PRIVATE (the column default); staff can reclassify company-owned listings afterwards.
UPDATE "Property" SET "category" = 'COMMERCIAL' WHERE "type" IN ('OFFICE', 'SHOP', 'WAREHOUSE');

-- Task tracker: classify existing tasks by what they are linked to.
UPDATE "Task" SET "type" = 'LEAD_FOLLOW_UP' WHERE "type" = 'GENERAL' AND "leadId" IS NOT NULL;
UPDATE "Task" SET "type" = 'CLIENT_FOLLOW_UP' WHERE "type" = 'GENERAL' AND "clientId" IS NOT NULL;
UPDATE "Task" SET "startedAt" = "updatedAt" WHERE "status" = 'IN_PROGRESS' AND "startedAt" IS NULL;
UPDATE "Task" SET "assignedById" = "createdById" WHERE "assigneeId" IS NOT NULL AND "assignedById" IS NULL;

-- Task history: every existing task gets its creation event.
INSERT INTO "TaskEvent" ("id", "taskId", "actorId", "type", "message", "createdAt")
SELECT 'mig' || "id", "id", "createdById", 'CREATED', 'Created before task history was recorded', "createdAt" FROM "Task";
