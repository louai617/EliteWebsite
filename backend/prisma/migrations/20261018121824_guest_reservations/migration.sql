-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Reservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "clientId" TEXT,
    "leadId" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "accessTokenHash" TEXT,
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
    CONSTRAINT "Reservation_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Reservation_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Reservation_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Reservation" ("agentId", "amount", "cancelReason", "clientId", "clientNote", "createdAt", "currency", "id", "method", "payBy", "payerName", "paymentReference", "propertyId", "reference", "status", "submittedAt", "updatedAt", "verifiedAt", "verifiedById") SELECT "agentId", "amount", "cancelReason", "clientId", "clientNote", "createdAt", "currency", "id", "method", "payBy", "payerName", "paymentReference", "propertyId", "reference", "status", "submittedAt", "updatedAt", "verifiedAt", "verifiedById" FROM "Reservation";
DROP TABLE "Reservation";
ALTER TABLE "new_Reservation" RENAME TO "Reservation";
CREATE UNIQUE INDEX "Reservation_reference_key" ON "Reservation"("reference");
CREATE UNIQUE INDEX "Reservation_accessTokenHash_key" ON "Reservation"("accessTokenHash");
CREATE INDEX "Reservation_clientId_status_idx" ON "Reservation"("clientId", "status");
CREATE INDEX "Reservation_leadId_idx" ON "Reservation"("leadId");
CREATE INDEX "Reservation_propertyId_status_idx" ON "Reservation"("propertyId", "status");
CREATE INDEX "Reservation_agentId_status_idx" ON "Reservation"("agentId", "status");
CREATE INDEX "Reservation_status_createdAt_idx" ON "Reservation"("status", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
