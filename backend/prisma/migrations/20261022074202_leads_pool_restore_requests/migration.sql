-- Leads pool: back to "agents ask, managers approve" (the Excel-import version was undone).
-- Brings the requests table back and removes the import label column; pool entries themselves
-- (numbers, names, needs, who took them) are all kept.
-- CreateTable
CREATE TABLE "PoolLeadRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "poolLeadId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "decidedById" TEXT,
    "decidedAt" DATETIME,
    "decisionNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PoolLeadRequest_poolLeadId_fkey" FOREIGN KEY ("poolLeadId") REFERENCES "PoolLead" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PoolLeadRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PoolLeadRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PoolLead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phone" TEXT NOT NULL,
    "phoneDigits" TEXT NOT NULL,
    "fullName" TEXT,
    "email" TEXT,
    "leadType" TEXT,
    "purpose" TEXT,
    "interestedArea" TEXT,
    "budgetMin" INTEGER,
    "budgetMax" INTEGER,
    "bedrooms" INTEGER,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "createdById" TEXT,
    "takenById" TEXT,
    "takenAt" DATETIME,
    "leadId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PoolLead_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PoolLead_takenById_fkey" FOREIGN KEY ("takenById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PoolLead_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PoolLead" ("bedrooms", "budgetMax", "budgetMin", "createdAt", "createdById", "email", "fullName", "id", "interestedArea", "leadId", "leadType", "notes", "phone", "phoneDigits", "purpose", "status", "takenAt", "takenById", "updatedAt") SELECT "bedrooms", "budgetMax", "budgetMin", "createdAt", "createdById", "email", "fullName", "id", "interestedArea", "leadId", "leadType", "notes", "phone", "phoneDigits", "purpose", "status", "takenAt", "takenById", "updatedAt" FROM "PoolLead";
DROP TABLE "PoolLead";
ALTER TABLE "new_PoolLead" RENAME TO "PoolLead";
CREATE UNIQUE INDEX "PoolLead_leadId_key" ON "PoolLead"("leadId");
CREATE INDEX "PoolLead_status_createdAt_idx" ON "PoolLead"("status", "createdAt");
CREATE INDEX "PoolLead_phoneDigits_idx" ON "PoolLead"("phoneDigits");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "PoolLeadRequest_poolLeadId_status_idx" ON "PoolLeadRequest"("poolLeadId", "status");

-- CreateIndex
CREATE INDEX "PoolLeadRequest_requestedById_status_idx" ON "PoolLeadRequest"("requestedById", "status");

-- CreateIndex
CREATE INDEX "PoolLeadRequest_status_createdAt_idx" ON "PoolLeadRequest"("status", "createdAt");
