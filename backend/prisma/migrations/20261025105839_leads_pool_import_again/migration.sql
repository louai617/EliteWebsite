-- Leads pool: agents take numbers straight away again (no approval), and imports from Excel /
-- CSV remember the file they came from. Pool entries are kept; takes stay recorded on each entry
-- (takenBy / takenAt / leadId) and in the activity log.
-- AlterTable
ALTER TABLE "PoolLead" ADD COLUMN "batch" TEXT;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "PoolLeadRequest";
PRAGMA foreign_keys=on;

-- CreateIndex
CREATE INDEX "PoolLead_batch_idx" ON "PoolLead"("batch");
