-- CreateTable
CREATE TABLE "PoolLead" (
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

-- CreateIndex
CREATE UNIQUE INDEX "PoolLead_leadId_key" ON "PoolLead"("leadId");

-- CreateIndex
CREATE INDEX "PoolLead_status_createdAt_idx" ON "PoolLead"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PoolLead_phoneDigits_idx" ON "PoolLead"("phoneDigits");

-- CreateIndex
CREATE INDEX "PoolLeadRequest_poolLeadId_status_idx" ON "PoolLeadRequest"("poolLeadId", "status");

-- CreateIndex
CREATE INDEX "PoolLeadRequest_requestedById_status_idx" ON "PoolLeadRequest"("requestedById", "status");

-- CreateIndex
CREATE INDEX "PoolLeadRequest_status_createdAt_idx" ON "PoolLeadRequest"("status", "createdAt");
