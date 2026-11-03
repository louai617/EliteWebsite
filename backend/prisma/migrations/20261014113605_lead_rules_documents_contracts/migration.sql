-- Lead rules, documents, reservations, contracts and e-mail OTP.
-- Data-preserving: every row is copied; deal statuses are mapped, nothing is deleted.
--   Deal: NEGOTIATION / CONTRACT_PENDING / CONTRACT_SIGNED -> PENDING_CONTRACT
--         CLOSED_WON -> CLOSED, CLOSED_LOST -> CANCELLED
--   Lead.assignedAt: the 24-hour reassignment clock starts when this migration runs, so
--   existing NEW leads are not all moved to the admin on deploy.

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "assignedAt" DATETIME;
ALTER TABLE "Lead" ADD COLUMN "autoReassignedAt" DATETIME;
ALTER TABLE "Lead" ADD COLUMN "lostReason" TEXT;

-- AlterTable
ALTER TABLE "Property" ADD COLUMN "bookingDeposit" INTEGER;

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "title" TEXT,
    "number" TEXT,
    "expiresAt" DATETIME,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "leadId" TEXT,
    "clientId" TEXT,
    "dealId" TEXT,
    "reservationId" TEXT,
    "uploadedById" TEXT,
    "uploadedByClient" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Document_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Document_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Document_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Document_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeadPassRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT,
    "decidedById" TEXT,
    "decidedAt" DATETIME,
    "decisionNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeadPassRequest_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LeadPassRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LeadPassRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME NOT NULL,
    "verifiedAt" DATETIME,
    "resetTokenHash" TEXT,
    "consumedAt" DATETIME,
    "requestedIp" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OtpCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "agentId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'QAR',
    "method" TEXT NOT NULL DEFAULT 'FAWRAN',
    "status" TEXT NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "payerName" TEXT,
    "paymentReference" TEXT,
    "clientNote" TEXT,
    "submittedAt" DATETIME,
    "verifiedById" TEXT,
    "verifiedAt" DATETIME,
    "cancelReason" TEXT,
    "payBy" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Reservation_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Reservation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Reservation_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Reservation_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContractTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "dealType" TEXT,
    "body" TEXT NOT NULL,
    "fields" TEXT NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContractTemplate_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "templateId" TEXT,
    "templateName" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "values" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Contract_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Contract_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ContractTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Contract_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Deal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "clientId" TEXT,
    "ownerId" TEXT,
    "agentId" TEXT,
    "leadId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_CONTRACT',
    "amount" INTEGER NOT NULL,
    "commissionPercent" REAL NOT NULL,
    "commissionAmount" INTEGER NOT NULL,
    "agentSharePercent" REAL NOT NULL,
    "agentCommission" INTEGER NOT NULL,
    "companyCommission" INTEGER NOT NULL,
    "contractDate" DATETIME,
    "closingDate" DATETIME,
    "closedAt" DATETIME,
    "cancelReason" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Deal_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Deal_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Deal_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Deal_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Deal_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Deal" ("agentCommission", "agentId", "agentSharePercent", "amount", "clientId", "closedAt", "closingDate", "commissionAmount", "commissionPercent", "companyCommission", "contractDate", "createdAt", "id", "leadId", "notes", "ownerId", "propertyId", "reference", "status", "type", "updatedAt") SELECT "agentCommission", "agentId", "agentSharePercent", "amount", "clientId", "closedAt", "closingDate", "commissionAmount", "commissionPercent", "companyCommission", "contractDate", "createdAt", "id", "leadId", "notes", "ownerId", "propertyId", "reference", "status", "type", "updatedAt" FROM "Deal";
