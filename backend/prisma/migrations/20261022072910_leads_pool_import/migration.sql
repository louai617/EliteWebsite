-- Leads pool: agents now take numbers straight away, so the approval requests table (added
-- the day before, never released) goes. Takes are still recorded in the activity log and on
-- each pool entry (takenBy / takenAt / leadId). Pool entries remember the file they came from.
-- AlterTable
ALTER TABLE "PoolLead" ADD COLUMN "batch" TEXT;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "PoolLeadRequest";
PRAGMA foreign_keys=on;

-- CreateIndex
CREATE INDEX "PoolLead_batch_idx" ON "PoolLead"("batch");
