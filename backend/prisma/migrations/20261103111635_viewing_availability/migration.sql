-- CreateTable
CREATE TABLE "ViewingAvailability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ViewingAvailability_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ViewingAvailability_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ViewingAvailability_agentId_startsAt_idx" ON "ViewingAvailability"("agentId", "startsAt");

-- CreateIndex
CREATE INDEX "ViewingAvailability_startsAt_idx" ON "ViewingAvailability"("startsAt");