DROP TABLE "Deal";
ALTER TABLE "new_Deal" RENAME TO "Deal";
UPDATE "Deal" SET "status" = 'PENDING_CONTRACT' WHERE "status" IN ('NEGOTIATION', 'CONTRACT_PENDING', 'CONTRACT_SIGNED');
UPDATE "Deal" SET "status" = 'CLOSED' WHERE "status" = 'CLOSED_WON';
UPDATE "Deal" SET "status" = 'CANCELLED', "cancelReason" = 'Closed lost (before deal statuses were simplified)' WHERE "status" = 'CLOSED_LOST';
CREATE UNIQUE INDEX "Deal_reference_key" ON "Deal"("reference");
CREATE INDEX "Deal_status_idx" ON "Deal"("status");
CREATE INDEX "Deal_type_idx" ON "Deal"("type");
CREATE INDEX "Deal_agentId_status_idx" ON "Deal"("agentId", "status");
CREATE INDEX "Deal_propertyId_idx" ON "Deal"("propertyId");
CREATE INDEX "Deal_clientId_idx" ON "Deal"("clientId");
CREATE INDEX "Deal_closedAt_idx" ON "Deal"("closedAt");
CREATE INDEX "Deal_createdAt_idx" ON "Deal"("createdAt");
CREATE TABLE "new_Settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "companyName" TEXT NOT NULL DEFAULT 'ELITE Real Estate',
    "defaultCurrency" TEXT NOT NULL DEFAULT 'QAR',
    "saleCommissionPercent" REAL NOT NULL DEFAULT 2,
    "rentalCommissionPercent" REAL NOT NULL DEFAULT 8.33,
    "agentSharePercent" REAL NOT NULL DEFAULT 40,
    "leadResponseSlaMinutes" INTEGER NOT NULL DEFAULT 60,
    "autoLeadResponseTasks" BOOLEAN NOT NULL DEFAULT true,
    "leadAutoReassignHours" INTEGER NOT NULL DEFAULT 24,
    "leadEscalationUserId" TEXT,
    "saleDepositPercent" REAL NOT NULL DEFAULT 5,
    "rentDepositMonths" INTEGER NOT NULL DEFAULT 1,
    "reservationHoldHours" INTEGER NOT NULL DEFAULT 48,
    "fawranEnabled" BOOLEAN NOT NULL DEFAULT true,
    "bankName" TEXT,
    "bankAccountName" TEXT,
    "bankIban" TEXT,
    "bankAccountNumber" TEXT,
    "bankSwift" TEXT,
    "fawranAlias" TEXT,
    "paymentInstructions" TEXT,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Settings" ("agentSharePercent", "autoLeadResponseTasks", "companyName", "defaultCurrency", "id", "leadResponseSlaMinutes", "rentalCommissionPercent", "saleCommissionPercent", "updatedAt") SELECT "agentSharePercent", "autoLeadResponseTasks", "companyName", "defaultCurrency", "id", "leadResponseSlaMinutes", "rentalCommissionPercent", "saleCommissionPercent", "updatedAt" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Document_storageKey_key" ON "Document"("storageKey");

-- CreateIndex
CREATE INDEX "Document_leadId_kind_idx" ON "Document"("leadId", "kind");

-- CreateIndex
CREATE INDEX "Document_clientId_kind_idx" ON "Document"("clientId", "kind");

-- CreateIndex
CREATE INDEX "Document_dealId_idx" ON "Document"("dealId");

-- CreateIndex
CREATE INDEX "Document_reservationId_idx" ON "Document"("reservationId");

-- CreateIndex
CREATE INDEX "LeadPassRequest_leadId_status_idx" ON "LeadPassRequest"("leadId", "status");

-- CreateIndex
CREATE INDEX "LeadPassRequest_status_createdAt_idx" ON "LeadPassRequest"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OtpCode_resetTokenHash_key" ON "OtpCode"("resetTokenHash");

-- CreateIndex
CREATE INDEX "OtpCode_userId_purpose_createdAt_idx" ON "OtpCode"("userId", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_reference_key" ON "Reservation"("reference");

-- CreateIndex
CREATE INDEX "Reservation_clientId_status_idx" ON "Reservation"("clientId", "status");

-- CreateIndex
CREATE INDEX "Reservation_propertyId_status_idx" ON "Reservation"("propertyId", "status");

-- CreateIndex
CREATE INDEX "Reservation_agentId_status_idx" ON "Reservation"("agentId", "status");

-- CreateIndex
CREATE INDEX "Reservation_status_createdAt_idx" ON "Reservation"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ContractTemplate_isActive_idx" ON "ContractTemplate"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_reference_key" ON "Contract"("reference");

-- CreateIndex
CREATE INDEX "Contract_dealId_createdAt_idx" ON "Contract"("dealId", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_status_assignedAt_idx" ON "Lead"("status", "assignedAt");

-- Start the 24-hour clock for leads that already have an agent.
UPDATE "Lead" SET "assignedAt" = strftime('%Y-%m-%dT%H:%M:%S.000+00:00', 'now') WHERE "agentId" IS NOT NULL AND "assignedAt" IS NULL;
